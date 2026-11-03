import type { IBlenderMaterialHandle } from "./IBlenderMaterialHandle";

/** Fresh readback of the newly created opaque Principled parameters. */
export interface IBlenderMaterialSnapshot {
  /** Session and material identity. */
  handle: IBlenderMaterialHandle;

  /** Actual assigned Blender name. */
  name: string;

  /** Scene-linear RGB read from the material. */
  baseColorLinearRGB: [number, number, number];

  /** Actual Principled roughness. */
  roughness: number;

  /** Actual Principled metallic factor. */
  metallic: number;
}
