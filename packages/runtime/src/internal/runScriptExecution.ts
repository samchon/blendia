import type { IProjectScriptOptions } from "../IProjectScriptOptions";
import type { IScriptJobRequest } from "../IScriptJobRequest";
import type { IPreparedProjectLaunch } from "./IPreparedProjectLaunch";
import type { IScriptExecutionOptions } from "./IScriptExecutionOptions";
import type { IScriptExecutionResult } from "./IScriptExecutionResult";
import type { IScriptProcessResult } from "./IScriptProcessResult";
import { ScriptProcess } from "./ScriptProcess";
import { TextMacroStage } from "./TextMacroStage";
import { TextMacroStageError } from "./TextMacroStageError";
import { prepareProjectLaunch } from "./prepareProjectLaunch";

/** Share staging and launch once, retaining uncertain Text paths on every failure boundary. */
export async function runScriptExecution(
  request: IScriptJobRequest,
  options: IScriptExecutionOptions,
): Promise<IScriptExecutionResult> {
  if (options.observationSignal?.aborted === true)
    return { result: { code: null, signal: null }, outcome: "unknown" };
  let stage: TextMacroStage | undefined;
  try {
    stage =
      request.kind === "text"
        ? TextMacroStage.create(request.options)
        : undefined;
  } catch (error) {
    if (error instanceof TextMacroStageError)
      return { result: error.result, outcome: "launch-failed", error };
    throw error;
  }
  const project: IProjectScriptOptions =
    stage === undefined
      ? (request.options as IProjectScriptOptions)
      : { ...request.options, cwd: stage.cwd, entry: stage.stagedPath };
  let execution: IScriptProcessResult;
  try {
    const launch: IPreparedProjectLaunch = prepareProjectLaunch(
      project,
      options.environment,
    );
    execution = await ScriptProcess.run({ launch, ...options });
  } catch (error) {
    execution = {
      result: { code: null, signal: null },
      outcome: "launch-failed",
      error:
        error instanceof Error
          ? error
          : new Error("Script preparation failed."),
    };
  }
  return {
    ...execution,
    result:
      stage === undefined
        ? execution.result
        : stage.finish(execution.result, execution.outcome === "exited"),
  };
}
