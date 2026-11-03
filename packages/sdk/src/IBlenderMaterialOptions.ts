/** Create a new owned opaque Principled material using scene-linear RGB. */
export interface IBlenderMaterialOptions {
  /** Requested material name. */
  name?: string;

  /** Scene-linear components from zero through one; alpha is fixed to one. */
  baseColorLinearRGB: [number, number, number];

  /** Zero through one, default 0.5. */
  roughness?: number;

  /** Zero through one, default zero. */
  metallic?: number;
}
