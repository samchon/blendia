import type { IBlenderRenderFailedJob } from "./IBlenderRenderFailedJob";
import type { IBlenderRenderPendingJob } from "./IBlenderRenderPendingJob";
import type { IBlenderRenderSucceededJob } from "./IBlenderRenderSucceededJob";

/** Discriminated native render observation; pending states do not imply cancellation support. */
export type BlenderRenderJob =
  | IBlenderRenderPendingJob
  | IBlenderRenderSucceededJob
  | IBlenderRenderFailedJob;
