/** Opaque owned artifact identity; never an arbitrary filesystem read permission. */
export interface IBlenderArtifactHandle {
  /** Bridge retaining the PNG. */
  sessionId: string;

  /** Opaque server-issued artifact identity. */
  artifactId: string;
}
