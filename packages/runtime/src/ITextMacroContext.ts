import type { IProjectScriptOptions } from "./IProjectScriptOptions";

/** Project and intended source identity shared by a Text snapshot and its CLI handoff. */
export interface ITextMacroContext extends Omit<
  IProjectScriptOptions,
  "entry" | "cwd"
> {
  /** Explicit project directory; relative values use the calling process's cwd. */
  cwd: string;

  /** Non-declaration .ts, .tsx, .mts, or .cts path within cwd, with an existing parent. */
  sourcePath: string;

  /** Blender Text label; omission uses the resolved logical source path. */
  origin?: string;
}
