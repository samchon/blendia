import type { IBlenderArtifact } from "@blendia/sdk";

/** Metadata-only owned PNG result; raw bytes belong exclusively to private one-time delivery. */
export interface IBlendiaMcpImageResult {
  /** Typed adapter discriminator. */
  kind: "image";

  /** Observed immutable render provenance and expiry. */
  artifact: IBlenderArtifact;

  /** Native image content type. */
  mimeType: "image/png";

  /** Opaque one-use ticket correlated to this tool response; not a durable resource address. */
  deliveryId: string;
}
