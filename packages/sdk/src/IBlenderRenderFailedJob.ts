import type { IBlenderRenderFailure } from "./IBlenderRenderFailure";
import type { IBlenderRenderJobBase } from "./IBlenderRenderJobBase";

/** Terminal native cancellation, failure, or uncertain output ownership. */
export interface IBlenderRenderFailedJob extends IBlenderRenderJobBase {
  /** Actual cancellation, known failure, or uncertain provenance. */
  status: "cancelled" | "failed" | "unknown";

  /** UTC terminal observation time. */
  finishedAt: string;

  /** Explicit effect and failure information; no artifact is certified. */
  error: IBlenderRenderFailure;
}
