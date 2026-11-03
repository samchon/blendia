/** Rename-stable material identity within one Blender data lifetime. */
export interface IBlenderMaterialHandle {
  /** Bridge that issued the material. */
  sessionId: string;

  /** Data lifetime invalidated by load, undo, or redo. */
  generation: number;

  /** Positive decimal material ID.session_uid, never a JavaScript number. */
  materialId: string;
}
