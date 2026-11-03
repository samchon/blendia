import { type IEvidenceConfig } from "@wrtnlabs/evidence";

/** Check the execution boundary where concrete engineering obligations apply. */
export default {
  severity: "error",
  claims: [
    {
      name: "project execution and Text staging boundaries",
      type: "typescript",
      files: ["src/runProjectScript.ts", "src/runTextMacro.ts"],
      symbol: "function",
      reference: {
        type: "markdown",
        root: "../../.agents/skills",
        files: ["contracts/common.md"],
        symbol: "h2",
        checklist: true,
      },
    },
  ],
} satisfies IEvidenceConfig;
