import type { IScriptJobRequest } from "./IScriptJobRequest";
import { ScriptJob } from "./ScriptJob";

/**
 * Admit one process-local captured job before staging or launch effects.
 *
 * @evidence contracts/common.md#principled-implementation ScriptJob reserves one of sixteen records, then shares the public-ttsx launcher and identity-checked Text staging with inherited execution.
 * @evidence contracts/common.md#clear-and-simple-design Captured jobs add bounded observation and explicit terminal retention; they acquire no SDK writer lease and preserve the existing inherited APIs.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No daemon, retry, mutation replay, process-tree cancellation, durable ID, or captured-forward compatibility shim is introduced.
 * @evidence contracts/common.md#meaningful-documentation Starting/running are launcher phases; unknown and retained staging disclose incomplete observation rather than promising scene rollback or successful TypeScript execution.
 */
export function startScriptJob(request: IScriptJobRequest): ScriptJob {
  return ScriptJob.start(request);
}
