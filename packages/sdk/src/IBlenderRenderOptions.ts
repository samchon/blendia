/** Start a native GUI render using the current scene camera, frame, and engine. */
export interface IBlenderRenderOptions {
  /** Caller-known canonical UUID retained before transmission; duplicate IDs are rejected without replay. */
  renderId: string;

  /** Persistent output width within outer bound 1..4096, default 512; native RNA limits are checked before mutation. */
  width?: number;

  /** Persistent output height within outer bound 1..4096, default 512; native RNA limits may reject smaller values. */
  height?: number;
}
