/**
 * Session-scoped Blender object identity, independent of its mutable name.
 *
 * @evidence contracts/common.md#principled-implementation The bridge resolves a decimal ID.session_uid string freshly against Blender data and rejects the wrong session or generation before accessing the object.
 * @evidence contracts/common.md#clear-and-simple-design The three fields distinguish process ownership, data lifetime, and object identity without retaining an RNA wrapper.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts objectId remains a string to avoid JavaScript integer rounding; a name or memory address is not substituted.
 * @evidence contracts/common.md#meaningful-documentation Rename preserves identity; deletion, load, undo, or redo can make the handle stale and require a new read or connection.
 * @evidence contracts/performance.md#efficient-algorithms Local validation examines the identifier strings; Blender lookup cost belongs to the bridge.
 * @evidence contracts/performance.md#reuse-equivalent-work Handles identify data but do not cache snapshots or make repeated mutations equivalent.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The record holds only scalar identity; it acquires no Blender reference and callers release it through ordinary garbage collection.
 */
export interface IBlenderObjectHandle {
  /** Bridge-start identity that issued this handle. */
  sessionId: string;

  /** Data lifetime in which the object was observed. */
  generation: number;

  /** Positive decimal ID.session_uid, transmitted without numeric coercion. */
  objectId: string;
}
