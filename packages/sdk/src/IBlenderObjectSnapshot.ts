import type { IBlenderObjectHandle } from "./IBlenderObjectHandle";

/**
 * Fresh local-property snapshot returned by a completed Blender object operation.
 *
 * @evidence contracts/common.md#principled-implementation The bridge reads name, type, and transform from the freshly resolved object after an operation; the SDK validates each field and the handle against its authenticated identity.
 * @evidence contracts/common.md#clear-and-simple-design The value is data rather than a live proxy; future observations require another async getObject call.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Local properties are not presented as evaluated world geometry or proof of a rendered result.
 * @evidence contracts/common.md#meaningful-documentation rotationEuler contains local Euler properties in radians; mutations through this SDK use XYZ and do not promise other rotation modes are evaluated as XYZ.
 * @evidence contracts/performance.md#efficient-algorithms Snapshot validation scans fixed fields and bounded strings, independently of scene topology.
 * @evidence contracts/performance.md#reuse-equivalent-work Snapshots are not cached; matching values do not identify equivalent effectful requests.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns the returned record and arrays; neither the socket nor Blender wrappers are retained by it.
 */
export interface IBlenderObjectSnapshot {
  /** Session and data lifetime of the returned object. */
  handle: IBlenderObjectHandle;

  /** Actual current Blender name, including collision suffixes. */
  name: string;

  /** Blender object type such as MESH. */
  type: string;

  /** Local translation in Blender units. */
  location: [number, number, number];

  /** Local Euler property values in radians, not evaluated world rotation. */
  rotationEuler: [number, number, number];

  /** Local scale factors. */
  scale: [number, number, number];
}
