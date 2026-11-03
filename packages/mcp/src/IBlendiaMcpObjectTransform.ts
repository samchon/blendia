import type { IBlenderObjectHandle } from "@blendia/sdk";

import type { BlendiaMcpVector3 } from "./BlendiaMcpVector3";

/** Nonempty local transform; SDK identity, component bounds, and XYZ rotation semantics remain authoritative. */
export interface IBlendiaMcpObjectTransform {
  /** Current-generation object identity. */
  object: IBlenderObjectHandle;

  /** Three finite local translation components in Blender units. */
  location?: BlendiaMcpVector3;

  /** Three finite XYZ Euler angles in radians. */
  rotationEuler?: BlendiaMcpVector3;

  /** Three finite local scale components; zero and negative values are permitted. */
  scale?: BlendiaMcpVector3;
}
