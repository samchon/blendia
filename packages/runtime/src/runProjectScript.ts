import type { IProjectScriptOptions } from "./IProjectScriptOptions";
import type { IProjectScriptResult } from "./IProjectScriptResult";
import type { IScriptExecutionResult } from "./internal/IScriptExecutionResult";
import { runScriptExecution } from "./internal/runScriptExecution";

/**
 * Launch project TypeScript with the actual inherited stdin/stdout/stderr and TTY behavior.
 *
 * @evidence contracts/common.md#principled-implementation The shared execution owner resolves the public ttsx bin and current Node, passes original source/cwd/arguments, and selects true inherited descriptors.
 * @evidence contracts/common.md#clear-and-simple-design Both APIs use one spawn lifecycle; this compatibility entry preserves inherited input/output rather than forwarding captured pipes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No compiled local fallback, shell, custom compiler, captured-forward substitute, or launcher SDK connection is added.
 * @evidence contracts/common.md#meaningful-documentation Closure describes only the direct launcher; it proves neither descendant termination nor scene success or rollback.
 */
export async function runProjectScript(
  options: IProjectScriptOptions,
): Promise<IProjectScriptResult> {
  const execution: IScriptExecutionResult = await runScriptExecution(
    { kind: "file", options },
    { policy: "inherit" },
  );
  if (execution.error !== undefined) throw execution.error;
  return execution.result;
}
