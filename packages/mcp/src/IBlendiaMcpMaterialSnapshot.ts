import type { IBlenderMaterialHandle } from "@blendia/sdk";

import type { BlendiaMcpVector3 } from "./BlendiaMcpVector3";

/** Fresh opaque Principled readback with a detached scene-linear RGB array. */
export interface IBlendiaMcpMaterialSnapshot {
  /** Session and material identity. */
  handle: IBlenderMaterialHandle;

  /** Actual Blender material name. */
  name: string;

  /** Exactly three scene-linear RGB components read from Blender. */
  baseColorLinearRGB: BlendiaMcpVector3;

  /** Actual Principled roughness. */
  roughness: number;

  /** Actual Principled metallic factor. */
  metallic: number;
}
