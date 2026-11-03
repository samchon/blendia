/** Public failure projection without private configuration, causes, or request bodies. */
export interface IBlendiaMcpErrorResult {
  /** Stable failure category. */
  code: string;

  /** Bounded known-token-redacted diagnostic. */
  message: string;

  /** Possible scene/process/file effects never promise rollback or replay. */
  effects: "none" | "possible";
}
