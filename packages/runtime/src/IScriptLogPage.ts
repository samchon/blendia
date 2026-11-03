import type { IScriptLogEntry } from "./IScriptLogEntry";

/** A bounded payload page, with explicit retention loss rather than silent skipping. */
export interface IScriptLogPage {
  /** Detached copies with at most 128 entries and the requested UTF-8 payload budget. */
  entries: IScriptLogEntry[];
  /** Oldest retained entry, or the current tail when retention is empty. */
  earliestCursor: number;
  /** First entry not returned; pass this to the next read of this same job. */
  nextCursor: number;
  /** Requested entries were already dropped from bounded retention. */
  gap: boolean;
  /** Additional observed entries remain after nextCursor. */
  hasMore: boolean;
}
