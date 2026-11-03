import type { IHeadlessProjectOptions } from "../IHeadlessProjectOptions";

/** Validated explicit paths and phase-specific observation budgets. */
export interface IPreparedHeadlessProject {
  /** Caller project context; connection options cannot select an unrelated GUI session. */
  options: IHeadlessProjectOptions;
  /** Existing resolved project directory. */
  cwd: string;
  /** Existing explicitly selected Blender binary. */
  executable: string;
  /** Existing bootstrap within the actual explicit extension directory. */
  bootstrap: string;
  /** Optional resolved input .blend before bootstrap execution. */
  blendFile?: string;
  /** Blender readiness/control attachment only; not user TypeScript execution. */
  startupTimeoutMs: number;
  /** Cooperative completion/closure only; never a renderer kill deadline. */
  shutdownTimeoutMs: number;
}
