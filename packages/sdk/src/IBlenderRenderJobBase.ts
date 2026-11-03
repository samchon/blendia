import type { IBlenderRenderHandle } from "./IBlenderRenderHandle";

/** Immutable provenance of a native Blender render, distinct from a TS process job. */
export interface IBlenderRenderJobBase {
  /** Caller-known native job identity. */
  handle: IBlenderRenderHandle;

  /** Data generation at invocation, preserved after later changes. */
  startGeneration: number;

  /** Decimal UID of the rendered scene. */
  sceneId: string;

  /** Scene name at invocation. */
  sceneName: string;

  /** Decimal UID of the selected camera at invocation. */
  cameraObjectId: string;

  /** Native engine used for this render. */
  engine: string;

  /** Scene frame rendered. */
  frame: number;

  /** Requested persistent pixel width. */
  width: number;

  /** Requested persistent pixel height. */
  height: number;

  /** UTC ISO timestamp of invocation. */
  startedAt: string;
}
