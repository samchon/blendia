import type { IBlenderObjectHandle } from "./IBlenderObjectHandle";
import type { IBlenderTransform } from "./IBlenderTransform";

/**
 * A nonempty partial local transform addressed to one session-scoped Blender object.
 */
export interface IBlenderObjectTransform extends IBlenderTransform {
  /** Exact object identity and lifetime to modify. */
  object: IBlenderObjectHandle;
}
