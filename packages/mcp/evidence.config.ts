import { type IEvidenceConfig } from "@wrtnlabs/evidence";

/** Apply engineering contracts to every exported source declaration as APIs arrive. */
export default {
  severity: "error",
  claims: [
    {
      name: "public source declarations",
      type: "typescript",
      files: ["src/**/*.ts"],
      symbol: ["type", "function"],
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
