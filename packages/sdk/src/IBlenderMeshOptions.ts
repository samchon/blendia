/** One bounded low-poly mesh; indices reference vertices and edges are inferred. */
export interface IBlenderMeshOptions {
  /** Requested name; the snapshot reports the actual Blender name. */
  name?: string;

  /** At most 8192 finite coordinates within absolute 1e20. */
  vertices: [number, number, number][];

  /** At most 8192 polygons and 32768 total corners; each polygon has at least three distinct in-range indices. */
  faces: number[][];
}
