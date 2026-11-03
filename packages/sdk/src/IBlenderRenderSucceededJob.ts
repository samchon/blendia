import type { IBlenderArtifact } from "./IBlenderArtifact";
import type { IBlenderRenderJobBase } from "./IBlenderRenderJobBase";

/** Owned PNG captured with verified native-job provenance. */
export interface IBlenderRenderSucceededJob extends IBlenderRenderJobBase {
  /** Verified owned capture completed. */
  status: "succeeded";

  /** UTC ISO completion time. */
  finishedAt: string;

  /** Retained owned PNG, subject to release or expiry. */
  artifact: IBlenderArtifact;
}
