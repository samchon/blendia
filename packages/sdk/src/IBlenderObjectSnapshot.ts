import type { IBlenderObjectHandle } from "./IBlenderObjectHandle";

/**
 * Fresh local-property snapshot returned by a completed Blender object operation.
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
