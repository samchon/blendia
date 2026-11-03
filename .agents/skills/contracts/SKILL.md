---
name: contracts
description: Owns Blendia declaration and test Evidence checklists and their package selectors. Use when writing or reviewing selected declarations, test scenarios, or Evidence configuration.
---

# Contracts

Use `@wrtnlabs/evidence` with catalog range `^0.9.0`. Each participating workspace package owns its `evidence.config.ts`, importing `IEvidenceConfig` from that module, selecting maintained declarations and applicable Markdown H2 checklists, and setting failures to error severity. Keep Evidence settings package-local rather than replacing them with shared configuration. Its `evidence` script runs the CLI; the root command aggregates participating package results without stopping at the first failure. `@ttsc/evidence` supplies complementary compiler-lint declaration guards, not a replacement checker.

Select a contract because a specific declaration owns a material requirement. Do not apply all common and performance questions to every declaration, or replace that blanket with one universal question such as `C1`. Plain DTOs, simple parsers, and configuration do not need performance annotations merely because they exist. Keep their useful JSDoc; do not manufacture `N/A`, `O(1)`, or repeated exclusions to satisfy an irrelevant checklist.

| Checklist | Respondent |
| --- | --- |
| [common.md](common.md) | Declarations owning a material implementation assumption or design decision |
| [performance.md](performance.md) | Operations with material algorithm, reuse, or resource-lifetime requirements |
| [testing.md](testing.md) | Meaningful first-party unit cases |
| [Blender scenario contracts](../../../tests/test-blender/contracts/blender.md) | Actual engine scenario functions in `tests/test-blender` |
| [Extension installation contracts](../../../tests/test-blender/contracts/installation.md) | The engine module's official ZIP installation helper |

The unit module selects the shared testing checklist in its own `evidence.config.ts`; the engine module owns its engine and installation checklists and selectors. Keep those respondents distinct rather than imposing unit-only questions on real host scenarios. A contract answer explains the assertions and ownership; only an observed run establishes the execution result.

Read the package configuration before writing answers. Select only declarations and questions justified by their actual responsibilities, using the checker's supported configuration API. A focused package contract may express a concrete requirement that the shared questions do not fit; it must not become another template imposed on every DTO. Each selected H2 is answered in the declaration's doc comment as `@evidence contracts/<file>.md#<anchor> <grounds>`, after a blank comment line. Read its callers, callees, and relevant tests before stating what it establishes. Generic assurances, invented measurements, and blanket exclusions are defects.

From the owning package, `pnpm exec evidence list` and `pnpm exec evidence inspect '<target>'` expose selection. A package with no material contract has no claim to prove; report that honestly without adding fake respondents. Correct an overbroad selector when the requirement does not apply, and retain selectors for real obligations even when the code fails them. Use a scoped, reasoned `@evidenceExclude` only for a genuinely exceptional case within an otherwise applicable claim. Exclude generated, copied, dependency, or unsupported adapter material with provenance and inspect it during review; never lower severity or remove a real obligation merely to obtain a pass.

Review checks whether answers are true and complete; the CLI checks structure. When adding or changing an H2, migrate every affected answer and selector in the same change. Add Blender or distribution-specific questions alongside actual governed implementation, so new contracts have real respondents and verification.
