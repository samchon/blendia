/**
 * Inspect credential descriptors in one explicitly selected directory.
 *
 * Discovery does not open sockets unless probe is true. A probe briefly reserves an idle bridge connection and never steals a busy owner's connection.
 */
export interface IBlenderDiscoveryOptions {
  /** Directory containing the extension's session-*.json credential files; never searched recursively. */
  directory: string;

  /** Explicit permission for at most eight sequential hello/disconnect observations. */
  probe?: boolean;

  /** Per-step milliseconds from 100 through 5000, default 1000; specifying it requires probe. */
  probeTimeoutMs?: number;
}
