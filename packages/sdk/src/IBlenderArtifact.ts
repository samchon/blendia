import type { IBlenderArtifactHandle } from "./IBlenderArtifactHandle";

/** Bounded owned PNG metadata with immutable render provenance. */
export interface IBlenderArtifact {
  /** Opaque identity used for bounded reads, export, and release. */
  handle: IBlenderArtifactHandle;

  /** Native job that produced this PNG. */
  renderId: string;

  /** Data generation at render invocation. */
  startGeneration: number;

  /** The only supported owned image type. */
  mimeType: "image/png";

  /** PNG byte count, at most 32 MiB. */
  bytes: number;

  /** Rendered pixel width. */
  width: number;

  /** Rendered pixel height. */
  height: number;

  /** UTC ISO expiry; explicit release may remove it sooner. */
  expiresAt: string;
}
