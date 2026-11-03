/**
 * Bridge or local client failure with explicit information about possible scene effects.
 *
 * @evidence contracts/common.md#principled-implementation Known server errors retain their code and effects; transport loss or invalid responses after a sent mutation produce OUTCOME_UNKNOWN with possible effects.
 * @evidence contracts/common.md#clear-and-simple-design One error type carries a machine-readable code and effect classification without copying credentials or request payloads into messages.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Possible effects never imply rollback, cancellation, or permission to retry a mutation.
 * @evidence contracts/common.md#meaningful-documentation effects none means this failed operation made no reported scene changes; possible requires observing the scene before deciding recovery.
 * @evidence contracts/performance.md#efficient-algorithms Construction stores bounded scalar metadata plus the standard Error stack and optional cause.
 * @evidence contracts/performance.md#reuse-equivalent-work Each failure is a separate observation and is not memoized.
 * @evidence contracts/performance.md#bound-retention-and-release-resources An error owns no socket; an optional cause remains alive as long as its caller retains the error.
 */
export class BlenderError extends Error {
  /** Stable bridge or SDK category, including OUTCOME_UNKNOWN after a lost mutation response. */
  public readonly code: string;

  /** Whether this operation may have changed Blender data. */
  public readonly effects: "none" | "possible";

  /** Preserve the failure category without embedding secrets or request bodies. */
  public constructor(
    code: string,
    message: string,
    effects: "none" | "possible" = "none",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "BlenderError";
    this.code = code;
    this.effects = effects;
  }
}
