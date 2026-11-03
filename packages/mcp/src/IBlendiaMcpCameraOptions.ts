import type { BlendiaMcpVector3 } from "./BlendiaMcpVector3";

/** Unparented perspective camera aimed with local -Z tracking and +Y up. */
export interface IBlendiaMcpCameraOptions {
  /** Requested object name. */
  name?: string;

  /** Exactly three finite world coordinates within absolute 1e20. */
  location: BlendiaMcpVector3;

  /** Exactly three finite target coordinates, distinct from location. */
  target: BlendiaMcpVector3;

  /** Lens from 1 through 500 millimeters, default 50. */
  lensMm?: number;

  /** Near clipping distance at least 1e-6 and below clipEnd, default 0.1. */
  clipStart?: number;

  /** Far clipping distance at most 1e12 and above clipStart, default 1000. */
  clipEnd?: number;

  /** Permanently select scene.camera when true, default false. */
  setActive?: boolean;
}
