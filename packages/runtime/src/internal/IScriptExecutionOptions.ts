import type { IScriptJobSnapshot } from "../IScriptJobSnapshot";
import type { ScriptLog } from "./ScriptLog";

/** Stream policy and observers for the shared execution owner. */
export interface IScriptExecutionOptions {
  /** Select actual inherited descriptors or isolated captured pipes. */
  policy: "inherit" | "capture";
  /** Optional admission-time environment snapshot so deferred capture redacts the actual child token. */
  environment?: NodeJS.ProcessEnv;
  /** Bounded journal consumed only under capture policy. */
  log?: ScriptLog;
  /** Optional launcher-state observer for the captured job owner. */
  onPhase?: (phase: IScriptJobSnapshot["phase"]) => void;
}
