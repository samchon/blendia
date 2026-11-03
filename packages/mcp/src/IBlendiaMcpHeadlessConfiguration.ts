/** Private factory configuration, excluded from the generated model-tool surface. */
export interface IBlendiaMcpHeadlessConfiguration {
  /** Explicit owned-child executable. */
  blenderExecutable: string;

  /** Actual extracted extension root. */
  extensionDirectory: string;

  /** Private readiness observation deadline. */
  startupTimeoutMs?: number;

  /** Private cooperative closure observation deadline. */
  shutdownTimeoutMs?: number;
}
