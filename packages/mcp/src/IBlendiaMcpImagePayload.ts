import type { IBlenderArtifact } from "@blendia/sdk";

/** Private validated PNG bytes; this type is never reflected into a tool schema. */
export interface IBlendiaMcpImagePayload {
  /** Detached native render metadata retained with these exact bytes. */
  artifact: IBlenderArtifact;

  /** Native image and resource MIME type. */
  mimeType: "image/png";

  /** Canonical bounded image bytes, held privately until native delivery. */
  dataBase64: string;
}
