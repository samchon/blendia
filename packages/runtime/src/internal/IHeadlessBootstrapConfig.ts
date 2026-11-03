/** Private on-disk handoff, never serialized into public logs or argv. */
export interface IHeadlessBootstrapConfig {
  /** Version of this private one-shot bootstrap/control contract. */
  protocolVersion: 1;
  /** Random ownership identity, matched on readiness and every control message. */
  runId: string;
  /** Absolute private file published by the owned bootstrap. */
  readyPath: string;
  /** One invocation secret for the independent control and scene endpoints. */
  controlToken: string;
  /** Bootstrap waits this many milliseconds for its first authenticated control owner. */
  attachTimeoutMs: number;
}
