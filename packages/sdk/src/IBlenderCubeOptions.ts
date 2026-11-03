/**
 * Parameters for one cube mesh linked into the active scene's collection.
 *
 * @evidence contracts/common.md#principled-implementation The bridge creates an eight-vertex six-face cube of positive finite edge size up to 1e20, defaulting to two Blender units, and returns Blender's actual assigned object name.
 * @evidence contracts/common.md#clear-and-simple-design Only name and edge size belong to creation; later local changes use setTransform.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Creation is one effectful request with no idempotency claim or automatic replay.
 * @evidence contracts/common.md#meaningful-documentation Name collisions can change the resulting name; size is the unscaled local mesh edge length.
 * @evidence contracts/performance.md#efficient-algorithms Argument validation is linear in the requested name length; generated cube topology is fixed.
 * @evidence contracts/performance.md#reuse-equivalent-work Repeated calls create distinct objects even when arguments match.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The argument owns no resources; created Blender data remains in the scene after client disconnect.
 */
export interface IBlenderCubeOptions {
  /** Requested nonempty object name; Blender may add a collision suffix. */
  name?: string;

  /** Positive finite edge length, at most 1e20 Blender units; defaults to 2. */
  size?: number;
}
