import type { IProjectScriptOptions } from "./IProjectScriptOptions";

/** A saved project module, executed without copying its source. */
export interface IScriptFileJobRequest {
  /** Select direct execution of the existing module. */
  kind: "file";
  /** Original source entry and project/connection context, never exposed in a snapshot. */
  options: IProjectScriptOptions;
}
