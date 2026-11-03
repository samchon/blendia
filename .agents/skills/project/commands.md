# Workspace commands

Read `package.json`, `pnpm-workspace.yaml`, and the affected package manifest before changing the command contract. The root package manager pin and workspace Node pin define the toolchain; CI installs the committed lockfile with `pnpm install --frozen-lockfile`.

| Command | Purpose |
| --- | --- |
| `pnpm install --frozen-lockfile` | Reproduce the committed dependency graph. |
| `pnpm run build` | Independently check compiled output in dependency order; local consumers do not require it. |
| `pnpm run config:check` | Run `ttsc --noEmit` in `config` using its existing `tsconfig.json`. |
| `pnpm run lint` | Run the additional lint diagnostics guard against each workspace's existing tsconfig. |
| `pnpm run format` | Apply shared Prettier formatting to owned TypeScript files. |
| `pnpm run format:check` | Check formatting without editing. |
| `pnpm run evidence` | Aggregate the separate Evidence checks without stopping at the first package failure. |

Choose affected checks under the [validation guide](../development/validation.md), reusing the exact-head CI evidence it describes. This command inventory does not require repeating every aggregate locally.

Read [testing](../development/testing.md) before proposing unit cases, and inspect the actual package scripts for implemented test commands. Tool checks alone do not establish product behavior, Blender installation, GUI, rendering, or extension behavior.

Follow the [local source contract](../development/SKILL.md#local-source-and-distribution) when running CLI, unit, type, and Evidence commands. Local CLI execution uses `ttsx`; the source-aware unit, type, and Evidence tools resolve workspace sources independently, preserving project context without a prebuild.

Shared compiler, lint, and formatting rules belong in `config`. Reuse the existing `tsconfig.json` with `ttsc --noEmit` for type checking rather than adding another check-only project. Put shared versions in workspace catalogs and use `workspace:^` for internal package dependencies. Declare dependency edges so recursive builds follow their graph. General helper scripts use TypeScript and `ttsx`; this does not change Blender's Python ownership.

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
