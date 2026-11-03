import type { IBlendiaMcpErrorResult } from "./IBlendiaMcpErrorResult";
import type { IBlendiaMcpResult } from "./IBlendiaMcpResult";

/** Typed failure arm used instead of losing Blender error effects in thrown text. */
export interface IBlendiaMcpFailure extends IBlendiaMcpResult<never> {
  /** The operation failed or could not be observed. */
  ok: false;

  /** Failure never publishes a partial successful result. */
  result: null;

  /** Explicit sanitized failure information. */
  error: IBlendiaMcpErrorResult;
}
