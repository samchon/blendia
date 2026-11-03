import type { IBlenderArtifactHandle } from "@blendia/sdk";
import type { ImageContent } from "@modelcontextprotocol/sdk/types.js";
import { AsyncLocalStorage } from "node:async_hooks";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { BlendiaMcpError } from "./BlendiaMcpError";
import type { IBlendiaMcpImageDeliveryEntry } from "./IBlendiaMcpImageDeliveryEntry";
import type { IBlendiaMcpImagePayload } from "./IBlendiaMcpImagePayload";
import type { IBlendiaMcpImageResult } from "./IBlendiaMcpImageResult";
import { MAX_MCP_IMAGE_BYTES } from "./MAX_MCP_IMAGE_BYTES";

/**
 * Hold owned image bytes privately until their original response sends once.
 *
 * A public Node async context correlates readImage execution with its request;
 * no request ID or raw base64 becomes a model parameter. Four deliveries and
 * four MiB of raw bytes are retained for at most thirty seconds and never past
 * artifact expiry. Full admission fails instead of evicting another response.
 *
 * @evidence contracts/common.md#principled-implementation stage binds validated bytes and detached metadata to the original readImage request in AsyncLocalStorage; take requires the same scalar request ID, ticket, and complete metadata before deleting and returning native content.
 * @evidence contracts/common.md#clear-and-simple-design The private queue bridges controller output and public Transport.send without changing typia schemas or dispatch; resources bypass it and return their own standard blob.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Raw bytes never enter tool structuredContent or text; tickets do not grant arbitrary file access, and failed admission never evicts an unrelated pending response.
 * @evidence contracts/common.md#meaningful-documentation The class states correlation, admission, byte and time bounds; cleanup methods distinguish bridge artifact ownership from temporary delivery ownership.
 * @evidence contracts/performance.md#efficient-algorithms A stage decodes at most one MiB to check canonical encoding; queue pruning and metadata matching visit at most four records and the fixed artifact fields, with no scene or filesystem scan.
 * @evidence contracts/performance.md#bound-retention-and-release-resources This owner holds at most four deliveries and four MiB raw-equivalent bytes until one-time take, thirty-second expiry, artifact expiry, release, session replacement, or close; an unreferenced timer releases abandoned entries even without another request.
 */
export class BlendiaMcpImageDelivery {
  /** Async correlation exists only along the real readImage request's call chain. */
  private readonly request: AsyncLocalStorage<string | number> =
    new AsyncLocalStorage();

  /** Pending bytes are private and never exposed by a model tool. */
  private readonly entries: Map<string, IBlendiaMcpImageDeliveryEntry> =
    new Map();

  /** Raw-equivalent accounting allows base64's additional four-thirds expansion. */
  private bytes: number = 0;

  /** A closed server cannot stage another delivery. */
  private closed: boolean = false;

  /** One unreferenced expiry timer for the bounded pending queue. */
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** Run the actual SDK callback inside its original readImage request context. */
  public runRequest(requestId: string | number, callback: () => void): void {
    this.request.run(requestId, callback);
  }

  /** Admit validated bytes while returning only metadata and a one-time ticket. */
  public stage(payload: IBlendiaMcpImagePayload): IBlendiaMcpImageResult {
    this.prune();
    const requestId: string | number | undefined = this.request.getStore();
    if (this.closed || requestId === undefined)
      throw new BlendiaMcpError("CLOSED", "No active image delivery request.");

    const artifactExpiry: number = Date.parse(payload.artifact.expiresAt);
    if (
      !Number.isFinite(artifactExpiry) ||
      artifactExpiry <= Date.now() ||
      payload.artifact.bytes < 1 ||
      payload.artifact.bytes > MAX_MCP_IMAGE_BYTES ||
      payload.dataBase64.length > Math.ceil(MAX_MCP_IMAGE_BYTES / 3) * 4
    )
      throw new BlendiaMcpError(
        "INVALID_IMAGE",
        "Image admission bounds failed.",
      );

    const decoded: Buffer = Buffer.from(payload.dataBase64, "base64");
    if (
      decoded.length !== payload.artifact.bytes ||
      decoded.toString("base64") !== payload.dataBase64
    )
      throw new BlendiaMcpError(
        "INVALID_IMAGE",
        "Image encoding is not canonical.",
      );
    if (
      this.entries.size >= 4 ||
      this.bytes + decoded.length > 4 * MAX_MCP_IMAGE_BYTES
    )
      throw new BlendiaMcpError(
        "BUSY",
        "Pending image delivery capacity is full.",
      );

    const metadata: IBlendiaMcpImageResult = {
      kind: "image",
      artifact: { ...payload.artifact, handle: { ...payload.artifact.handle } },
      mimeType: "image/png",
      deliveryId: randomUUID(),
    };
    this.entries.set(metadata.deliveryId, {
      requestId,
      metadata,
      payload: { ...payload, artifact: metadata.artifact },
      expiresAt: Math.min(Date.now() + 30000, artifactExpiry),
    });
    this.bytes += decoded.length;
    this.scheduleExpiry();

    return {
      ...metadata,
      artifact: {
        ...metadata.artifact,
        handle: { ...metadata.artifact.handle },
      },
    };
  }

  /** Consume only matching response metadata; deletion precedes transport send. */
  public take(
    deliveryId: string,
    metadata: unknown,
    requestId: string | number,
  ): ImageContent | undefined {
    this.prune();
    const entry: IBlendiaMcpImageDeliveryEntry | undefined =
      this.entries.get(deliveryId);
    if (
      entry === undefined ||
      entry.requestId !== requestId ||
      !this.matches(metadata, entry.metadata)
    )
      return undefined;

    this.remove(deliveryId);
    this.scheduleExpiry();
    return {
      type: "image",
      mimeType: entry.payload.mimeType,
      data: entry.payload.dataBase64,
    };
  }

  /** Retire pending delivery copies when the native artifact is released. */
  public forget(handle: IBlenderArtifactHandle): void {
    for (const [id, entry] of this.entries)
      if (
        entry.metadata.artifact.handle.sessionId === handle.sessionId &&
        entry.metadata.artifact.handle.artifactId === handle.artifactId
      )
        this.remove(id);
    this.scheduleExpiry();
  }

  /** A replacement bridge cannot consume a previous session's queued bytes. */
  public retainSession(sessionId: string): void {
    for (const [id, entry] of this.entries)
      if (entry.metadata.artifact.handle.sessionId !== sessionId)
        this.remove(id);
    this.prune();
    this.scheduleExpiry();
  }

  /** Release every pending copy without deleting native or published artifacts. */
  public close(): void {
    this.closed = true;
    this.entries.clear();
    this.bytes = 0;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.request.disable();
  }

  /** Compare all declared metadata without trusting a ticket's existence alone. */
  private matches(value: unknown, expected: IBlendiaMcpImageResult): boolean {
    if (
      typeof value !== "object" ||
      value === null ||
      !("kind" in value) ||
      value.kind !== "image" ||
      !("deliveryId" in value) ||
      value.deliveryId !== expected.deliveryId ||
      !("mimeType" in value) ||
      value.mimeType !== expected.mimeType ||
      !("artifact" in value) ||
      typeof value.artifact !== "object" ||
      value.artifact === null
    )
      return false;

    const artifact: Record<string, unknown> = value.artifact as Record<
      string,
      unknown
    >;
    const handle: unknown = artifact.handle;
    if (
      typeof handle !== "object" ||
      handle === null ||
      !("sessionId" in handle) ||
      handle.sessionId !== expected.artifact.handle.sessionId ||
      !("artifactId" in handle) ||
      handle.artifactId !== expected.artifact.handle.artifactId
    )
      return false;

    return Object.entries(expected.artifact).every(
      ([key, field]: [string, unknown]): boolean =>
        key === "handle" || artifact[key] === field,
    );
  }

  /** Expired entries release bytes even when the next response is unrelated. */
  private prune(): void {
    for (const [id, entry] of this.entries)
      if (entry.expiresAt <= Date.now()) this.remove(id);
  }

  /** Maintain raw-equivalent accounting at every deletion boundary. */
  private remove(id: string): void {
    const entry: IBlendiaMcpImageDeliveryEntry | undefined =
      this.entries.get(id);
    if (entry === undefined) return;
    this.bytes -= entry.payload.artifact.bytes;
    this.entries.delete(id);
  }

  /** Keep one timer rather than one retained callback for every pending image. */
  private scheduleExpiry(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.entries.size === 0) return;

    const deadline: number = Math.min(
      ...Array.from(
        this.entries.values(),
        (entry: IBlendiaMcpImageDeliveryEntry): number => entry.expiresAt,
      ),
    );
    this.timer = setTimeout(
      (): void => {
        this.prune();
        this.scheduleExpiry();
      },
      Math.max(1, deadline - Date.now()),
    );
    this.timer.unref();
  }
}
