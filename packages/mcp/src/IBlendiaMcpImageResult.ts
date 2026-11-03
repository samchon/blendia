import type { IBlenderArtifact } from "@blendia/sdk";

/** Declared owned PNG result; transport adds native image content without deleting these fields. */
export interface IBlendiaMcpImageResult {
  /** Typed adapter discriminator. */
  kind: "image";

  /** Observed immutable render provenance and expiry. */
  artifact: IBlenderArtifact;

  /** Native image content type. */
  mimeType: "image/png";

  /** At most one MiB of raw PNG bytes encoded canonically; retained in structuredContent. */
  dataBase64: string;
}
