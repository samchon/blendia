import type { IProjectScriptResult } from "../IProjectScriptResult";
import type { IScriptJobSnapshot } from "../IScriptJobSnapshot";

/** A private error is never copied into a public snapshot. */
export interface IScriptProcessResult {
  /** Observed direct-launcher status; null does not imply successful execution. */
  result: IProjectScriptResult;
  /** Distinguishes normal exit, failed creation, and incomplete observation. */
  outcome: NonNullable<IScriptJobSnapshot["outcome"]>;
  /** Original private failure for inherited callers; not serialized by captured jobs. */
  error?: Error;
}
