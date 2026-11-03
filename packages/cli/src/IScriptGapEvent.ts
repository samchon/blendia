/** Explicit cursor advancement after a consumer falls behind bounded retention. */
export interface IScriptGapEvent {
  /** Select explicit retention loss, not child-generated output. */
  type: "gap";
  /** Process-local job identity. */
  id: string;
  /** Registry incarnation matching its snapshots. */
  ownerId: string;
  /** First entry still retained when the page was read. */
  earliestCursor: number;
  /** Advance the consumer to earliestCursor before the following entries. */
  nextCursor: number;
}
