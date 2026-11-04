# Validation

Follow [AGENTS.md](../../../AGENTS.md) before each action and apply its batch-by-cause rule to every verification round.

Identify the changed boundaries and collect their existing evidence before choosing local checks. Preserve and reuse successful full lint, native-guard, and build logs from CI on the exact current head, recording the revision and job links; those results do not require a duplicate local aggregate run. Results from a different head are historical evidence. New failures, changed code, or a material unverified boundary still require the complete affected cause-batch verification.

Collect changed first-party logic units, affected actual Blender scenarios, necessary source-only native `--noEmit` checks, formatting, applicable Evidence, and required host observations in one round. The [project commands](../project/commands.md) describe the separate unit and engine commands; package manifests determine implemented checks. When no applicable case exists, say so without manufacturing a passing suite.

`pnpm run lint` runs the additional [lint diagnostics guard](../../../config/checkLint.ts) against each workspace's existing tsconfig through the public `TtscCompiler` API. The guard explicitly selects the lint plugin, reports diagnostics and failures, and discards private in-memory or temporary compiler outputs without writing `lib`. The public compile context has no `noEmit` option. Keep normal builds, `ttsc --noEmit` type checking, other plugin/typia discovery, and the separate Wrtn Evidence checks: this additional guard does not replace their verification.

The [pre-native environment preparation](SKILL.md#pre-native-environment) runs before these public launchers; successful preparation does not establish compiler, plugin, guard, or product success. Keep the actual native checks and record their results separately from environment admission.

Keep compilation independent from source-consumer checks. Local execution, both test modules, test type checking, and Evidence follow the [source contract](SKILL.md#local-source-and-distribution) without a TypeScript build prerequisite. `build.yml` owns independent build and shared checks; `test.yml` runs the portable unit matrix. `blender.yml` separates engine-module lint/type checking from actual Blender 5.2.0 CPU execution on Ubuntu 24.04. Official extension packaging and installation belong to the engine suite.

For a focused change, choose checks that exercise the changed contracts and actual consumers. Broaden only for a failure, changed dependency, or unresolved concern. Distinguish inspection, unit execution, actual engine execution, CI evidence, and GUI acceptance in reports. Record environment-dependent checks that cannot run and their exact blocker; missing engine prerequisites are not a successful engine result. Retain the module's public observations without exposing private runtime storage.

Use the shared Prettier configuration on changed matching files when formatting is needed, and retain the affected local or exact-head CI formatting result. Avoid unrelated reformatting. Complete [self-review](../review/SKILL.md) and the [delivery procedure](../pull-request/SKILL.md) before reporting the mission complete.
