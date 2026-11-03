import type { IBlenderObjectSnapshot } from "./IBlenderObjectSnapshot";

/** Fresh mesh object readback after bulk creation. */
export interface IBlenderMeshSnapshot extends IBlenderObjectSnapshot {
  /** Actual mesh vertex population. */
  vertexCount: number;

  /** Actual inferred edge population. */
  edgeCount: number;

  /** Actual polygon population. */
  polygonCount: number;
}
