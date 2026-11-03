import type { ITextMacroResult } from "../ITextMacroResult";

/** A failed exclusive write/close still reports the runtime-owned path requiring retention. */
export class TextMacroStageError extends Error {
  /** Owned path and retained disposition after a failed exclusive staging write or close. */
  public readonly result: ITextMacroResult;

  /** Carry the retained disposition without pretending a process was launched. */
  public constructor(message: string, result: ITextMacroResult) {
    super(message);
    this.result = result;
  }
}
