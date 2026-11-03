/**
 * Validated version-one response envelope; unauthenticated errors may omit session identity.
 *
 * @evidence contracts/common.md#principled-implementation BlenderProtocol.response validates the discriminant, correlation ID, identity fields, and either result presence or the complete error before the client uses this union.
 * @evidence contracts/common.md#clear-and-simple-design Success and failure carry distinct fields while retaining common request correlation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An authenticated stale-generation error is allowed to carry the server's current identity and must remain visible to the caller.
 * @evidence contracts/common.md#meaningful-documentation The optional identity exists only for parse or authentication failures; successful replies require both fields at client dispatch.
 * @evidence contracts/performance.md#efficient-algorithms Validation is a fixed-field pass over an already frame-bounded JSON value.
 * @evidence contracts/performance.md#reuse-equivalent-work IDs correlate one request and do not authorize idempotent retries or deduplication.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Each envelope is consumed immediately by the one pending request; there is no response history.
 */
export type IBlenderWireResponse =
  | {
      /** Decimal request correlation ID. */
      id: string;

      /** Current server bridge identity when authenticated. */
      sessionId?: string;

      /** Current server data lifetime when authenticated. */
      generation?: number;

      /** Success discriminant. */
      ok: true;

      /** Method-specific result, checked before returning it to the caller. */
      result: unknown;
    }
  | {
      /** Decimal request correlation ID. */
      id: string;

      /** Current server bridge identity when authenticated. */
      sessionId?: string;

      /** Current server data lifetime when authenticated. */
      generation?: number;

      /** Failure discriminant. */
      ok: false;

      /** Server failure category and the possible scene effects of this operation. */
      error: {
        /** Machine-readable bridge error category. */
        code: string;

        /** Diagnostic without the connection token. */
        message: string;

        /** Explicit operation outcome classification. */
        effects: "none" | "possible";
      };
    };
