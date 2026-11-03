/** Sanitized observations of a real native preparation or readback process. */
export interface INativeBlenderObservation {
  /** Named preparation/readback responsibility, never a credential or raw command line. */
  stage: string;

  /** UTC observation time rather than a claim of kernel process creation time. */
  observedAt: string;

  /** Native spawn confirmation, close, launcher error, or expired observation. */
  event: "spawn" | "close" | "error" | "observation-expired";

  /** Direct owned PID when Node observed a spawn; null does not invent a process. */
  pid: number | null;

  /** Separate native observation outcome; uncertainty is never a passing termination. */
  outcome: "running" | "exited" | "launch-failed" | "unknown";

  /** Native close or current process-handle status, which may remain null. */
  code: number | null;

  /** Native close or current process-handle signal, which may remain null. */
  signal: NodeJS.Signals | null;

  /** Budget for native preparation/readback only; no whole-script deadline is imposed. */
  observationBudgetMs: number;
}
