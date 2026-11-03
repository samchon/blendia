/**
 * Direct launcher termination; it does not certify that Blender changes completed or rolled back.
 *
 * @evidence contracts/common.md#principled-implementation Node close-event code and signal are retained separately rather than treating a signal as successful exit.
 * @evidence contracts/common.md#clear-and-simple-design This result describes the launched ttsx process; SDK operation outcomes belong to the project script.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Neither a zero code nor a closed launcher is promoted into proof of Blender state or descendant termination.
 * @evidence contracts/common.md#meaningful-documentation Nullable fields follow Node process outcomes; spawn failures reject the launch promise instead.
 * @evidence contracts/performance.md#efficient-algorithms The result has two scalar fields and retains no script output.
 * @evidence contracts/performance.md#reuse-equivalent-work Each process produces its own termination record without caching.
 * @evidence contracts/performance.md#bound-retention-and-release-resources This record owns no process handle; the launcher resolves it only after the direct child's close event.
 */
export interface IProjectScriptResult {
  /** Numeric exit code, or null when termination was reported by signal. */
  code: number | null;

  /** Reported termination signal, or null for an ordinary exit. */
  signal: NodeJS.Signals | null;
}
