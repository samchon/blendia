import type { IBlendiaMcpResult } from "./IBlendiaMcpResult";

/** Typed successful tool result preserved unchanged as structuredContent. */
export interface IBlendiaMcpSuccess<T> extends IBlendiaMcpResult<T> {
  /** The declared result is present. */
  ok: true;

  /** Validated service output. */
  result: T;

  /** Success never carries a failure. */
  error: null;
}
