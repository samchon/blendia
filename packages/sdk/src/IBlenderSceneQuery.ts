/** Bounded observation of the current scene, without a cross-page snapshot guarantee. */
export interface IBlenderSceneQuery {
  /** Maximum returned objects, default 50 and at most 100. */
  limit?: number;

  /** Opaque continuation issued for this scene and data lifetime. */
  cursor?: string;
}
