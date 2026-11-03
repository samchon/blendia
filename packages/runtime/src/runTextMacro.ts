import type { ITextMacroOptions } from "./ITextMacroOptions";
import type { ITextMacroResult } from "./ITextMacroResult";
import type { IScriptExecutionResult } from "./internal/IScriptExecutionResult";
import { runScriptExecution } from "./internal/runScriptExecution";

/**
 * Stage unchanged Text as a bounded sibling module while preserving inherited three-stream behavior.
 *
 * The sibling is the actual compiler identity, not an unsaved overlay. Ordinary direct close permits identity-checked cleanup; uncertain execution retains the owned path.
 *
 * @evidence contracts/common.md#principled-implementation The shared staging owner checks UTF-8 size and physical/lexical containment, creates wx, and compares BigInt dev/ino before cleanup.
 * @evidence contracts/common.md#clear-and-simple-design Inherited and captured consumers share the same staging and launcher lifecycle rather than duplicating filesystem or spawn code.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Source and tsconfig are not overwritten, imports are not rewritten, and no overlay, custom compiler or false process-tree cancellation is used.
 * @evidence contracts/common.md#meaningful-documentation Origin, real staged module identity, cleanup ownership and uncertainty retention remain distinct from Blender mutation success.
 */
export async function runTextMacro(
  options: ITextMacroOptions,
): Promise<ITextMacroResult> {
  const execution: IScriptExecutionResult = await runScriptExecution(
    { kind: "text", options },
    { policy: "inherit" },
  );
  if (execution.error !== undefined) {
    const retained: string =
      "stagedPath" in execution.result
        ? ` Staging retained at ${JSON.stringify(execution.result.stagedPath)}.`
        : "";
    throw new Error(
      `blendia: Text launcher failed.${retained} ${execution.error.message}`,
      { cause: execution.error },
    );
  }
  if (!("stagedPath" in execution.result))
    throw new Error("blendia: Text staging result is unavailable.");
  return execution.result;
}
