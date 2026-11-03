import { type IEvidenceConfig } from "@wrtnlabs/evidence";

/** Select real protocol composition and bounded media presentation responsibilities. */
export default {
  severity: "error",
  claims: [
    {
      name: "typed service application and existing producer delegation",
      type: "typescript",
      files: ["src/BlendiaMcpController.ts"],
      symbol: "type",
      reference: {
        type: "markdown",
        root: "../../.agents/skills",
        files: ["contracts/common.md"],
        symbol: "h2",
        checklist: true,
      },
    },
    {
      name: "private lifetime ownership and bounded owned image assembly",
      type: "typescript",
      files: ["src/BlendiaMcpContext.ts", "src/BlendiaMcpImages.ts"],
      symbol: "type",
      reference: {
        type: "markdown",
        root: "../../.agents/skills",
        files: ["contracts/common.md", "contracts/performance.md"],
        symbol: "h2",
        checklist: true,
      },
    },
    {
      name: "typed MCP composition and public transport delegation",
      type: "typescript",
      files: ["src/createBlendiaMcpServer.ts", "src/BlendiaMcpTransport.ts"],
      symbol: ["function", "type"],
      reference: {
        type: "markdown",
        root: "../../.agents/skills",
        files: ["contracts/common.md"],
        symbol: "h2",
        checklist: true,
      },
    },
    {
      name: "bounded owned image presentation and resource registration",
      type: "typescript",
      files: ["src/addMcpNativeImage.ts", "src/registerBlendiaMcpResources.ts"],
      symbol: "function",
      reference: {
        type: "markdown",
        root: "../../.agents/skills",
        files: ["contracts/common.md", "contracts/performance.md"],
        symbol: "h2",
        checklist: true,
      },
    },
  ],
} satisfies IEvidenceConfig;
