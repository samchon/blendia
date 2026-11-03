import type { ITextMacroContext } from "@blendia/runtime";

/** Read one explicit editor snapshot before staging it in its declared project. */
export interface IBlendiaTextCommand {
  /** Select bounded Text snapshot execution rather than a saved project entry. */
  kind: "run-text";

  /** Project and logical origin shared with the runtime, before input is read. */
  options: ITextMacroContext;

  /** Explicit UTF-8 input path relative to options.cwd; its creator retains ownership. */
  inputFile: string;
  /** Capture and render bounded JSONL observations; absent preserves inherited streams. */
  jsonl?: true;
}
