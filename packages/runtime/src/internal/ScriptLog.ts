import { StringDecoder } from "node:string_decoder";

import type { IScriptLogEntry } from "../IScriptLogEntry";
import type { IScriptLogPage } from "../IScriptLogPage";

/**
 * Continuously decode/redact two streams and retain only bounded payload and entry counts.
 *
 * A token prefix is held across chunks before any text is published. Entries follow observed arrival order, not an asserted operating-system order between streams. Budgets are functional bounds, not measured performance targets.
 *
 * @evidence contracts/common.md#principled-implementation StringDecoder preserves split UTF-8, per-stream prefix retention prevents publishing a split known token, and codepoint-aligned entries form a monotonic bounded journal.
 * @evidence contracts/common.md#clear-and-simple-design The journal owns decoding/redaction/retention/page admission; the process owner only supplies bytes, and adapters decide whether to render them.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No parent-stream forwarding or silent cursor reset substitutes for capture; stale reads explicitly report a gap and invalid budgets fail without mutation.
 * @evidence contracts/common.md#meaningful-documentation Payload bytes and entry counts are separate bounds, cursors belong to one job, and stream order is observation order rather than an OS-wide guarantee.
 * @evidence contracts/performance.md#efficient-algorithms Each append scans decoded text and token-prefix candidates, and each page scans at most 1024 retained entries; no whole historical log is rescanned or retained. Token-prefix matching costs depend on the effective token length and are not a measured startup optimization.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Two incremental decoders and at most one token-prefix carry per stream feed a ring bounded by 65536 UTF-8 payload bytes and 1024 entries. Pages copy at most 16384 payload bytes and 128 entries; finish flushes decoder state, and terminal close clears retained entries and token material.
 */
export class ScriptLog {
  /** Retained observation-order entries, independent of discarded history. */
  private readonly entries: IScriptLogEntry[] = [];
  /** One UTF-8 decoder per observed pipe. */
  private readonly decoders: Map<string, StringDecoder> = new Map();
  /** Unpublished suffix that could complete the known token on the next chunk. */
  private readonly pending: Map<string, string> = new Map();
  /** Prevent duplicate flushing and writes after an EOF boundary. */
  private readonly finished: Set<string> = new Set();
  /** UTF-8 payload bytes currently retained, excluding metadata. */
  private bytes: number = 0;
  /** Next monotonically assigned entry cursor. */
  private tail: number = 0;

  /** The effective child token stays private and is released with terminal retention. */
  public constructor(private token: string = "") {}

  /** Decode bytes incrementally; never write captured output to parent streams. */
  public append(stream: "stdout" | "stderr", bytes: Buffer): void {
    if (this.finished.has(stream))
      throw new Error("blendia: log stream is already finished.");
    let decoder: StringDecoder | undefined = this.decoders.get(stream);
    if (decoder === undefined) {
      decoder = new StringDecoder("utf8");
      this.decoders.set(stream, decoder);
    }
    this.publish(stream, decoder.write(bytes), false);
  }

  /** Flush decoder and any incomplete token prefix exactly once at the observation boundary. */
  public finish(stream: "stdout" | "stderr"): void {
    if (this.finished.has(stream)) return;
    this.finished.add(stream);
    this.publish(stream, this.decoders.get(stream)?.end() ?? "", true);
    this.decoders.delete(stream);
  }

  /** Validate without mutation, then page at UTF-8 entry boundaries with explicit retention gaps. */
  public read(cursor: number = 0, byteLimit: number = 16384): IScriptLogPage {
    if (!Number.isSafeInteger(cursor) || cursor < 0 || cursor > this.tail)
      throw new Error(
        "blendia: cursor must be a safe integer within this job's observed log.",
      );
    if (
      !Number.isSafeInteger(byteLimit) ||
      byteLimit < 4096 ||
      byteLimit > 16384
    )
      throw new Error(
        "blendia: log byteLimit must be a safe integer from 4096 through 16384.",
      );
    const earliestCursor: number = this.entries[0]?.cursor ?? this.tail;
    let nextCursor: number = Math.max(cursor, earliestCursor);
    let size: number = 0;
    const entries: IScriptLogEntry[] = [];
    for (const entry of this.entries) {
      if (entry.cursor < nextCursor) continue;
      const length: number = Buffer.byteLength(entry.text, "utf8");
      if (entries.length === 128 || size + length > byteLimit) break;
      entries.push({ ...entry });
      size += length;
      nextCursor = entry.cursor + 1;
    }
    return {
      entries,
      earliestCursor,
      nextCursor,
      gap: cursor < earliestCursor,
      hasMore: nextCursor < this.tail,
    };
  }

  /** Next observation position, including entries already evicted. */
  public get tailCursor(): number {
    return this.tail;
  }
  /** First retained position, or tail when empty. */
  public get earliestCursor(): number {
    return this.entries[0]?.cursor ?? this.tail;
  }

  /** Release terminal retention without resetting cursor identity. */
  public clear(): void {
    this.entries.length = 0;
    this.pending.clear();
    this.decoders.clear();
    this.bytes = 0;
    this.token = "";
  }

  /** Redact complete tokens and retain only an undecided prefix until the next decode. */
  private publish(
    stream: "stdout" | "stderr",
    decoded: string,
    final: boolean,
  ): void {
    let text: string = (this.pending.get(stream) ?? "") + decoded;
    this.pending.delete(stream);
    if (this.token.length !== 0) {
      let output: string = "";
      let index: number = text.indexOf(this.token);
      while (index !== -1) {
        output +=
          text.slice(0, index) +
          ("[REDACTED]".includes(this.token) ? "" : "[REDACTED]");
        text = text.slice(index + this.token.length);
        index = text.indexOf(this.token);
      }
      let held: number = 0;
      if (!final) {
        const limit: number = Math.min(text.length, this.token.length - 1);
        for (let length: number = limit; length > 0; length--)
          if (this.token.startsWith(text.slice(-length))) {
            held = length;
            break;
          }
      }
      if (held !== 0) this.pending.set(stream, text.slice(-held));
      text = output + text.slice(0, text.length - held);
    }

    let piece: string = "";
    let size: number = 0;
    for (const character of text) {
      const length: number = Buffer.byteLength(character, "utf8");
      if (size + length > 2048) {
        this.retain(stream, piece, size);
        piece = "";
        size = 0;
      }
      piece += character;
      size += length;
    }
    if (size !== 0) this.retain(stream, piece, size);
  }

  /** Evict oldest observations without stopping capture when either retention bound is reached. */
  private retain(
    stream: "stdout" | "stderr",
    text: string,
    bytes: number,
  ): void {
    this.entries.push({ cursor: this.tail++, stream, text });
    this.bytes += bytes;
    while (this.bytes > 65536 || this.entries.length > 1024) {
      const removed: IScriptLogEntry | undefined = this.entries.shift();
      if (removed !== undefined)
        this.bytes -= Buffer.byteLength(removed.text, "utf8");
    }
  }
}
