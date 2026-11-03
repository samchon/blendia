import type { IBlenderObjectHandle } from "@blendia/sdk";

import type { IBlendiaMcpObjectSnapshot } from "./IBlendiaMcpObjectSnapshot";

/** One fresh scene page; every nested object's coordinate arrays are detached. */
export interface IBlendiaMcpSceneSnapshot {
  /** Bridge that observed this page. */
  sessionId: string;

  /** SDK data lifetime of every returned object. */
  generation: number;

  /** Decimal scene UID, independent of its name. */
  sceneId: string;

  /** Current scene name. */
  sceneName: string;

  /** Current frame. */
  frame: number;

  /** Current camera handle, or null when unset. */
  activeCamera: IBlenderObjectHandle | null;

  /** Total scene object population at observation. */
  objectCount: number;

  /** At most one requested page of fresh object readbacks. */
  objects: IBlendiaMcpObjectSnapshot[];

  /** Opaque SDK continuation, or null at this observed end. */
  nextCursor: string | null;
}
