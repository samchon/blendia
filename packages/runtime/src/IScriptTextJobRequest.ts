import type { ITextMacroOptions } from "./ITextMacroOptions";

/** A bounded Text snapshot staged beside its intended module. */
export interface IScriptTextJobRequest {
  /** Select exclusive sibling staging before launch. */
  kind: "text";
  /** Snapshot text and project context, never exposed as raw options. */
  options: ITextMacroOptions;
}
