/**
 * The successful arm of a version-one bridge response.
 *
 * The client requires authenticated identity before accepting success and validates the method-specific result before returning public data.
 */
export interface IBlenderWireSuccessResponse {
  /** Decimal request correlation ID. */
  id: string;

  /** Current server bridge identity, required by client dispatch on success. */
  sessionId?: string;

  /** Current server data lifetime, required by client dispatch on success. */
  generation?: number;

  /** Success discriminant. */
  ok: true;

  /** Method-specific result validated by the receiving operation. */
  result: unknown;
}
