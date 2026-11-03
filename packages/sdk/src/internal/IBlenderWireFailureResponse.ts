import type { IBlenderWireError } from "./IBlenderWireError";

/**
 * The failed arm of a version-one bridge response, including failures before authentication.
 *
 * Authenticated errors require the server's current identity even when rejecting a stale generation. Only failures before authentication may omit it.
 */
export interface IBlenderWireFailureResponse {
  /** Decimal request correlation ID. */
  id: string;

  /** Current server bridge identity when authenticated. */
  sessionId?: string;

  /** Current server data lifetime when authenticated. */
  generation?: number;

  /** Failure discriminant. */
  ok: false;

  /** Server category and the possible scene effects of this operation. */
  error: IBlenderWireError;
}
