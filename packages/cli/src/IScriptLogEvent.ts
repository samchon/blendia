import type { IScriptLogEntry } from "@blendia/runtime";

/** One bounded captured entry, correlated to its process-local owner and job. */
export interface IScriptLogEvent {
  /** Select one observed output entry. */
  type: "log";
  /** Process-local job identity. */
  id: string;
  /** Registry incarnation matching its snapshots. */
  ownerId: string;
  /** Codepoint-aligned payload of at most 2048 UTF-8 bytes. */
  entry: IScriptLogEntry;
}
