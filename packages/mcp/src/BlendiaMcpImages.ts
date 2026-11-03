import type {
  BlenderClient,
  IBlenderArtifact,
  IBlenderArtifactChunk,
  IBlenderArtifactHandle,
} from "@blendia/sdk";

import { BlendiaMcpError } from "./BlendiaMcpError";
import { BlendiaMcpImageDelivery } from "./BlendiaMcpImageDelivery";
import type { IBlendiaMcpImagePayload } from "./IBlendiaMcpImagePayload";
import { MAX_MCP_IMAGE_BYTES } from "./MAX_MCP_IMAGE_BYTES";

/** Own bounded observations of live bridge PNGs without adopting foreign paths or manufacturing durable files.
 *
 * @evidence contracts/common.md#principled-implementation Only succeeded render metadata is observed; reads require the same session and nonexpired observed artifact, exact total bytes, contiguous offsets, and matching image dimensions.
 * @evidence contracts/common.md#clear-and-simple-design The real controller and resource adapter share this owned-ID reader; validated raw bytes remain private while the tool returns only metadata and a one-time delivery ticket.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No filesystem path fallback, implicit foreign-artifact adoption, expired headless URI, or image generated from metadata substitutes for owned PNG bytes.
 * @evidence contracts/common.md#meaningful-documentation One MiB is a distinct MCP admission bound, observed metadata is bounded to four artifacts, and disconnect does not itself delete native artifacts.
 * @evidence contracts/performance.md#efficient-algorithms Assembly visits at most one MiB in sequential 192 KiB SDK windows; no full scene scan or arbitrary file read is required.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The map retains at most four small metadata records; temporary chunks belong to the invocation, and tool payloads enter a separate four-MiB one-time queue whose release, session replacement, and close follow these observations.
 */
export class BlendiaMcpImages {
  /** Detached observed metadata; underlying bytes remain bridge-owned. */
  private readonly artifacts: Map<string, IBlenderArtifact> = new Map();

  /** Private transport media is retired together with its observed artifact identity. */
  private readonly delivery: BlendiaMcpImageDelivery;

  /** Share one factory-owned delivery lifetime without exposing its bytes as a model result. */
  public constructor(delivery: BlendiaMcpImageDelivery) {
    this.delivery = delivery;
  }

  /** Register only actual successful readback; the caller cannot populate this map through readImage input. */
  public observe(artifact: IBlenderArtifact): void {
    this.prune();
    const key: string = this.key(artifact.handle);
    this.artifacts.delete(key);
    this.artifacts.set(key, { ...artifact, handle: { ...artifact.handle } });
    while (this.artifacts.size > 4) {
      const oldest: string | undefined = this.artifacts.keys().next().value;
      if (oldest !== undefined) this.artifacts.delete(oldest);
    }
  }

  /** Remove only the released identity's observation. */
  public forget(artifact: IBlenderArtifactHandle): void {
    this.artifacts.delete(this.key(artifact));
    this.delivery.forget(artifact);
  }

  /** Session replacement prevents cached artifacts from being silently retargeted. */
  public retainSession(sessionId: string): void {
    this.delivery.retainSession(sessionId);
    for (const [key, artifact] of this.artifacts)
      if (artifact.handle.sessionId !== sessionId) this.artifacts.delete(key);
    this.prune();
  }

  /** Retire metadata when the controller lifetime ends, without deleting published user files. */
  public clear(): void {
    this.artifacts.clear();
    this.delivery.close();
  }

  /** Fetch a previously observed live PNG; callers keep this raw payload outside tool schemas. */
  public async read(
    client: BlenderClient,
    handle: IBlenderArtifactHandle,
  ): Promise<IBlendiaMcpImagePayload> {
    this.prune();
    const artifact: IBlenderArtifact | undefined = this.artifacts.get(
      this.key(handle),
    );
    if (artifact === undefined || handle.sessionId !== client.session.sessionId)
      throw new BlendiaMcpError(
        "NOT_FOUND",
        "Observe a succeeded render in this session before reading its retained image.",
      );
    if (artifact.bytes > MAX_MCP_IMAGE_BYTES)
      throw new BlendiaMcpError(
        "IMAGE_TOO_LARGE",
        "Native MCP images are limited to one MiB of raw PNG bytes.",
      );
    const chunks: Buffer[] = [];
    let offset: number = 0;
    while (offset < artifact.bytes) {
      const chunk: IBlenderArtifactChunk = await client.readArtifact({
        artifact: artifact.handle,
        offset,
        maxBytes: Math.min(196608, artifact.bytes - offset),
      });
      const bytes: Buffer = this.decodeChunk(chunk, artifact, offset);
      chunks.push(bytes);
      offset = chunk.nextOffset;
    }
    const bytes: Buffer = Buffer.concat(chunks, artifact.bytes);
    this.validatePng(bytes, artifact);
    return {
      artifact: { ...artifact, handle: { ...artifact.handle } },
      mimeType: "image/png",
      dataBase64: bytes.toString("base64"),
    };
  }

  /** Correlate a canonical bounded chunk with the immutable observed total across the complete image. */
  public decodeChunk(
    chunk: IBlenderArtifactChunk,
    artifact: IBlenderArtifact,
    offset: number,
  ): Buffer {
    if (
      chunk.artifactId !== artifact.handle.artifactId ||
      chunk.offset !== offset ||
      chunk.totalBytes !== artifact.bytes ||
      chunk.nextOffset <= offset ||
      chunk.nextOffset > artifact.bytes ||
      chunk.nextOffset - offset > 196608 ||
      chunk.eof !== (chunk.nextOffset === artifact.bytes) ||
      chunk.dataBase64.length > 262144
    )
      throw new BlendiaMcpError(
        "INVALID_IMAGE",
        "PNG chunk identity or progress differs from its observed artifact.",
      );
    const bytes: Buffer = Buffer.from(chunk.dataBase64, "base64");
    if (
      bytes.length !== chunk.nextOffset - offset ||
      bytes.toString("base64") !== chunk.dataBase64
    )
      throw new BlendiaMcpError(
        "INVALID_IMAGE",
        "PNG chunk encoding differs from its declared offsets.",
      );
    return bytes;
  }

  /** Check the actual owned PNG signature and IHDR dimensions before native image transport. */
  public validatePng(bytes: Buffer, artifact: IBlenderArtifact): void {
    if (
      bytes.length !== artifact.bytes ||
      bytes.length < 33 ||
      !bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      bytes.readUInt32BE(8) !== 13 ||
      bytes.toString("ascii", 12, 16) !== "IHDR" ||
      bytes.readUInt32BE(16) !== artifact.width ||
      bytes.readUInt32BE(20) !== artifact.height
    )
      throw new BlendiaMcpError(
        "INVALID_IMAGE",
        "Owned PNG header differs from its observed render metadata.",
      );
  }

  /** Identity components are opaque strings, never decoded as filesystem paths. */
  private key(handle: IBlenderArtifactHandle): string {
    return JSON.stringify([handle.sessionId, handle.artifactId]);
  }

  /** Metadata expiry never promises that a private artifact became a durable resource. */
  private prune(): void {
    for (const [key, artifact] of this.artifacts)
      if (Date.parse(artifact.expiresAt) <= Date.now())
        this.artifacts.delete(key);
  }
}
