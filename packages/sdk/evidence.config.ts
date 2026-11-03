import { type IEvidenceConfig } from "@wrtnlabs/evidence";

/** Require evidence only for the SDK implementation boundaries that need it. */
export default {
  severity: "error",
  claims: [
    {
      name: "connection and protocol implementation",
      type: "typescript",
      files: [
        "src/BlenderClient.ts",
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
      name: "bounded connection and frame processing",
      type: "typescript",
      files: ["src/BlenderClient.ts", "src/internal/BlenderFrameDecoder.ts"],
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
