/**
 * Connection to the loopback bridge; omitted credentials come from the two Blendia environment variables.
 *
 * @evidence contracts/common.md#principled-implementation BlenderClient.connect resolves explicit port and token before BLENDIA_PORT and BLENDIA_TOKEN, then validates the port and finite timeout before opening a socket.
 * @evidence contracts/common.md#clear-and-simple-design Only credentials and one timeout are configurable; the bridge is deliberately restricted to 127.0.0.1.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No discovery, global Node changes, or fallback to a different Blender endpoint is implied.
 * @evidence contracts/common.md#meaningful-documentation timeoutMs covers socket connection and each response independently; it does not cancel Blender execution.
 * @evidence contracts/performance.md#efficient-algorithms The record has three scalar fields and does not scale with scene size.
 * @evidence contracts/performance.md#reuse-equivalent-work Credentials identify a new connection; calls do not pool or share sockets.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The client copies these scalars and owns the resulting socket until disconnect or failure.
 */
export interface IBlenderConnectionOptions {
  /** TCP port; defaults to BLENDIA_PORT. */
  port?: number;

  /** Session secret; defaults to BLENDIA_TOKEN and is never included in errors. */
  token?: string;

  /** Positive integer milliseconds, at most 2147483647; defaults to 30000. */
  timeoutMs?: number;
}
