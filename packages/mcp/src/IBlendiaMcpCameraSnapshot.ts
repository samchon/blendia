import type { IBlendiaMcpObjectSnapshot } from "./IBlendiaMcpObjectSnapshot";

/** Native camera parameters and detached local properties. */
export interface IBlendiaMcpCameraSnapshot extends IBlendiaMcpObjectSnapshot {
  /** Readback lens in millimeters. */
  lensMm: number;

  /** Readback near clipping distance. */
  clipStart: number;

  /** Readback far clipping distance. */
  clipEnd: number;

  /** Whether this object is scene.camera. */
  isActive: boolean;
}
