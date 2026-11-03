import { type IEvidenceConfig } from "@wrtnlabs/evidence";

/** Apply behavioral contracts to the actual first-party unit cases. */
export default {
  severity: "error",
  claims: [
    {
      name: "first-party unit cases",
      type: "typescript",
      files: ["src/features/**/test_*.ts"],
      symbol: "function",
      reference: {
        type: "markdown",
        root: "../../.agents/skills",
        files: ["contracts/testing.md"],
        symbol: "h2",
        checklist: true,
      },
    },
  ],
} satisfies IEvidenceConfig;
