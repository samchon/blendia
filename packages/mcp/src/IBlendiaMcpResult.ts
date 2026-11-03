import type { IBlendiaMcpErrorResult } from "./IBlendiaMcpErrorResult";

/** One object schema for every tool; successful void results also use null. */
export interface IBlendiaMcpResult<T> {
  /** True requires error=null; false requires result=null and a non-null error. */
  ok: boolean;

  /** Actual successful output, or null on failure. Inspect ok before interpreting null. */
  result: T | null;

  /** Sanitized failure information, or null on success. */
  error: IBlendiaMcpErrorResult | null;
}
