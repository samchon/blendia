import type { IHeadlessControlReply } from "./IHeadlessControlReply";

/** Exactly one bounded private control acknowledgment can be outstanding. */
export interface IHeadlessControlPending {
  /** Expected acknowledgment phase for the current request. */
  phase: IHeadlessControlReply["phase"];
  /** Complete a fully validated reply. */
  resolve: (reply: IHeadlessControlReply) => void;
  /** Fail with a fixed finding, never foreign credential-bearing text. */
  reject: (error: Error) => void;
  /** Per-request bounded observation timer. */
  timer: NodeJS.Timeout;
}
