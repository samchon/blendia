import type { IProjectScriptResult } from "./IProjectScriptResult";
import type { ITextMacroResult } from "./ITextMacroResult";

/** Credential-free observation of a process-local job, not a Blender transaction. */
export interface IScriptJobSnapshot {
  /** Random process-local record identifier. */
  id: string;
  /** Registry incarnation; identifiers and cursors do not cross this boundary. */
  ownerId: string;
  /** Running means the launcher spawned, not that user TypeScript began. */
  phase: "starting" | "running" | "draining" | "terminal";
  /** Present only at terminal; exited includes nonzero application exits. */
  outcome?: "exited" | "launch-failed" | "unknown";
  /** Redacted, bounded public observation; metadataTruncated disqualifies paths as exact cleanup operands. */
  result?: IProjectScriptResult | ITextMacroResult;
  /** Fixed launcher/observer finding; actual child diagnostics remain in captured logs. */
  diagnostic?: string;
  /** True when a redacted metadata string exceeded the 4096-byte public field limit. */
  metadataTruncated: boolean;
  /** Oldest retained entry, possibly advanced while a consumer is slow. */
  earliestCursor: number;
  /** Next entry position; a terminal snapshot freezes the final observed tail. */
  tailCursor: number;
}
