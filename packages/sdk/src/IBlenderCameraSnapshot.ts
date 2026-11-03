import type { IBlenderObjectSnapshot } from "./IBlenderObjectSnapshot";

/** Camera object and perspective parameters returned by Blender. */
export interface IBlenderCameraSnapshot extends IBlenderObjectSnapshot {
  /** Readback lens in millimeters. */
  lensMm: number;

  /** Readback near clipping distance. */
  clipStart: number;

  /** Readback far clipping distance. */
  clipEnd: number;

  /** Whether this object is scene.camera. */
  isActive: boolean;
}
