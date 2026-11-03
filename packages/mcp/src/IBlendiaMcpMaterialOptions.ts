import type { BlendiaMcpVector3 } from "./BlendiaMcpVector3";

/** Opaque Principled material with scene-linear RGB in the existing SDK intervals. */
export interface IBlendiaMcpMaterialOptions {
  /** Requested material name. */
  name?: string;

  /** Exactly three finite scene-linear RGB components from zero through one. */
  baseColorLinearRGB: BlendiaMcpVector3;

  /** Zero through one, default 0.5. */
  roughness?: number;

  /** Zero through one, default zero. */
  metallic?: number;
}
