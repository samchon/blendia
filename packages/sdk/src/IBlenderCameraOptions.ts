/** Create an unparented perspective camera aimed with local -Z tracking and +Y up. */
export interface IBlenderCameraOptions {
  /** Requested object name. */
  name?: string;

  /** World location, finite and within absolute 1e20. */
  location: [number, number, number];

  /** Distinct world target, finite and within absolute 1e20. */
  target: [number, number, number];

  /** Lens from 1 through 500 millimeters, default 50. */
  lensMm?: number;

  /** Near clipping distance, at least 1e-6 and below clipEnd; default 0.1. */
  clipStart?: number;

  /** Far clipping distance, at most 1e12 and above clipStart; default 1000. */
  clipEnd?: number;

  /** Permanently select scene.camera when true; default false. */
  setActive?: boolean;
}
