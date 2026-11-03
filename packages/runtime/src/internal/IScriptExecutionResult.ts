import type { ITextMacroResult } from "../ITextMacroResult";
import type { IScriptProcessResult } from "./IScriptProcessResult";

/** Internal execution outcome may retain a private error for the inherited API. */
export interface IScriptExecutionResult extends IScriptProcessResult {
  /** Shared launcher outcome, with Text identity/cleanup disposition when staging occurred. */
  result: IScriptProcessResult["result"] | ITextMacroResult;
}
