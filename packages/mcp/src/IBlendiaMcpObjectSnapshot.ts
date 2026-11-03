import type { IBlenderObjectHandle } from "@blendia/sdk";

import type { BlendiaMcpVector3 } from "./BlendiaMcpVector3";

/** Fresh local object readback with detached LLM-supported coordinate arrays. */
export interface IBlendiaMcpObjectSnapshot {
  /** Exact SDK object identity and data lifetime. */
  handle: IBlenderObjectHandle;

  /** Actual current Blender name. */
  name: string;

  /** Blender object type such as MESH. */
  type: string;

  /** Exactly three local translation components in Blender units. */
  location: BlendiaMcpVector3;

  /** Exactly three local Euler property values in radians, not world rotation. */
  rotationEuler: BlendiaMcpVector3;

  /** Exactly three local scale components. */
  scale: BlendiaMcpVector3;
}
