/**
 * Identity and capabilities authenticated by the bridge's protocol-version-one handshake.
 */
export interface IBlenderSession {
  /** The only protocol version implemented by this SDK. */
  protocolVersion: 1;

  /** Bridge-start identity, distinct from a Blender file path. */
  sessionId: string;

  /** Nonnegative safe integer changed after load, undo, or redo. */
  generation: number;

  /** Blender version reported by the connected process. */
  blenderVersion: string;

  /** Supported bridge method names. */
  capabilities: string[];
}
