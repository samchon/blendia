import type { IProjectScriptOptions } from "@blendia/runtime";

/** Run one admitted project entry using the shared runtime request. */
export interface IBlendiaRunCommand {
  /** Select project execution rather than terminal help. */
  kind: "run";

  /** Entry, project paths, and script-owned arguments admitted by the CLI parser. */
  options: IProjectScriptOptions;
}
