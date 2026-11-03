/**
 * Direct launcher termination; it does not certify that Blender changes completed or rolled back.
 */
export interface IProjectScriptResult {
  /** Numeric exit code, or null when termination was reported by signal. */
  code: number | null;

  /** Reported termination signal, or null for an ordinary exit. */
  signal: NodeJS.Signals | null;
}
