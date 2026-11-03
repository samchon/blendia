# Blendia development conventions

Tracking: [conventions and tooling #7](https://github.com/samchon/blendia/issues/7), [integration and evidence #6](https://github.com/samchon/blendia/issues/6), and [overall research and implementation #1](https://github.com/samchon/blendia/issues/1).

This document records how the inspected AutoMovie repository informed Blendia's implemented monorepo frame. The workspace, tooling, and seven agent skills now exist. The SDK, runtime, CLI, and MCP packages are private empty shells; no Blender transport, extension, product CLI command, or MCP server is implemented. There is no applicable first-party functional logic or unit-test suite yet. The [canonical user instructions](../.agents/user-instructions.md) own requirements, the [project skill](../.agents/skills/project/SKILL.md) owns scope and commands, and the other routed skills own their procedures. This document supplies reference evidence and adaptation rationale rather than a second owner for those rules. The frame is delivered through [PR #8](https://github.com/samchon/blendia/pull/8).

The reference was inspected read-only on 2026-11-03 at AutoMovie commit [`ba7f7569ac664aaf5540eb9dde5c5039850899c5`](https://github.com/samchon/AutoMovie/tree/ba7f7569ac664aaf5540eb9dde5c5039850899c5). No AutoMovie installation, build, or test was run during that inspection. Source configuration establishes the reference behavior; it is not execution evidence. Research and implementation status belong in the repository's GitHub issues. The [architecture research](research/2026-11-03-blender-ts-mcp.md) supplies product context and the open design questions.

## Product boundaries and language ownership

Blendia lets users and coding agents write project TypeScript that controls an existing Blender installation. Blender owns geometry, scene evaluation, viewport, rendering, and file formats. Node.js and the existing `ttsc` package's `ttsx` own TypeScript execution. Three.js integration is outside the requested scope.

Use TypeScript for the SDK, execution management, CLI, MCP facade, generators, and general development helpers. Use Python for code that must run against `bpy` inside Blender: the extension, main-thread dispatch, UI integration, and API metadata extraction. Do not reproduce Blender functionality merely to satisfy a TypeScript-only rule. C++, Rust, another embedded JS engine, and a Blender fork are not prerequisites for the first implementation.

The intended product will share session/job execution across the SDK, CLI, MCP, and the Blender extension's Run TypeScript action. The requested `typia.llm.application` and `@typia/mcp` approach remains the MCP implementation direction, with explicit handling for native MCP image content when required. The frame has no direct typia or `@typia/mcp` product dependency or server implementation. Their actual use and compatibility belong with the first real consumer.

The first vertical slice should connect a real project TS entry to a real Blender session, modify a scene, and return an observable result and useful errors. Full `bpy` parity, all synchronous Python addon callbacks in TS, and a complete TS IDE inside Blender are separate scopes requiring explicit issues and evidence.

## Workspace and dependency ownership

The current workspace contains `config` and `packages/*`. Its maintained structure is:

```text
blendia/
  .agents/skills/                seven scoped skills and their linked guides
  .github/workflows/
  config/                       shared compiler, lint, and formatting support
  packages/{sdk,runtime,cli,mcp}/ private empty TS package shells
  test/README.md                reservation for future meaningful unit tests
  docs/
  AGENTS.md
  CLAUDE.md
  package.json
  pnpm-workspace.yaml
  pnpm-lock.yaml
```

The four `@blendia/sdk`, `@blendia/runtime`, `blendia`, and `@blendia/mcp` shells currently export empty modules. The unscoped `blendia` package remains at `packages/cli`; its package name follows the user's explicit CLI naming choice. `@blendia/config` owns shared compiler/lint configuration. There is no test workspace, runner, configuration, barrel, or test dependency. No shell has a product API, CLI bin, or invented runtime dependency. Protocol and codegen packages are not created merely to reach the count in an earlier proposal. `blender/extension` and runnable product examples will arrive with their actual implementation and consumers.

Put shared dependency versions in `pnpm-workspace.yaml` catalogs and use `workspace:^` for internal dependencies unless a documented constraint requires another workspace range. Pin the package manager in `package.json` and commit the lockfile. Declare package dependencies so recursive pnpm builds follow their dependency graph; do not hardcode package ordering or introduce Turbo/Nx by default. Include only the actual Blendia workspace directories, without AutoMovie's `movies`, `experimental`, or website entries.

Blendia pins pnpm 10.6.4 and Node 22.23.2, following the inspected reference. Its committed lockfile resolves TypeScript 7.0.2, `ttsc`, `@ttsc/lint`, and `@ttsc/evidence` 0.35.0, and `@wrtnlabs/evidence` 0.9.0 from the required catalog range `^0.9.0`. The workspace catalogs retain declared dependency ranges; the lockfile supplies the installed versions. These are selected versions, not a claim of current releases. AutoMovie's separate `typescript-compiler` alias points to TypeScript 5.9.3; Blendia has no need for that alias in this frame. Unused direct typia and `@nestia/e2e` dependencies are not carried over from AutoMovie. Verification results and any toolchain constraints belong in [tooling #7](https://github.com/samchon/blendia/issues/7).

References: [root package](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/package.json#L6), [workspace catalogs](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/pnpm-workspace.yaml#L1).

## Compiler, exports, and commands

The implemented [shared compiler configuration](../config/tsconfig.json) follows AutoMovie's pattern. Package configurations extend it, use `src` as `rootDir`, and emit to `lib`. The baseline is ES2022, CommonJS, strict checking, unused-local and unused-parameter checking, declarations, source maps, consistent filename casing, `stripInternal`, and Node types. Blendia omits AutoMovie's shared DOM library because these packages have no DOM consumer. Package-specific ESM configuration remains an option if an actual dependency requires it.

Package-local `lint.config.ts` files re-export the [shared lint configuration](../config/lint.config.ts), which contains the policy directly and is applied through the `@ttsc/lint` compiler transform. This canonical filename follows the user's Blendia configuration choice; the historical AutoMovie source remains `config/lint.ts`. Prettier owns formatting, with duplicate formatting diagnostics disabled in compiler lint. AutoMovie's correctness rule families cover promise handling, strict equality, exhaustive decisions, and `node:` imports. Neither repository's base setup introduces a separate ESLint CLI. `config:check` runs `ttsc --noEmit` against the existing `config/tsconfig.json`; no separate checking tsconfig is introduced. Evidence configuration remains package-local.

The shared configuration uses the exact owner-relative exclusion `ignores: ["lint.config.ts"]` because this conventional tooling filename is not a public same-named API declaration. It excludes that tooling file from all compiler-lint rules, not only the singular-declaration rule. Ordinary `ttsc --noEmit` checking, its `satisfies ITtscLintConfig` constraint, and Prettier formatting still apply to the shared configuration. Product source guards remain enabled at their configured error severity.

The four package manifests expose source TS for future local `ttsx` consumers. Their `publishConfig` points to built JS and declarations in `lib`, and `prepack` is configured to build the package. These manifest settings are not a claim of distribution or consumer testing. The CLI shell has no executable bin yet.

The executable command contract belongs to [workspace commands](../.agents/skills/project/commands.md), backed by [root scripts](../package.json). A complete local frame check uses:

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm run config:check
pnpm run format:check
pnpm run evidence
```

Root `build` recursively compiles only the four `packages/*` shells; shared configuration has the separate `config:check` command. Package build uses `rimraf lib && ttsc`. The four current gates are source compilation, shared-configuration type checking, formatting, and package-owned Evidence. No test command exists. These direct checks establish only their stated toolchain properties; they do not establish functional coverage, Blender behavior, or a passing unit-test suite.

`ttsx` project discovery, cwd, arguments, source maps, and configuration must be preserved by runtime and CLI wrappers. Record any deliberate difference. Define the project identity and relative imports of unsaved Blender text before adding its execution path; an arbitrary temporary directory is not an equivalent project.

References: [shared compiler configuration](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/config/tsconfig.json#L3), [package compiler transform](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/packages/interface/tsconfig.json#L2), [source and publish exports](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/packages/interface/package.json#L5), [CLI scripts](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/packages/cli/package.json#L6), [lint configuration](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/config/lint.ts#L1).

## Source and documentation style

The [development skill](../.agents/skills/development/SKILL.md) owns explicit type annotations, meaningful JSDoc, one matching exported symbol per file, file size, logical paragraphs, and consumer verification. The [documentation skill](../.agents/skills/documentation/SKILL.md) owns language and explanation style. Blendia retains requested Korean research and conversation evidence as a deliberate adaptation to AutoMovie's broader English-language policy. Both production named functions and arrows are permitted; test scenario exports follow the narrower testing convention.

The implemented [Prettier configuration](../.prettierrc.json) follows AutoMovie's 80-column, two-space, semicolon, trailing-comma, and import-grouping choices. Interface-prefixed names and closed-union names remain observed patterns rather than a claim that every type must have an `I` prefix. AutoMovie's product-specific prohibition on typia tags is not copied into a project whose protocol and MCP design explicitly uses typia. Film-production, Three.js, and browser-viewer ownership rules are likewise excluded.

References: [development rules](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/.agents/skills/development/SKILL.md#L14), [formatting configuration](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/.prettierrc.json#L2), [documentation rules](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/.agents/skills/documentation/SKILL.md#L10).

## Meaningful tests and current checks

The [testing guide](../.agents/skills/development/testing.md) applies the user's requirement to test only actual first-party logic. The current [test reservation](../test/README.md) contains no executable tests or harness. Meaningful unit-test setup will arrive with the first real first-party behavior under [#6](https://github.com/samchon/blendia/issues/6); no implementation is created solely to supply test subjects.

The rejected package/configuration assertions, empty-module imports, upstream transformation checks, distribution smoke tests, and synthetic runner cases are removed. They are not retained as manual probes or substituted with an empty passing runner. [Validation guidance](../.agents/skills/development/validation.md) owns the direct checks and the repository-wide batch-by-cause rule.

The implemented [verification workflow](../.github/workflows/verify.yml) runs on pull requests and pushes to `master`, installs the frozen lockfile with pinned actions and Node 22.23.2, and grants read-only contents access. Its jobs execute source build and configuration checks, formatting, and package-owned Evidence. There is no CI test job or test platform matrix. Results belong in the PR and [tooling issue](https://github.com/samchon/blendia/issues/7), rather than being inferred from workflow configuration. No Blender behavior is covered by these gates.

Reference: [AutoMovie build CI](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/.github/workflows/build.yml#L17). Its original test implementation is not an adopted Blendia requirement; the user's meaningful-tests rule controls the current scope.

## Agent instructions and skills

The repository now contains seven actual skills: project, development, contracts, documentation, prompting, review, and pull-request. [AGENTS.md](../AGENTS.md) requires reopening the [canonical user instructions](../.agents/user-instructions.md) before every work unit, tool invocation, or action, and routes the skill triggers. [CLAUDE.md](../CLAUDE.md) contains exactly `@AGENTS.md` plus the final newline. Supporting guides are directly linked siblings in the single `.agents/skills` tree. There are no duplicated `.claude/skills` or `.codex/skills` copies or skills junctions. This follows the inspected AutoMovie files rather than assuming checkout hardlinks are a portable instruction mechanism.

The [prompting skill](../.agents/skills/prompting/SKILL.md) owns frontmatter, triggers, concise routing, supporting-guide layout, and single rule ownership. The [review skill](../.agents/skills/review/SKILL.md) owns complete-change review. The [pull-request skill](../.agents/skills/pull-request/SKILL.md) owns Draft-first issue/branch/PR setup and delivery, including the user's standing instruction to merge after a clean self-review and required green CI on the current head. Product-specific film skills and model-branded prompting links were not copied.

The [contracts skill](../.agents/skills/contracts/SKILL.md) owns the required `@wrtnlabs/evidence` checker, H2 checklists, grounded `@evidence` answers, and scoped reasoned exclusions. Each of the four package shells has an actual `evidence.config.ts`, error severity, and `evidence` CLI script. Root aggregation includes only those packages without stopping at the first package failure. Selectors cover source types/functions against common and performance contracts. The shells have no product declarations yet, so running their configured check does not establish declaration coverage or functional correctness. There are no test respondents or test Evidence configuration.

`@ttsc/evidence` supplies complementary documented-declaration, singular, and TODO guards through `@ttsc/lint`; it does not replace `@wrtnlabs/evidence`. Evidence structure, reviewers' assessment of grounded answers, and behavioral tests are separate forms of verification. Future Blender contracts will need real implementation and respondents for serialization, main-thread/context requirements, reference lifetime, and job results. A structural pass alone cannot establish that those features work.

References: [AutoMovie router](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/AGENTS.md#L32), [Claude delegation](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/CLAUDE.md#L1), [instruction ownership and layout](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/.agents/skills/prompting/SKILL.md#L10), [evidence contracts](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/.agents/skills/contracts/SKILL.md#L8), [checker dependency](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/package.json#L32), [production checker configuration](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/packages/engine/evidence.config.ts#L1).

## Shared checkout and completion records

The routed skills and repository-wide instructions own shared-checkout edits, Windows cleanup, issue records, and PR delivery. The initial convention research was checked by both AutoMovie source researchers and by local source-link inspection. The implemented frame's command results, complete review, and exact CI head belong in [tooling #7](https://github.com/samchon/blendia/issues/7) and its PR. No TS frame result establishes Blender installation, extension, GUI, or rendering behavior. The broader product work remains tracked by [#1](https://github.com/samchon/blendia/issues/1).
