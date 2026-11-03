import type { IBlenderObjectHandle } from "./IBlenderObjectHandle";
import type { IBlenderObjectSnapshot } from "./IBlenderObjectSnapshot";

/** Fresh current-scene metadata and one UID-ordered object page. */
export interface IBlenderSceneSnapshot {
  /** Bridge that observed this page. */
  sessionId: string;

  /** Data lifetime of every object in this page. */
  generation: number;

  /** Decimal scene ID.session_uid, independent of its name. */
  sceneId: string;

  /** Current Blender scene name. */
  sceneName: string;

  /** Current scene frame. */
  frame: number;

  /** Current scene camera, or null when unset. */
  activeCamera: IBlenderObjectHandle | null;

  /** Total scene objects at observation time. */
  objectCount: number;

  /** At most the requested number of fresh object snapshots. */
  objects: IBlenderObjectSnapshot[];

  /** Opaque continuation, or null at this observed end. */
  nextCursor: string | null;
}
