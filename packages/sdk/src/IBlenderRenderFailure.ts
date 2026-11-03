/** Sanitized native render failure without an automatic retry or rollback promise. */
export interface IBlenderRenderFailure {
  /** Bridge failure category. */
  code: string;

  /** Human-readable bridge diagnostic. */
  message: string;

  /** Whether invocation or scene-setting changes may have occurred. */
  effects: "none" | "possible";
}
