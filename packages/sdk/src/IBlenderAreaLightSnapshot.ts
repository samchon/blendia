import type { IBlenderObjectSnapshot } from "./IBlenderObjectSnapshot";

/** Area-light object and illumination readback. */
export interface IBlenderAreaLightSnapshot extends IBlenderObjectSnapshot {
  /** Actual scene-linear light color. */
  colorLinearRGB: [number, number, number];

  /** Actual light power in watts. */
  powerWatts: number;

  /** Actual square side length. */
  size: number;
}
