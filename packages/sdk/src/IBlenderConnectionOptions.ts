/**
 * Connection to the loopback bridge; omitted credentials come from the two Blendia environment variables.
 */
export interface IBlenderConnectionOptions {
  /** TCP port; defaults to BLENDIA_PORT. */
  port?: number;

  /** Session secret; defaults to BLENDIA_TOKEN and is never included in errors. */
  token?: string;

  /** Positive integer milliseconds, at most 2147483647; defaults to 30000. */
  timeoutMs?: number;
}
