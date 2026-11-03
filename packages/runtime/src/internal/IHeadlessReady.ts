/** Validated private readiness for this invocation, never a public discovery result. */
export interface IHeadlessReady {
  /** Private protocol version shared with the selected installed bootstrap. */
  protocolVersion: 1;
  /** Exact runtime-generated ownership identity. */
  runId: string;
  /** Fixed loopback endpoint; no caller-supplied remote host. */
  host: "127.0.0.1";
  /** Scene bridge endpoint used only by the user's ScriptJob SDK. */
  port: number;
  /** Private invocation secret, checked against the original config. */
  token: string;
  /** Fresh Blender session identity, not portable from a GUI instance. */
  sessionId: string;
  /** Separate private control endpoint, never a scene writer lease. */
  controlPort: number;
}
