import { BlenderError } from "../BlenderError";
import type { BlenderRenderJob } from "../BlenderRenderJob";
import type { IBlenderArtifact } from "../IBlenderArtifact";
import type { IBlenderArtifactHandle } from "../IBlenderArtifactHandle";
import type { IBlenderRenderHandle } from "../IBlenderRenderHandle";
import type { IBlenderRenderJobBase } from "../IBlenderRenderJobBase";
import type { IBlenderRenderOptions } from "../IBlenderRenderOptions";
import type { IBlenderSession } from "../IBlenderSession";
import { BlenderValue as V } from "./BlenderValue";

/** Validate native-job recovery identities and immutable PNG provenance.
 *
 * @evidence contracts/common.md#principled-implementation Caller UUID and session handles are validated, each state has one valid result arm, and successful PNG identity, dimensions, and start generation must match the expected native job.
 * @evidence contracts/common.md#clear-and-simple-design Native jobs retain immutable invocation provenance independently of current object generation; this codec parses observations while the connection owns pending RPC state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Pending and failed observations cannot certify artifacts; a foreign job, contradictory result, or malformed provenance never becomes a successful capture.
 * @evidence contracts/common.md#meaningful-documentation The caller supplies its UUID before start and keeps it after response loss; session-only job and artifact handles require explicit reconnect rather than implicit replay or cancellation.
 */
export class BlenderRenderProtocol {
  /** A start identity exists in caller-owned options before transmission, including a lost response. */
  public static options(value: IBlenderRenderOptions): IBlenderRenderOptions {
    const r: Record<string, unknown> = V.record(value);
    return {
      renderId: V.uuid(r.renderId),
      width: V.integer(r.width === undefined ? 512 : r.width, 1, 4096),
      height: V.integer(r.height === undefined ? 512 : r.height, 1, 4096),
    };
  }

  /** Native render IDs belong to a bridge session, not the current object generation. */
  public static handle(
    value: unknown,
    session: IBlenderSession,
    code: string = "INVALID_ARGUMENT",
  ): IBlenderRenderHandle {
    const r: Record<string, unknown> = V.record(value, code);
    const sessionId: string = V.text(r.sessionId, code);
    const renderId: string = V.uuid(r.renderId, code);
    if (sessionId !== session.sessionId)
      throw new BlenderError(
        code === "INVALID_ARGUMENT" ? "STALE_HANDLE" : code,
        "Native render belongs to another bridge session.",
      );
    return { sessionId, renderId };
  }

  /** An owned artifact grants reads only within this exact bridge's retained population. */
  public static artifactHandle(
    value: unknown,
    session: IBlenderSession,
    code: string = "INVALID_ARGUMENT",
  ): IBlenderArtifactHandle {
    const r: Record<string, unknown> = V.record(value, code);
    const sessionId: string = V.text(r.sessionId, code);
    const artifactId: string = V.text(r.artifactId, code);
    if (artifactId.length > 128)
      throw new BlenderError(code, "Artifact identity is too long.");
    if (sessionId !== session.sessionId)
      throw new BlenderError(
        code === "INVALID_ARGUMENT" ? "STALE_HANDLE" : code,
        "Artifact belongs to another bridge session.",
      );
    return { sessionId, artifactId };
  }

  /** Keep immutable start provenance distinct from the current response generation. */
  public static artifact(
    value: unknown,
    session: IBlenderSession,
  ): IBlenderArtifact {
    const r: Record<string, unknown> = V.record(value, "INVALID_RESPONSE");
    if (r.mimeType !== "image/png")
      throw new BlenderError(
        "INVALID_RESPONSE",
        "Owned render artifact must be PNG.",
      );
    return {
      handle: this.artifactHandle(r.handle, session, "INVALID_RESPONSE"),
      renderId: V.uuid(r.renderId, "INVALID_RESPONSE"),
      startGeneration: V.integer(
        r.startGeneration,
        0,
        session.generation,
        "INVALID_RESPONSE",
      ),
      mimeType: "image/png",
      bytes: V.integer(r.bytes, 1, 32 * 1024 * 1024, "INVALID_RESPONSE"),
      width: V.integer(r.width, 1, 4096, "INVALID_RESPONSE"),
      height: V.integer(r.height, 1, 4096, "INVALID_RESPONSE"),
      expiresAt: V.timestamp(r.expiresAt),
    };
  }

  /** Correlate the discriminated observation with the caller's retained native-job handle. */
  public static job(
    value: unknown,
    session: IBlenderSession,
    expected: IBlenderRenderHandle,
  ): BlenderRenderJob {
    const r: Record<string, unknown> = V.record(value, "INVALID_RESPONSE");
    const handle: IBlenderRenderHandle = this.handle(
      r.handle,
      session,
      "INVALID_RESPONSE",
    );
    if (
      handle.renderId !== expected.renderId ||
      handle.sessionId !== expected.sessionId
    )
      throw new BlenderError(
        "INVALID_RESPONSE",
        "Native render observation belongs to another request.",
      );
    const base: IBlenderRenderJobBase = {
      handle,
      startGeneration: V.integer(
        r.startGeneration,
        0,
        session.generation,
        "INVALID_RESPONSE",
      ),
      sceneId: V.uid(r.sceneId),
      sceneName: V.text(r.sceneName, "INVALID_RESPONSE"),
      cameraObjectId: V.uid(r.cameraObjectId),
      engine: V.text(r.engine, "INVALID_RESPONSE"),
      frame: V.integer(
        r.frame,
        -Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
        "INVALID_RESPONSE",
      ),
      width: V.integer(r.width, 1, 4096, "INVALID_RESPONSE"),
      height: V.integer(r.height, 1, 4096, "INVALID_RESPONSE"),
      startedAt: V.timestamp(r.startedAt),
    };
    if (r.status === "running" || r.status === "finalizing") {
      if (
        r.artifact !== undefined ||
        r.error !== undefined ||
        r.finishedAt !== undefined
      )
        throw new BlenderError(
          "INVALID_RESPONSE",
          "Pending render cannot certify a terminal result.",
        );
      return { ...base, status: r.status };
    }
    const finishedAt: string = V.timestamp(r.finishedAt);
    if (Date.parse(finishedAt) < Date.parse(base.startedAt))
      throw new BlenderError(
        "INVALID_RESPONSE",
        "Render completion precedes its start.",
      );
    if (r.status === "succeeded") {
      if (r.error !== undefined)
        throw new BlenderError(
          "INVALID_RESPONSE",
          "Successful render cannot contain a failure.",
        );
      const artifact: IBlenderArtifact = this.artifact(r.artifact, session);
      if (
        artifact.renderId !== handle.renderId ||
        artifact.startGeneration !== base.startGeneration ||
        artifact.width !== base.width ||
        artifact.height !== base.height
      )
        throw new BlenderError(
          "INVALID_RESPONSE",
          "PNG provenance differs from the rendered scene.",
        );
      return { ...base, status: "succeeded", finishedAt, artifact };
    }
    if (
      (r.status !== "cancelled" &&
        r.status !== "failed" &&
        r.status !== "unknown") ||
      r.artifact !== undefined
    )
      throw new BlenderError(
        "INVALID_RESPONSE",
        "Native render state is invalid.",
      );
    const error: Record<string, unknown> = V.record(
      r.error,
      "INVALID_RESPONSE",
    );
    if (error.effects !== "none" && error.effects !== "possible")
      throw new BlenderError(
        "INVALID_RESPONSE",
        "Render failure effects are invalid.",
      );
    return {
      ...base,
      status: r.status,
      finishedAt,
      error: {
        code: V.text(error.code, "INVALID_RESPONSE"),
        message: V.text(error.message, "INVALID_RESPONSE"),
        effects: error.effects,
      },
    };
  }
}
