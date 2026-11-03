import type { IScriptJobSnapshot } from "../IScriptJobSnapshot";
import type { IPreparedProjectLaunch } from "./IPreparedProjectLaunch";
import type { ScriptLog } from "./ScriptLog";

/** Internal policy: inheritance really uses three inherited descriptors. */
export interface IScriptProcessOptions {
  /** Prepared executable and private invocation context. */
  launch: IPreparedProjectLaunch;
  /** True descriptor inheritance or isolated capture, never forwarding as inheritance. */
  policy: "inherit" | "capture";
  /** Capture journal; absent for inherited execution. */
  log?: ScriptLog;
  /** Launcher lifecycle observations without a user-code-start claim. */
  onPhase?: (phase: IScriptJobSnapshot["phase"]) => void;
  /** Report the actual owned child PID without exposing a kill/process-manager API. */
  onSpawn?: (pid: number) => void;
  /** End captured observation as unknown without sending a signal or killing the child. */
  observationSignal?: AbortSignal;
}
