import type { IBlenderArtifactHandle } from "./IBlenderArtifactHandle";
import type { IBlenderSaveOptions } from "./IBlenderSaveOptions";

/** Export a retained PNG without aliasing the private artifact inode. */
export interface IBlenderArtifactSaveOptions extends IBlenderSaveOptions {
  /** Owned image to export at the explicit PNG destination. */
  artifact: IBlenderArtifactHandle;
}
