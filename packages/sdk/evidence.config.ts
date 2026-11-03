import { type IEvidenceConfig } from "@wrtnlabs/evidence";

/** Select real SDK implementation boundaries; ordinary DTOs and scalar helpers have no blanket claims. */
export default {
  severity: "error",
  claims: [
    {
      name: "client and feature validation",
      type: "typescript",
      files: [
        "src/BlenderClient.ts",
        "src/internal/BlenderSceneProtocol.ts",
        "src/internal/BlenderMaterialProtocol.ts",
        "src/internal/BlenderCameraProtocol.ts",
        "src/internal/BlenderRenderProtocol.ts",
        "src/internal/BlenderArtifactProtocol.ts",
      ],
      symbol: "type",
      reference: {
        type: "markdown",
        root: "../../.agents/skills",
        files: ["contracts/common.md"],
        symbol: "h2",
      },
    },
    {
      name: "connection, framing, and baseline protocol validation",
      type: "typescript",
      files: [
        "src/internal/BlenderConnection.ts",
        "src/internal/BlenderFrameDecoder.ts",
        "src/internal/BlenderProtocol.ts",
      ],
      symbol: ["type", "function"],
      reference: {
        type: "markdown",
        root: "../../.agents/skills",
        files: ["contracts/common.md"],
        symbol: "h2",
      },
    },
    {
      name: "bounded socket, mesh, and chunk processing",
      type: "typescript",
      files: [
        "src/internal/BlenderConnection.ts",
        "src/internal/BlenderFrameDecoder.ts",
        "src/internal/BlenderSceneProtocol.ts",
        "src/internal/BlenderArtifactProtocol.ts",
      ],
      symbol: "type",
      reference: {
        type: "markdown",
        root: "../../.agents/skills",
        files: ["contracts/performance.md"],
        symbol: "h2",
      },
    },
  ],
} satisfies IEvidenceConfig;
