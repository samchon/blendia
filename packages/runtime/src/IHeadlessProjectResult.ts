import type { IProjectScriptResult } from "./IProjectScriptResult";
import type { IScriptJobSnapshot } from "./IScriptJobSnapshot";
import type { IScriptLogPage } from "./IScriptLogPage";

/** One-shot observations keep script execution, owned Blender closure, and persistence distinct. */
export interface IHeadlessProjectResult {
  /** Completed means both lifetimes were observed, including ordinary nonzero script exits. */
  outcome: "completed" | "launch-failed" | "unknown";

  /** Existing captured script terminal snapshot; absent when no script was launched. */
  script?: IScriptJobSnapshot;

  /** Raw direct Blender status, including null/unsigned values when observation is uncertain. */
  blender?: IProjectScriptResult;

  /** Separate process outcome; never inferred from the script's exit code. */
  blenderOutcome: "not-started" | "exited" | "launch-failed" | "unknown";

  /** PID observed at spawn, for ownership reporting only; no process-tree guarantee. */
  blenderPid?: number;

  /** Bounded retained script pages with cursor/gap metadata; the ScriptJob record is released before return. */
  scriptLogs: IScriptLogPage[];

  /** Separate bounded native Blender output, never automatically forwarded to parent streams. */
  blenderLogs: IScriptLogPage[];

  /** Runtime-owned private bootstrap storage disposition, separate from explicit user outputs. */
  cleanup: "not-created" | "removed" | "retained";

  /** Reported only when retained; contains private credentials and must be handled accordingly. */
  retainedDirectory?: string;

  /** Fixed sanitized finding; native/script diagnostics remain in their bounded logs. */
  diagnostic?: string;
}
