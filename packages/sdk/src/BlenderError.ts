/**
 * Bridge or local client failure with explicit information about possible scene effects.
 *
 * A lost response after a sent mutation uses OUTCOME_UNKNOWN with possible effects. Possible never promises rollback or authorizes an automatic retry; inspect the scene before deciding recovery.
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
