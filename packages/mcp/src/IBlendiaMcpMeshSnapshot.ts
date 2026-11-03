import type { IBlendiaMcpObjectSnapshot } from "./IBlendiaMcpObjectSnapshot";

/** Fresh bulk mesh readback, retaining SDK counts and detached local properties. */
export interface IBlendiaMcpMeshSnapshot extends IBlendiaMcpObjectSnapshot {
  /** Actual mesh vertex population. */
  vertexCount: number;

  /** Actual inferred edge population. */
  edgeCount: number;

  /** Actual polygon population. */
  polygonCount: number;
}
