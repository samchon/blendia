/** Process-local captured job selected within this controller lifetime. */
export interface IBlendiaMcpJobReference {
  /** Identifier returned by startScript, never a native render identity. */
  jobId: string;
}
