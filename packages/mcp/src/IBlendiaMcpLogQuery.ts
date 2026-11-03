import type { IBlendiaMcpJobReference } from "./IBlendiaMcpJobReference";

/** Bounded cursor observation for one owned captured job. */
export interface IBlendiaMcpLogQuery extends IBlendiaMcpJobReference {
  /** Same-job cursor, default zero; retention loss is explicit. */
  cursor?: number;

  /** Requested captured UTF-8 payload budget, default 16384. */
  byteLimit?: number;
}
