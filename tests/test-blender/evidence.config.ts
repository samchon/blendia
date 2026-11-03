import { type IEvidenceConfig } from "@wrtnlabs/evidence";

/** Select the real-engine scenario's observable product and ownership obligations. */
export default {
  severity: "error",
  claims: [
    {
      name: "actual extension installation",
      type: "typescript",
      files: ["src/internal/prepareInstalledExtension.ts"],
      symbol: "function",
      reference: {
        type: "markdown",
        root: ".",
        files: ["contracts/installation.md"],
        symbol: "h2",
        checklist: true,
      },
    },
    {
      name: "actual Blender engine verification",
      type: "typescript",
      files: ["src/features/**/test_*.ts"],
      symbol: "function",
      reference: {
        type: "markdown",
        root: ".",
        files: ["contracts/blender.md"],
        symbol: "h2",
        checklist: true,
      },
    },
  ],
} satisfies IEvidenceConfig;
