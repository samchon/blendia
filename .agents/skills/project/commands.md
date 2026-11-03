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

Read [testing](../development/testing.md) before proposing unit cases, and inspect the actual package scripts for implemented test commands. Tool checks alone do not establish product behavior, Blender installation, GUI, rendering, or extension behavior.

Follow the [local source contract](../development/SKILL.md#local-source-and-distribution) when running CLI, unit, type, and Evidence commands. Local CLI execution uses `ttsx`; the source-aware unit, type, and Evidence tools resolve workspace sources independently, preserving project context without a prebuild.

Shared compiler, lint, and formatting rules belong in `config`. Reuse the existing `tsconfig.json` with `ttsc --noEmit` for type checking rather than adding another check-only project. Put shared versions in workspace catalogs and use `workspace:^` for internal package dependencies. Declare dependency edges so recursive builds follow their graph. General helper scripts use TypeScript and `ttsx`; this does not change Blender's Python ownership.
