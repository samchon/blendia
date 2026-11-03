/** Published user file; IO is outside Blender undo and transaction rollback. */
export interface IBlenderSavedFile {
  /** Actual absolute destination, without an implicit extension. */
  path: string;

  /** Published file byte count. */
  bytes: number;

  /** Bridge that published this result. */
  sourceSessionId: string;

  /** Artifact start generation for PNG export, or current data generation for a .blend copy. */
  generation: number;
}
