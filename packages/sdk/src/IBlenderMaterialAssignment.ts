import type { IBlenderMaterialHandle } from "./IBlenderMaterialHandle";
import type { IBlenderObjectHandle } from "./IBlenderObjectHandle";

/** Replace all polygon material assignments on one local single-user mesh. */
export interface IBlenderMaterialAssignment {
  /** Mesh object whose sole DATA slot becomes this material; shared or linked data is rejected. */
  object: IBlenderObjectHandle;

  /** Material from the same session and generation. */
  material: IBlenderMaterialHandle;
}
