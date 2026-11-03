import type { IBlendiaMcpErrorResult } from "./IBlendiaMcpErrorResult";

/** Typed failure arm used instead of losing Blender error effects in thrown text. */
export interface IBlendiaMcpFailure {
  /** The operation failed or could not be observed. */
  ok: false;

  /** Explicit sanitized failure information. */
  error: IBlendiaMcpErrorResult;
}
