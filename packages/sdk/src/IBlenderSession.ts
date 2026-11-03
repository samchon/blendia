/**
 * Identity and capabilities authenticated by the bridge's protocol-version-one handshake.
 *
 * @evidence contracts/common.md#principled-implementation The server creates sessionId at bridge start and increments generation when prior object references may be invalid; the client checks identity on every successful response.
 * @evidence contracts/common.md#clear-and-simple-design One immutable-by-convention snapshot describes the connection rather than a global active Blender.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No hostname, scene state, or API parity is inferred from this metadata.
 * @evidence contracts/common.md#meaningful-documentation generation invalidates handles; blenderVersion is a server-reported display string and capabilities enumerate actual supported commands.
 * @evidence contracts/performance.md#efficient-algorithms Metadata storage is linear in the bounded handshake payload and capability strings.
 * @evidence contracts/performance.md#reuse-equivalent-work Session identity scopes handles; metadata is reused only within this authenticated connection.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The client retains one snapshot; session getters copy its capability array and callers own returned snapshots.
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
