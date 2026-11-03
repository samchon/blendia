/**
 * Session-scoped Blender object identity, independent of its mutable name.
 *
 * Rename preserves the handle. Deletion, file loading, undo, or redo can invalidate it; neither its name nor a memory address is used as a fallback.
 */
export interface IBlenderObjectHandle {
  /** Bridge-start identity that issued this handle. */
  sessionId: string;

  /** Data lifetime in which the object was observed. */
  generation: number;

  /** Positive decimal ID.session_uid, transmitted without numeric coercion. */
  objectId: string;
}
