# Blendia

Blendia is a workspace for TypeScript tooling that controls an existing Blender
installation. Blender will continue to own scenes, geometry, rendering, and its
Python API; Node.js and `ttsc`'s `ttsx` will execute project TypeScript.

This repository currently contains development infrastructure only. Its package
entrypoints are empty modules: there is no Blender extension, executable CLI,
session transport, SDK operation, or MCP server yet. Three.js integration is out
of scope.

## Workspace

| Directory | Intended responsibility |
| --- | --- |
| `packages/sdk` | Public TypeScript Blender operations |
| `packages/runtime` | Shared project execution and session/job management |
| `packages/cli` (`blendia`) | Terminal entrypoint using the shared implementation |
| `packages/mcp` | AI client tools using the shared implementation |
| `config` | Shared compiler and lint configuration |
| `test` | Reserved location for future first-party unit tests |
| `.agents/skills` | Repository development, evidence, and review instructions |

The four product packages are private until they have a functional, reviewed
public API. Their source exports support local `ttsx` development, while
`publishConfig` describes built `lib` exports and `prepack` builds each tarball.
Release work must deliberately remove `private` and document and verify the real
API. Empty packages are not a supported SDK.
Dependencies between packages will be declared when real imports establish the
build graph. Python extension scaffolding belongs to the first Blender slice.

## Development

Use Node.js **22.23.2** and pnpm **10.6.4**, matching the pinned AutoMovie reference.
The workspace pins the execution Node version with `useNodeVersion`; the root
`packageManager` pins pnpm. With those tools available:

```sh
pnpm install --frozen-lockfile
pnpm run config:check
pnpm run build
pnpm run evidence
pnpm run format:check
```

`pnpm run format` formats maintained TypeScript sources. The ordinary package
builds use `ttsc` and `@ttsc/lint`; `@ttsc/evidence` supplies declaration lint guards,
and the separate `@wrtnlabs/evidence` command checks linked evidence contracts.
The recursive evidence command collects package failures without stopping at the
first workspace.

No applicable first-party behavior has been implemented, so this frame has no
unit tests or test execution job. `test/README.md` reserves the location for
meaningful unit tests introduced with actual first-party logic. The commands
above check the compiler, formatting, and Evidence configuration; they do not
establish Blender integration, GUI support, or MCP behavior.

## Planning and conventions

Follow [AGENTS.md](AGENTS.md) and [development conventions](docs/conventions.md).
The [research tracker](https://github.com/samchon/blendia/issues/1) links the
architecture research and implementation scopes. Infrastructure work is tracked
in [tooling #7](https://github.com/samchon/blendia/issues/7) and
[validation #6](https://github.com/samchon/blendia/issues/6).
