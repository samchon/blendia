import type { ITextMacroContext } from "./ITextMacroContext";

/** An editor snapshot that runs as a sibling module without replacing its logical source. */
export interface ITextMacroOptions extends ITextMacroContext {
  /** Text encoded as UTF-8 without a line wrapper, limited to TEXT_MACRO_MAX_BYTES. */
  text: string;
}
