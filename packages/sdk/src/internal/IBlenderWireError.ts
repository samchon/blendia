/**
 * A bridge-reported failure whose effect classification describes the failed operation.
 *
 * The client accepts this classification only after validating the response envelope, including authenticated session identity.
 */
export interface IBlenderWireError {
  /** Machine-readable bridge error category. */
  code: string;

  /** Human-readable diagnostic without the connection token. */
  message: string;

  /** Whether the failed operation may already have changed scene data. */
  effects: "none" | "possible";
}
