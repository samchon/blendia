import type { IBlenderObjectHandle } from "./IBlenderObjectHandle";
import type { IBlenderTransform } from "./IBlenderTransform";

/**
 * A nonempty partial local transform addressed to one session-scoped Blender object.
 *
 * @evidence contracts/common.md#principled-implementation The client validates the handle against its authenticated session and all supplied local vectors before sending object.setTransform; Python repeats validation before mutation.
 * @evidence contracts/common.md#clear-and-simple-design Extending IBlenderTransform keeps its coordinate contract in one place while adding the concrete object target.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No name-based fallback, property proxy, or implicit retry is available.
 * @evidence contracts/common.md#meaningful-documentation Local Euler radians use XYZ when changed; absent components preserve their previous values.
 * @evidence contracts/performance.md#efficient-algorithms Validation checks one handle and at most nine numbers; bridge object lookup is separate.
 * @evidence contracts/performance.md#reuse-equivalent-work Repeated updates remain independent effects even when their arguments match.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The input is copied into one bounded encoded request; the caller's handle does not retain Blender data.
 */
export interface IBlenderObjectTransform extends IBlenderTransform {
  /** Exact object identity and lifetime to modify. */
  object: IBlenderObjectHandle;
}
