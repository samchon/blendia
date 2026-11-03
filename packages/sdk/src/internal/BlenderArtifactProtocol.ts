import path from "node:path";

import { BlenderError } from "../BlenderError";
import type { IBlenderArtifactChunk } from "../IBlenderArtifactChunk";
import type { IBlenderArtifactReadOptions } from "../IBlenderArtifactReadOptions";
import type { IBlenderSaveOptions } from "../IBlenderSaveOptions";
import type { IBlenderSavedFile } from "../IBlenderSavedFile";
import type { IBlenderSession } from "../IBlenderSession";
import { BlenderRenderProtocol } from "./BlenderRenderProtocol";
import { BlenderValue as V } from "./BlenderValue";

/** Validate bounded owned-PNG reads and explicit persistent-file publication.
 *
 * @evidence contracts/common.md#principled-implementation Chunk identity, requested offset, bounded decoded length, total bytes, progress, EOF, and canonical base64 must agree before data is returned; saved metadata must match the explicit destination and source session.
 * @evidence contracts/common.md#clear-and-simple-design Read codecs accept owned IDs rather than file paths, while publication accepts an explicit absolute extension-bearing destination and leaves native no-replace enforcement to the producer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No base64 whitespace, ignored characters, inconsistent offsets, implicit extension, or filesystem fallback is used to repair malformed data or bypass a publication failure.
 * @evidence contracts/performance.md#efficient-algorithms Canonical validation decodes and re-encodes one requested chunk, linear in at most 196608 raw bytes, without constructing or scanning the full PNG.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Encoded length is checked before allocating the temporary decode buffer; the codec retains no buffers or file handles, and the returned chunk is owned by its caller.
 * @evidence contracts/common.md#meaningful-documentation An offset at total bytes is valid empty EOF, PNG export reports artifact start generation, .blend copy reports current generation, and file publication remains outside undo or rollback.
 */
export class BlenderArtifactProtocol {
  /** Copy only the owned identity and bounded byte window used by artifact.read. */
  public static read(
    value: IBlenderArtifactReadOptions,
    session: IBlenderSession,
  ): IBlenderArtifactReadOptions {
    const r: Record<string, unknown> = V.record(value);
    return {
      artifact: BlenderRenderProtocol.artifactHandle(r.artifact, session),
      offset: V.integer(r.offset, 0, 32 * 1024 * 1024),
      maxBytes: V.integer(
        r.maxBytes === undefined ? 196608 : r.maxBytes,
        1,
        196608,
      ),
    };
  }

  /** Decode at most one bounded chunk, checking exact identity, canonical bytes, progress, and EOF. */
  public static chunk(
    value: unknown,
    expected: IBlenderArtifactReadOptions,
  ): IBlenderArtifactChunk {
    const r: Record<string, unknown> = V.record(value, "INVALID_RESPONSE");
    const artifactId: string = V.text(r.artifactId, "INVALID_RESPONSE");
    const totalBytes: number = V.integer(
      r.totalBytes,
      1,
      32 * 1024 * 1024,
      "INVALID_RESPONSE",
    );
    const offset: number = V.integer(
      r.offset,
      0,
      totalBytes,
      "INVALID_RESPONSE",
    );
    const nextOffset: number = V.integer(
      r.nextOffset,
      offset,
      totalBytes,
      "INVALID_RESPONSE",
    );
    const maxBytes: number =
      expected.maxBytes === undefined ? 196608 : expected.maxBytes;
    const eof: boolean = V.boolean(r.eof, "INVALID_RESPONSE");
    if (
      artifactId !== expected.artifact.artifactId ||
      offset !== expected.offset ||
      nextOffset - offset > maxBytes ||
      eof !== (nextOffset === totalBytes) ||
      (!eof && nextOffset === offset) ||
      typeof r.dataBase64 !== "string" ||
      r.dataBase64.length > 4 * Math.ceil(maxBytes / 3)
    )
      throw new BlenderError(
        "INVALID_RESPONSE",
        "Artifact chunk identity, offsets, or bounds are invalid.",
      );
    const decoded: Buffer = Buffer.from(r.dataBase64, "base64");
    if (
      decoded.length !== nextOffset - offset ||
      decoded.toString("base64") !== r.dataBase64
    )
      throw new BlenderError(
        "INVALID_RESPONSE",
        "Artifact bytes are not canonical base64 of the reported length.",
      );
    return {
      artifactId,
      offset,
      nextOffset,
      totalBytes,
      dataBase64: r.dataBase64,
      eof,
    };
  }

  /** Destination interpretation is explicit; filesystem publication and no-replace enforcement stay in Blender. */
  public static save(
    value: IBlenderSaveOptions,
    extension: ".png" | ".blend",
  ): IBlenderSaveOptions {
    const r: Record<string, unknown> = V.record(value);
    const destination: string = V.text(r.path);
    if (
      !path.isAbsolute(destination) ||
      path.extname(destination).toLowerCase() !== extension
    )
      throw new BlenderError(
        "INVALID_ARGUMENT",
        "An absolute destination with the exact result extension is required.",
      );
    return {
      path: path.resolve(destination),
      overwrite: r.overwrite === undefined ? false : V.boolean(r.overwrite),
    };
  }

  /** Validate publication metadata; artifact generation may precede the current connection generation. */
  public static saved(
    value: unknown,
    session: IBlenderSession,
    expected: IBlenderSaveOptions,
    currentGeneration: boolean,
  ): IBlenderSavedFile {
    const r: Record<string, unknown> = V.record(value, "INVALID_RESPONSE");
    const destination: string = V.text(r.path, "INVALID_RESPONSE");
    const generation: number = V.integer(
      r.generation,
      0,
      session.generation,
      "INVALID_RESPONSE",
    );
    if (
      !path.isAbsolute(destination) ||
      path.resolve(destination) !== expected.path ||
      r.sourceSessionId !== session.sessionId ||
      (currentGeneration && generation !== session.generation)
    )
      throw new BlenderError(
        "INVALID_RESPONSE",
        "Published file metadata differs from the requested destination or session.",
      );
    return {
      path: destination,
      bytes: V.integer(r.bytes, 1, Number.MAX_SAFE_INTEGER, "INVALID_RESPONSE"),
      sourceSessionId: session.sessionId,
      generation,
    };
  }

  /** Release success is an empty object, not a claim that a native render was cancelled. */
  public static empty(value: unknown): void {
    if (Object.keys(V.record(value, "INVALID_RESPONSE")).length !== 0)
      throw new BlenderError(
        "INVALID_RESPONSE",
        "Expected an empty completion result.",
      );
  }
}
