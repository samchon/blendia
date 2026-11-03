# Validation

Follow [AGENTS.md](../../../AGENTS.md) before each action and apply its batch-by-cause rule to every verification round.

Identify the changed boundaries and collect their existing evidence before choosing local checks. Preserve and reuse successful full lint, native-guard, and build logs from CI on the exact current head, recording the revision and job links; those results do not require a duplicate local aggregate run. Results from a different head are historical evidence. New failures, changed code, or a material unverified boundary still require the complete affected cause-batch verification.

Collect changed first-party logic units, necessary source-only native `--noEmit` checks, formatting, applicable Evidence, and any required actual Blender observations in one round. The [project commands](../project/commands.md) describe available commands; package manifests determine implemented test commands. When no applicable first-party unit cases exist, say so without manufacturing a passing suite.

`pnpm run lint` runs the additional [lint diagnostics guard](../../../config/checkLint.ts) against each workspace's existing tsconfig through the public `TtscCompiler` API. The guard explicitly selects the lint plugin, reports diagnostics and failures, and discards private in-memory or temporary compiler outputs without writing `lib`. The public compile context has no `noEmit` option. Keep normal builds, `ttsc --noEmit` type checking, other plugin/typia discovery, and the separate Wrtn Evidence checks: this additional guard does not replace their verification.

Keep compilation independent from source-consumer checks. Local execution, unit tests, test type checking, and Evidence follow the [source contract](SKILL.md#local-source-and-distribution) without a build prerequisite. The only GitHub workflow files are `build.yml` and `test.yml`; do not introduce `verify.yml` or another aggregate workflow.

For a focused change, choose checks that exercise the changed contracts and actual consumers. Broaden only for a failure, changed dependency, or unresolved concern. Distinguish inspection, local execution, CI execution, and real Blender validation in reports. Record environment-dependent checks that cannot run and their exact blocker.

Use the shared Prettier configuration on changed matching files when formatting is needed, and retain the affected local or exact-head CI formatting result. Avoid unrelated reformatting. Complete [self-review](../review/SKILL.md) and the [delivery procedure](../pull-request/SKILL.md) before reporting the mission complete.
