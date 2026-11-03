/** Create an unparented square area light aimed with the camera tracking convention. */
export interface IBlenderAreaLightOptions {
  /** Requested object name. */
  name?: string;

  /** Finite world location within absolute 1e20. */
  location: [number, number, number];

  /** Distinct finite world target within absolute 1e20. */
  target: [number, number, number];

  /** Scene-linear components in zero through one; default white. */
  colorLinearRGB?: [number, number, number];

  /** Power from zero through 1e12 watts, default 1000. */
  powerWatts?: number;

  /** Side length from 1e-6 through 1e6 Blender units, default 5. */
  size?: number;
}
