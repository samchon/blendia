/** Validated canonical-base64 PNG bytes and exact contiguous offsets. */
export interface IBlenderArtifactChunk {
  /** Identity correlated with the requested artifact. */
  artifactId: string;

  /** Requested starting byte offset. */
  offset: number;

  /** Offset immediately after the decoded bytes. */
  nextOffset: number;

  /** Full PNG byte count, independent of chunk length. */
  totalBytes: number;

  /** Canonical base64 of nextOffset minus offset raw bytes. */
  dataBase64: string;

  /** True exactly when nextOffset equals totalBytes. */
  eof: boolean;
}
