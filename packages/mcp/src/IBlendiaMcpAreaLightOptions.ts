import type { BlendiaMcpVector3 } from "./BlendiaMcpVector3";

/** Unparented square area light with existing SDK aim and illumination validation. */
export interface IBlendiaMcpAreaLightOptions {
  /** Requested object name. */
  name?: string;

  /** Exactly three finite world coordinates within absolute 1e20. */
  location: BlendiaMcpVector3;

  /** Exactly three finite target coordinates, distinct from location. */
  target: BlendiaMcpVector3;

  /** Exactly three finite scene-linear RGB components from zero through one; default white. */
  colorLinearRGB?: BlendiaMcpVector3;

  /** Power from zero through 1e12 watts, default 1000. */
  powerWatts?: number;

  /** Side length from 1e-6 through 1e6 Blender units, default 5. */
  size?: number;
}
