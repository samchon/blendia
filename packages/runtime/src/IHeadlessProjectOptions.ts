import type { IProjectScriptOptions } from "./IProjectScriptOptions";

/** A fresh owned background Blender for one saved project script, never an existing GUI session. */
export interface IHeadlessProjectOptions extends Omit<
  IProjectScriptOptions,
  "connection"
> {
  /** Explicit Blender executable path, resolved against cwd; no executable discovery. */
  blenderExecutable: string;

  /** Actual extracted extension root containing headless_bootstrap.py and its colocated core. */
  extensionDirectory: string;

  /** Optional input .blend loaded before bootstrap; absence uses factory startup data. */
  blendFile?: string;

  /** Readiness plus control authentication deadline, 100..3600000 ms; defaults to 120000. */
  startupTimeoutMs?: number;

  /** Cooperative completion/exit observation deadline, 100..3600000 ms; defaults to 10000. */
  shutdownTimeoutMs?: number;
}
