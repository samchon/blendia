/**
 * Parameters for one cube mesh linked into the active scene's collection.
 */
export interface IBlenderCubeOptions {
  /** Requested nonempty object name; Blender may add a collision suffix. */
  name?: string;

  /** Positive finite edge length, at most 1e20 Blender units; defaults to 2. */
  size?: number;
}
