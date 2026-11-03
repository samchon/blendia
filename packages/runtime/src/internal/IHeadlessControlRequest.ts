/** One bounded authenticated private lifecycle request; never a scene command. */
export interface IHeadlessControlRequest {
  /** Private bootstrap contract version. */
  protocolVersion: 1;
  /** Exact invocation identity. */
  runId: string;
  /** Private invocation secret, never echoed by replies. */
  token: string;
  /** Attach before script execution, finish only after its terminal observation. */
  method: "attach" | "finish";
}
