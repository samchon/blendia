import type { IBlenderArtifactHandle } from "./IBlenderArtifactHandle";

/** Read a bounded slice of one retained PNG. */
export interface IBlenderArtifactReadOptions {
  /** Owned artifact to read. */
  artifact: IBlenderArtifactHandle;

  /** Byte offset from zero through total bytes; total bytes returns empty EOF. */
  offset: number;

  /** Maximum raw bytes from 1 through 196608, default 196608. */
  maxBytes?: number;
}
