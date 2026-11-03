import type { IBlenderRenderJobBase } from "./IBlenderRenderJobBase";

/** Native work or owned output finalization has not finished. */
export interface IBlenderRenderPendingJob extends IBlenderRenderJobBase {
  /** Native job and finalization are distinct pending states. */
  status: "running" | "finalizing";
}
