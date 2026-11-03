---
name: contracts
description: Owns Blendia declaration and test Evidence checklists and their package selectors. Use when writing or reviewing selected declarations, test scenarios, or Evidence configuration.
---

# Contracts

Use `@wrtnlabs/evidence` with catalog range `^0.9.0`. Each participating workspace package owns its `evidence.config.ts`, importing `IEvidenceConfig` from that module, selecting maintained declarations and applicable Markdown H2 checklists, and setting failures to error severity. Keep Evidence settings package-local rather than replacing them with shared configuration. Its `evidence` script runs the CLI; the root command aggregates participating package results without stopping at the first failure. `@ttsc/evidence` supplies complementary compiler-lint declaration guards, not a replacement checker.

| Checklist | Respondent |
| --- | --- |
| [common.md](common.md) | Maintained production and helper declarations |
| [performance.md](performance.md) | The same declarations, with scoped exclusions for inapplicable questions |
| [testing.md](testing.md) | Meaningful first-party unit cases |

Read the package configuration before writing answers. Each selected H2 is answered in the declaration's doc comment as `@evidence contracts/<file>.md#<anchor> <grounds>`, after a blank comment line. Read the declaration, its callers, callees, and relevant tests before stating what it establishes. Use `@evidenceExclude` only for a specific inapplicable question and explain why. Generic assurances, invented measurements, or exclusions that conceal missing behavior are defects.

From the owning package, `pnpm exec evidence list` and `pnpm exec evidence inspect '<target>'` expose selection. A package without maintained declarations has no declaration coverage; report that honestly without adding fake respondents. Exclude generated, copied, dependency, or unsupported adapter material only with a stated reason and inspect it during review; never narrow selectors or lower severity merely to obtain a pass.

Review checks whether answers are true and complete; the CLI checks structure. When adding or changing an H2, migrate every affected answer and selector in the same change. Add Blender or distribution-specific questions alongside actual governed implementation, so new contracts have real respondents and verification.
