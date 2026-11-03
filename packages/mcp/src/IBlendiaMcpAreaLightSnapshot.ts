import type { BlendiaMcpVector3 } from "./BlendiaMcpVector3";
import type { IBlendiaMcpObjectSnapshot } from "./IBlendiaMcpObjectSnapshot";

/** Native square area light readback with detached local and RGB arrays. */
export interface IBlendiaMcpAreaLightSnapshot extends IBlendiaMcpObjectSnapshot {
  /** Exactly three scene-linear RGB components. */
  colorLinearRGB: BlendiaMcpVector3;

  /** Actual light power in watts. */
  powerWatts: number;

  /** Actual square side length. */
  size: number;
}
