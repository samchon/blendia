# Workspace commands

Read `package.json`, `pnpm-workspace.yaml`, and the affected package manifest before changing the command contract. The root package manager pin and workspace Node pin define the toolchain; CI installs the committed lockfile with `pnpm install --frozen-lockfile`.

| Command | Purpose |
| --- | --- |
| `pnpm install --frozen-lockfile` | Reproduce the committed dependency graph. |
| `pnpm run build` | Build the four `packages/*` workspaces in dependency order. |
| `pnpm run config:check` | Run `ttsc --noEmit` in `config` using its existing `tsconfig.json`. |
| `pnpm run format` | Apply shared Prettier formatting to owned TypeScript files. |
| `pnpm run format:check` | Check formatting without editing. |
| `pnpm run evidence` | Aggregate the separate Evidence checks without stopping at the first package failure. |

Read [testing](../development/testing.md) before proposing unit cases, and inspect the actual package scripts for implemented test commands. Tool checks alone do not establish product behavior, Blender installation, GUI, rendering, or extension behavior.

Shared compiler, lint, and formatting rules belong in `config`. Reuse the existing `tsconfig.json` with `ttsc --noEmit` for type checking rather than adding another check-only project. Put shared versions in workspace catalogs and use `workspace:^` for internal package dependencies. Declare dependency edges so recursive builds follow their graph. General helper scripts use TypeScript and `ttsx`; this does not change Blender's Python ownership.
