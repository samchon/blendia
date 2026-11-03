import { TextDecoder } from "node:util";

import { BlenderError } from "../BlenderError";

/**
 * Incrementally decode the bridge's four-byte big-endian length and strict UTF-8 JSON payload without treating TCP chunks as messages.
 *
 * @evidence contracts/common.md#principled-implementation Header and payload offsets survive partial chunks; completed payloads are decoded with fatal UTF-8 validation then JSON.parse, with lengths restricted to 1 through 1048576 bytes.
 * @evidence contracts/common.md#clear-and-simple-design The production socket uses this decoder and its matching encoder; there is no second message boundary heuristic.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No replacement characters, partial JSON parsing, or guessed frame recovery is accepted; malformed input closes the owning client.
 * @evidence contracts/common.md#meaningful-documentation push returns only completed values; callers must discard the decoder after failure because remaining stream alignment is not recoverable.
 * @evidence contracts/performance.md#efficient-algorithms Each input byte is copied once into a four-byte header or a single preallocated payload; work is linear in input plus JSON parsing, avoiding repeated buffer concatenation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Retained raw state is at most one 1MiB payload and four header bytes; each returned array is owned by its caller and scales with complete frames in that input chunk.
 */
export class BlenderFrameDecoder {
  /** Prefix bytes retained across network chunks. */
  private readonly header: Buffer = Buffer.alloc(4);

  /** Number of prefix bytes already received. */
  private headerOffset: number = 0;

  /** Current bounded payload, allocated after its complete header. */
  private payload: Buffer | null = null;

  /** Number of payload bytes already received. */
  private payloadOffset: number = 0;

  /**
   * Consume any number of partial or coalesced frames and return their complete JSON values.
   *
   * @evidence contracts/common.md#principled-implementation Both offsets advance by the available bytes and reset only after a complete frame; zero and oversized lengths fail before payload allocation.
   * @evidence contracts/common.md#clear-and-simple-design This method owns incremental transport framing only; method-specific response validation remains in BlenderProtocol.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Fatal UTF-8 and JSON errors are reported rather than patched or silently skipped.
   * @evidence contracts/common.md#meaningful-documentation The decoder is unusable after malformed input; a chunk can yield zero, one, or many messages.
   */
  public push(chunk: Uint8Array): unknown[] {
    const messages: unknown[] = [];
    let offset: number = 0;
    while (offset < chunk.byteLength) {
      if (this.payload === null) {
        const count: number = Math.min(
          4 - this.headerOffset,
          chunk.byteLength - offset,
        );
        this.header.set(
          chunk.subarray(offset, offset + count),
          this.headerOffset,
        );
        this.headerOffset += count;
        offset += count;
        if (this.headerOffset !== 4) continue;
        const length: number = this.header.readUInt32BE(0);
        if (length === 0 || length > 1048576)
          throw new BlenderError(
            "INVALID_FRAME",
            "Frame length must be between 1 and 1048576 bytes.",
          );
        this.payload = Buffer.alloc(length);
        this.payloadOffset = 0;
      }

      const count: number = Math.min(
        this.payload.length - this.payloadOffset,
        chunk.byteLength - offset,
      );
      this.payload.set(
        chunk.subarray(offset, offset + count),
        this.payloadOffset,
      );
      this.payloadOffset += count;
      offset += count;
      if (this.payloadOffset !== this.payload.length) continue;

      try {
        const text: string = new TextDecoder("utf-8", { fatal: true }).decode(
          this.payload,
        );
        const message: unknown = JSON.parse(text);
        messages.push(message);
      } catch {
        throw new BlenderError(
          "INVALID_FRAME",
          "Frame payload must be valid UTF-8 JSON.",
        );
      }
      this.payload = null;
      this.payloadOffset = 0;
      this.headerOffset = 0;
    }
    return messages;
  }

  /**
   * Encode one JSON message with the same fixed payload cap used by the decoder.
   *
   * @evidence contracts/common.md#principled-implementation JSON.stringify runs once, UTF-8 byte length determines the big-endian prefix, and payloads outside the accepted size range are rejected.
   * @evidence contracts/common.md#clear-and-simple-design The client uses this encoder before retaining a pending request or writing to its socket.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unsupported root values and serialization failures are errors rather than empty or truncated frames.
   * @evidence contracts/common.md#meaningful-documentation The cap applies to encoded bytes rather than JavaScript UTF-16 character count.
   */
  public static encode(message: unknown): Buffer {
    let text: string | undefined;
    try {
      text = JSON.stringify(message);
    } catch {
      throw new BlenderError(
        "INVALID_ARGUMENT",
        "Request must be JSON serializable.",
      );
    }
    if (text === undefined)
      throw new BlenderError(
        "INVALID_ARGUMENT",
        "Request must contain a JSON value.",
      );
    const length: number = Buffer.byteLength(text, "utf8");
    if (length === 0 || length > 1048576)
      throw new BlenderError(
        "INVALID_ARGUMENT",
        "Request exceeds the 1048576-byte payload limit.",
      );
    const frame: Buffer = Buffer.allocUnsafe(length + 4);
    frame.writeUInt32BE(length, 0);
    frame.write(text, 4, length, "utf8");
    return frame;
  }
}
