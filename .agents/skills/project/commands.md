# Workspace commands

Read `package.json`, `pnpm-workspace.yaml`, and the affected package manifest before changing the command contract. The root package manager pin and workspace Node pin define the toolchain; CI installs the committed lockfile with `pnpm install --frozen-lockfile`.

| Command | Purpose |
| --- | --- |
| `pnpm install --frozen-lockfile` | Reproduce the committed dependency graph. |
| `pnpm run build` | Independently check compiled output in dependency order; local consumers do not require it. |
| `pnpm run config:check` | Run `ttsc --noEmit` in `config` using its existing `tsconfig.json`. |
| `pnpm run lint` | Run the additional lint diagnostics guard against each workspace's existing tsconfig. |
| `pnpm run test` | Run the first-party unit alias, `test:units`. |
| `pnpm run test:units` | Execute `@blendia/test-units` scenarios. |
| `pnpm run test:blender` | Execute `@blendia/test-blender` against an actual configured engine. |
| `pnpm run test:types` | Type-check both test modules with their existing tsconfigs. |
| `pnpm run test:units:types` | Type-check the unit module only. |
| `pnpm run test:blender:types` | Type-check the engine module only. |
| `pnpm run format` | Apply shared Prettier formatting to owned TypeScript and CJS files. |
| `pnpm run format:check` | Check formatting without editing. |
| `pnpm run evidence` | Aggregate the separate Evidence checks without stopping at the first package failure. |

Choose affected checks under the [validation guide](../development/validation.md), reusing the exact-head CI evidence it describes. This command inventory does not require repeating every aggregate locally.

Read [testing](../development/testing.md) before changing unit or actual engine scenarios, and inspect their package scripts for command details. Tool checks alone do not establish product behavior, Blender installation, GUI, rendering, or extension behavior.

Follow the [local source contract](../development/SKILL.md#local-source-and-distribution) when running CLI, unit, engine, type, and Evidence commands. Local CLI execution uses the public `ttsx` launcher; the source-aware test, type, and Evidence tools resolve workspace sources independently, preserving project context without a prebuild. Root command names stay the same while leaf scripts preload the [native environment preparation](../development/SKILL.md#pre-native-environment) through Node's `--require` before the public launcher. CLI and MCP `start` scripts execute `src/bin.ts` after their shipped `nativeBootstrap.cjs`; this preserves cwd, arguments, and stdio rather than substituting another TypeScript runtime.

Shared compiler, lint, and formatting rules belong in `config`. Reuse the existing `tsconfig.json` with `ttsc --noEmit` for type checking rather than adding another check-only project. Put shared versions in workspace catalogs and use `workspace:^` for internal package dependencies. Declare dependency edges so recursive builds follow their graph. General helper scripts use TypeScript and `ttsx`; the narrowly scoped pre-native bootstrap does not change Blender's Python ownership or the product runtime.

## Actual Blender tests

The [unit module](../../../tests/test-units/UNIT_TESTS.md) runs without Blender. The [engine module](../../../tests/test-blender/TESTING.md) requires `BLENDIA_BLENDER_EXECUTABLE` and `BLENDIA_EXTENSION_SOURCE_DIRECTORY`; `BLENDIA_TEST_OUTPUT_DIRECTORY` optionally selects an existing output parent. Prepare the extension's ignored distribution license with `pnpm run extension:license` before the engine suite. The suite builds and installs the official extension ZIP into isolated Blender configuration, then executes real scenarios; it does not require a TypeScript package build.

Use the engine guide for prerequisites, output retention, and public observations. The separate `blender.yml` workflow checks source and runs the pinned engine; its existence does not prove a successful run or GUI acceptance. Test-package Evidence belongs to each module's own configuration.

## Script execution and metadata

From the repository root, the source CLI supports the following grammar, defined by its [parser](../../../packages/cli/src/parseBlendiaCommand.ts):

```text
pnpm run blendia run [--jsonl] [--cwd <dir>] [--project <tsconfig>] <entry> [-- <script args...>]
pnpm run blendia run-text [--jsonl] --cwd <dir> --source-path <logical.ts> --input-file <utf8> [--project <tsconfig>] [--origin <label>] [-- <script args...>]
pnpm run blendia sessions --directory <dir> [--probe] [--probe-timeout-ms <100..5000>]
pnpm run blendia doctor [--cwd <dir>] [--project <tsconfig>]
```

Default `run` and `run-text` preserve inherited stdin/stdout/stderr and terminal behavior. Place `--jsonl` before the file entry or before the first `run-text` delimiter. It selects the [captured machine adapter](../../../packages/cli/src/runMachineJob.ts), which ignores child stdin and renders bounded captured log and terminal observations as JSON Lines. Arguments after the file entry or Text delimiter belong to the script. Both modes remain foreground execution; process completion alone proves neither descendant termination nor scene rollback.

`sessions` requires an explicit descriptor directory and prints JSON metadata. Default discovery performs no probe, and descriptor presence does not prove a live session. Optional `--probe` performs bounded hello checks and briefly acquires an idle Blender lease. `--probe-timeout-ms` requires `--probe`, accepts an integer from 100 through 5000, and defaults to 1000 when omitted.

`doctor` prints project, current Node, public `ttsx`, and dependency metadata with `execution: "not-tested"`. Its config path is an inspected explicit path or nearest candidate, not proof that the compiler selects or accepts it. It does not execute the compiler or validate Go, network, plugin, or native first-use preparation.
