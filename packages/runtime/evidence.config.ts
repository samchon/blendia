import { type IEvidenceConfig } from "@wrtnlabs/evidence";

/** Check the execution boundary where concrete engineering obligations apply. */
export default {
  severity: "error",
  claims: [
    {
      name: "bounded credential discovery and explicit probes",
      type: "typescript",
      files: ["src/discoverBlenderSessions.ts"],
      symbol: "function",
      reference: {
        type: "markdown",
        root: "../../.agents/skills",
        files: ["contracts/common.md", "contracts/performance.md"],
        symbol: "h2",
        checklist: true,
      },
    },
    {
      name: "bounded captured log semantics",
      type: "typescript",
      files: ["src/internal/ScriptLog.ts"],
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
      name: "project execution and Text staging boundaries",
      type: "typescript",
      files: [
        "src/runProjectScript.ts",
        "src/runTextMacro.ts",
        "src/startScriptJob.ts",
      ],
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
