/** An observation-order entry; cursors are meaningful only within one job. */
export interface IScriptLogEntry {
  /** Zero-based entry position in this job's observation order. */
  cursor: number;
  /** Originating captured pipe; no global OS ordering is implied. */
  stream: "stdout" | "stderr";
  /** UTF-8 text payload is at most 2048 bytes, after known-token redaction. */
  text: string;
}
