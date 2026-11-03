import type { IProjectScriptResult } from "./IProjectScriptResult";

/** Direct Text launcher outcome with distinct intended and actual module identities. */
export interface ITextMacroResult extends IProjectScriptResult {
  /** Resolved intended source path, which was not overwritten. */
  sourcePath: string;

  /** Actual compiler and runtime entry path of this unique sibling module. */
  stagedPath: string;

  /** Caller-provided Text label, or sourcePath when no label was supplied. */
  origin: string;

  /** Whether the staging file was removed after an ordinary launcher exit. */
  staging: "removed" | "retained";

  /** Why the file remains when cleanup was unsafe or failed. */
  cleanupError?: string;
}
