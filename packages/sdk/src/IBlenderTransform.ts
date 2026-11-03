/**
 * Optional local-space transform components; Euler angles are XYZ radians and each supplied component is finite within absolute 1e20.
 *
 * @evidence contracts/common.md#principled-implementation setTransform validates every supplied three-component vector before transmission and the bridge validates again before any mutation; absent fields preserve existing values.
 * @evidence contracts/common.md#clear-and-simple-design One partial transform is shared by the setter without adding a graph or property proxy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Empty updates and nonfinite vectors are rejected rather than silently ignored or serialized as null.
 * @evidence contracts/common.md#meaningful-documentation Values describe local Blender properties, not world or evaluated transforms; Euler updates explicitly use XYZ rotation mode.
 * @evidence contracts/performance.md#efficient-algorithms At most nine numbers are inspected; cost is independent of scene size.
 * @evidence contracts/performance.md#reuse-equivalent-work Every update is effectful and is neither cached nor retried.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The argument is serialized for one request; no input arrays are retained after encoding.
 */
export interface IBlenderTransform {
  /** Local translation in the scene's Blender units. */
  location?: [number, number, number];

  /** Local XYZ Euler angles in radians; changes rotation mode to XYZ. */
  rotationEuler?: [number, number, number];

  /** Local scale factors; zero and negative components are permitted. */
  scale?: [number, number, number];
}
