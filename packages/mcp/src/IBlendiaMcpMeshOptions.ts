import type { BlendiaMcpVector3 } from "./BlendiaMcpVector3";

/** Bounded bulk geometry represented with LLM-supported arrays, without topology repair. */
export interface IBlendiaMcpMeshOptions {
  /** Requested name; actual readback may have a collision suffix. */
  name?: string;

  /** At most 8192 vertices, each exactly three finite coordinates within absolute 1e20. */
  vertices: BlendiaMcpVector3[];

  /** At most 8192 polygons and 32768 total corners; SDK validates distinct in-range indices. */
  faces: number[][];
}
