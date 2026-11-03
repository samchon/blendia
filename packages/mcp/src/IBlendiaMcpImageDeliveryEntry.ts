import type { IBlendiaMcpImagePayload } from "./IBlendiaMcpImagePayload";
import type { IBlendiaMcpImageResult } from "./IBlendiaMcpImageResult";

/** One private delivery bound to its original request and immutable metadata. */
export interface IBlendiaMcpImageDeliveryEntry {
  /** Original JSON-RPC readImage request identity, including its scalar type. */
  requestId: string | number;

  /** Metadata returned through the validated public tool result. */
  metadata: IBlendiaMcpImageResult;

  /** Raw bytes that must not appear in structuredContent. */
  payload: IBlendiaMcpImagePayload;

  /** Millisecond deadline, no later than native artifact expiry. */
  expiresAt: number;
}
