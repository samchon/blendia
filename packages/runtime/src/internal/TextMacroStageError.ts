import type { ITextMacroResult } from "../ITextMacroResult";

/** A failed exclusive write/close still reports the runtime-owned path requiring retention. */
export class TextMacroStageError extends Error {
  /** Carry the retained disposition without pretending a process was launched. */
  public constructor(
    message: string,
    public readonly result: ITextMacroResult,
  ) {
    super(message);
  }
}
