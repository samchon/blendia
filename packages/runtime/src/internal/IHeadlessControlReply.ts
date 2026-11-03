/** Credential-free acknowledgment from the private main-thread pump. */
export interface IHeadlessControlReply {
  /** Private bootstrap contract version. */
  protocolVersion: 1;
  /** Exact invocation identity. */
  runId: string;
  /** Only successful acknowledgments are admitted by the runtime. */
  ok: true;
  /** Attached proves pump readiness; finishing requests closure, not completed exit. */
  phase: "attached" | "finishing";
}
