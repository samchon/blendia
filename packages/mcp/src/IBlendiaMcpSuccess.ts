/** Typed successful tool result preserved unchanged as structuredContent. */
export interface IBlendiaMcpSuccess<T> {
  /** The declared result is present. */
  ok: true;

  /** Validated service output. */
  result: T;
}
