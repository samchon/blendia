# Blendia development conventions

Tracking: [source-first technical debt #12](https://github.com/samchon/blendia/issues/12), [conventions and tooling #7](https://github.com/samchon/blendia/issues/7), [verification #6](https://github.com/samchon/blendia/issues/6), and [overall research and implementation #1](https://github.com/samchon/blendia/issues/1).

This document records Blendia's development structure and its adaptation of the inspected AutoMovie repository. The SDK, runtime, CLI, and Python extension supplied the saved-project scripting slice merged in [PR #9](https://github.com/samchon/blendia/pull/9), with first-party CLI grammar and stream-framing units. Later product guides own the current macro, scene, job, headless, and [MCP agent interfaces](design/mcp-agent-tools.md). The source-first and contract cleanup is tracked in [PR #11](https://github.com/samchon/blendia/pull/11); that cleanup itself added no Blender UI macro or rendering feature. The [repository instructions](../AGENTS.md) route requirements, the [project skill](../.agents/skills/project/SKILL.md) owns scope and commands, and the other routed skills own their procedures. Initial frame history remains in [PR #8](https://github.com/samchon/blendia/pull/8), while actual verification results belong in their issues and PRs.

The reference was inspected read-only on 2026-11-03 at AutoMovie commit [`ba7f7569ac664aaf5540eb9dde5c5039850899c5`](https://github.com/samchon/AutoMovie/tree/ba7f7569ac664aaf5540eb9dde5c5039850899c5). No AutoMovie installation, build, or test was run during that inspection. Source configuration establishes the reference behavior; it is not execution evidence. Research and implementation status belong in the repository's GitHub issues. The [architecture research](research/2026-11-03-blender-ts-mcp.md) supplies product context and the open design questions.

## Product boundaries and language ownership

Blendia lets users and coding agents write project TypeScript that controls an existing Blender installation. Blender owns geometry, scene evaluation, viewport, rendering, and file formats. Node.js and the existing `ttsc` package's `ttsx` own TypeScript execution. Three.js integration is outside the requested scope.

Use TypeScript for the SDK, execution management, CLI, MCP facade, generators, and general development helpers. Use Python for code that must run against `bpy` inside Blender: the extension, main-thread dispatch, UI integration, and API metadata extraction. Do not reproduce Blender functionality merely to satisfy a TypeScript-only rule. C++, Rust, another embedded JS engine, and a Blender fork are not prerequisites for the first implementation.

The CLI delegates project execution to the shared runtime, and scripts use the SDK to connect to Blender. The extension owns authenticated loopback transport and main-thread scene operations. [Blender macros](design/blender-macros.md), [captured jobs and log cursors](design/script-jobs.md), and the [MCP facade](design/mcp-agent-tools.md) consume those same services. MCP uses `typia.llm.application` and `@typia/mcp` for its generated tool surface, with a public transport adapter for native images. It does not introduce a separate execution core or a Stop/cancel guarantee.

The first vertical slice contained explicit cube creation, object readback, and local-transform operations, along with session/generation-aware handles and errors that distinguish potentially applied mutations. Its historical scope is described in [the scripting design](design/scripting.md); current macro and scene capabilities belong to their linked product guides. Full `bpy` parity, all synchronous Python addon callbacks in TS, and a complete TS IDE inside Blender remain separate scopes requiring explicit issues and evidence.

## Workspace and dependency ownership

The current pnpm workspace contains `config`, `packages/*`, and the first-party `test` workspace. The Python extension is maintained alongside those Node projects:

```text
blendia/
  .agents/skills/                seven scoped skills and their linked guides
  .github/workflows/
  config/                       shared compiler, lint, and formatting support
  packages/{sdk,runtime,cli,mcp}/ SDK, shared execution, CLI, and MCP facade
  blender/extension/            Python bridge and Blender extension UI
  test/src/features/{cli,sdk}/   first-party argument and framing unit cases
  test/src/index.ts             minimal unit discovery and reporting
  docs/
  AGENTS.md
  CLAUDE.md
  package.json
  pnpm-workspace.yaml
  pnpm-lock.yaml
```

`@blendia/sdk` exposes `BlenderClient`, scene/session types, and `BlenderError`; internal protocol/framing code belongs with that client. `@blendia/runtime` owns project execution and its public job interfaces. The unscoped `blendia` package remains at `packages/cli` and consumes the runtime. Local `pnpm blendia` invokes its TypeScript source through `ttsx`; the declared `lib/bin.js` executable belongs to distribution. `@blendia/mcp` exports an asynchronous server factory that composes and connects its public transport adapter with private native-image delivery, consumes SDK/runtime services, and provides a source stdio entry described in the [MCP guide](design/mcp-agent-tools.md#stdio-host-setup). `@blendia/config` owns shared tooling, and `@blendia/test` consumes actual first-party CLI and SDK logic. The product packages remain private and are not published. Protocol and codegen packages are not added merely to reach the count in an earlier proposal.

Put shared dependency versions in `pnpm-workspace.yaml` catalogs and use `workspace:^` for internal dependencies unless a documented constraint requires another workspace range. Pin the package manager in `package.json` and commit the lockfile. Declare package dependencies so recursive pnpm builds follow their dependency graph; do not hardcode package ordering or introduce Turbo/Nx by default. Include only the actual Blendia workspace directories, without AutoMovie's `movies`, `experimental`, or website entries.

Blendia pins pnpm 10.6.4 and Node 22.23.2, following the inspected reference. Its lockfile selects TypeScript 7.0.2, `ttsc`, `@ttsc/lint`, and `@ttsc/evidence` 0.35.0, and `@wrtnlabs/evidence` 0.9.0 from the required catalog range `^0.9.0`. The unit workspace uses the catalog's `@nestia/e2e` range `^12.1.0` for its minimal DynamicExecutor entrypoint. The workspace catalogs declare ranges, and the lockfile supplies installed versions; these are not claims of current releases. AutoMovie's separate `typescript-compiler` alias points to TypeScript 5.9.3, which this repository does not need. No upstream typia test is introduced. Verification results and toolchain constraints belong in the implementation issues and PR.

References: [root package](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/package.json#L6), [workspace catalogs](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/pnpm-workspace.yaml#L1).

## Compiler, exports, and commands

The implemented [shared compiler configuration](../config/tsconfig.json) follows AutoMovie's pattern. Package configurations extend it, use `src` as `rootDir`, and emit to `lib`. The baseline is ES2022, CommonJS, strict checking, unused-local and unused-parameter checking, declarations, source maps, consistent filename casing, `stripInternal`, and Node types. Blendia omits AutoMovie's shared DOM library because these packages have no DOM consumer. Package-specific ESM configuration remains an option if an actual dependency requires it.

Package-local `lint.config.ts` files re-export the [shared lint configuration](../config/lint.config.ts), which contains the policy directly. This canonical filename follows the user's Blendia configuration choice; the historical AutoMovie source remains `config/lint.ts`. Blendia's existing tsconfigs explicitly set the public `enabled: false` option on their own `@ttsc/lint` entry, separating automatic source execution from development lint. Other configured and automatically discovered transformers retain their normal policy, including a consuming project's typia setup; launchers do not add a blanket plugin bypass. Prettier owns formatting, with duplicate formatting diagnostics disabled in compiler lint. No separate ESLint CLI or checking tsconfig is introduced, and Wrtn Evidence configuration remains package-local.

The additional [checkLint](../config/checkLint.ts) development guard uses the public `TtscCompiler` against each workspace's existing `tsconfig.json`, with an explicit lint-only plugin list and the same lint configuration. `pnpm lint` aggregates `config`, product packages, and `test` without stopping at the first package failure. Compiler failures and exceptions produce a nonzero exit, and diagnostics retain their original fields. The public compile API has no `noEmit` option: the guard discards output captured privately in memory or temporary storage and writes no package `lib`. Ordinary `ttsc` builds and `ttsc --noEmit` checks remain separate and unchanged; the guard does not substitute for their output or transformer validation. This is a configuration-boundary change, with no measured performance improvement implied.

The shared configuration uses the exact owner-relative exclusion `ignores: ["lint.config.ts"]` because this conventional tooling filename is not a public same-named API declaration. It excludes that tooling file from all compiler-lint rules, not only the singular-declaration rule. Ordinary `ttsc --noEmit` checking, its `satisfies ITtscLintConfig` constraint, and Prettier formatting still apply to the shared configuration. Product source guards retain their configured error severity in the explicit development lint pass.

Local development always runs TypeScript source without a build. Following the inspected AutoMovie pattern, each product package has `main: "src/index.ts"`, a root export pointing to `./src/index.ts`, and no local `types` field. `ttsx` runs local consumers; root `pnpm blendia` invokes `packages/cli/src/bin.ts`, and the CLI package's `start` uses `ttsx src/bin.ts`. CLI execution, units, test type checking, and Evidence must work without `lib` output. Do not add compiled fallbacks, custom export conditions, extra checking projects, or a prebuild to compensate for broken source resolution.

Distribution metadata stays separate in `publishConfig`: `main` points to `lib/index.js`, `types` to `lib/index.d.ts`, and the published root export uses built `types` and `default` entries. `lib/bin.js` is the CLI's distribution bin. Compilation is an independent output-validation or distribution step; it is never a prerequisite for a local consumer. Package publication remains disabled.

The executable command contract belongs to [workspace commands](../.agents/skills/project/commands.md), backed by [root scripts](../package.json). A complete local source-and-unit check uses:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm run config:check
pnpm run test:types
pnpm run format:check
pnpm run evidence
pnpm test
```

`lint` runs the explicit development guard, `config:check` checks shared tooling through ordinary `ttsc --noEmit`, and `test:types` checks the unit workspace without emitting. `pnpm test` executes the named first-party unit files through `ttsx src/index.ts` and requires no Blender installation or package build. Root Evidence aggregation uses `--if-present` to run the SDK, runtime, MCP, and unit workspace's package-local checks without stopping at the first package failure. The CLI parser has no material formal claim or Evidence script and is skipped; no placeholder claim is manufactured for it. `pnpm blendia --help` is the local source CLI entry. These commands resolve source directly; their existence does not imply a passing run or establish extension, GUI, or end-to-end Blender behavior.

Run the independent compiled-output check separately when applicable:

```sh
pnpm run build
```

The root build recursively runs the product packages' `rimraf lib && ttsc` in dependency order. This checks emitted output without becoming part of the local command chain. Local checks must remain valid when that output is absent.

The repository-root [LICENSE](../LICENSE) is the sole maintained product license. [pnpm 10.6.4's package packer](https://github.com/pnpm/pnpm/blob/v10.6.4/releasing/plugin-commands-publishing/src/pack.ts#L155-L160) includes that workspace-root license when a package has no own license file, so package copies and an npm license-copy helper are unnecessary. The explicit `pnpm run extension:license` command prepares an ignored extension copy only for its distribution path. Do not generate license copies as a local execution prerequisite or commit them.

The current runtime launches `ttsx` using the calling process's Node executable, explicit argument arrays, and the selected cwd/entry/optional tsconfig. It inherits terminal streams and environment, with optional connection values applied to the child. `ttsx` owns project discovery, diagnostics, transformations, source maps, and its private compilation cache. Runtime success reports the direct launcher's exit, not an independently verified scene mutation or process-tree shutdown. Define unsaved Blender text's project identity and imports before adding that path; an arbitrary temporary directory is not an equivalent project.

References: [shared compiler configuration](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/config/tsconfig.json#L3), [package compiler transform](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/packages/interface/tsconfig.json#L2), [source and publish exports](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/packages/interface/package.json#L5), [CLI scripts](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/packages/cli/package.json#L6), [lint configuration](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/config/lint.ts#L1).

## Source and documentation style

The [development skill](../.agents/skills/development/SKILL.md) owns explicit type annotations, meaningful JSDoc, one matching exported symbol per file, file size, logical paragraphs, and consumer verification. The [documentation skill](../.agents/skills/documentation/SKILL.md) owns language and explanation style. Blendia retains requested Korean research and conversation evidence as a deliberate adaptation to AutoMovie's broader English-language policy. Both production named functions and arrows are permitted; test scenario exports follow the narrower testing convention.

Every repository-authored TypeScript object type is a named interface in its own same-named file. Inline object type literals are forbidden in aliases, union branches, signatures, generic arguments, assertions, and configuration; `IBlendiaCommand` has no exception. Union types refer to their named variant interfaces. This concerns type syntax, not object values passed to an API.

Markdown follows the user's explicit one-paragraph-per-line convention: each ordinary prose paragraph occupies one physical source line, with editor word wrap providing visual wrapping. Blank paragraph separators, headings, list structure, tables, and fenced code retain their semantic boundaries. The documentation skill owns this rule for future writing and formatter choices.

The implemented [Prettier configuration](../.prettierrc.json) follows AutoMovie's 80-column, two-space, semicolon, trailing-comma, and import-grouping choices. Interface-prefixed names and closed-union names remain observed patterns rather than a claim that every type must have an `I` prefix. AutoMovie's product-specific prohibition on typia tags is not copied into a project whose protocol and MCP design explicitly uses typia. Film-production, Three.js, and browser-viewer ownership rules are likewise excluded.

References: [development rules](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/.agents/skills/development/SKILL.md#L14), [formatting configuration](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/.prettierrc.json#L2), [documentation rules](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/.agents/skills/documentation/SKILL.md#L10).

## Meaningful tests and current checks

The [testing guide](../.agents/skills/development/testing.md) applies the user's requirement to test only actual first-party logic. Two authored unit files now observe code consumed by the real product: [CLI argument grammar](../test/src/features/cli/test_cli_arguments.ts) and [SDK stream framing](../test/src/features/sdk/test_blender_frames.ts). Their literal expectations cover argument ownership/refusals and framed-byte fragmentation, coalescing, strict decoding, and size boundaries. They do not start child processes, sockets, or Blender. [Unit verification guidance](../test/UNIT_TESTS.md) owns execution instructions and limitations.

The minimal [unit entrypoint](../test/src/index.ts) discovers named `test_` exports under `features`, reports each result, and returns nonzero for failures or an empty discovery. It has no synthetic runner test suite or case-selection grammar. The test workspace uses the existing shared Node compiler configuration and package-local lint configuration; Evidence contracts apply to material requirements of the actual case functions. These files are authored verification scope, not a passing-results claim; outcomes and any production diagnostics that prevent execution are recorded in [#6](https://github.com/samchon/blendia/issues/6) and the implementation PRs.

The rejected package/configuration assertions, empty-module imports, upstream transformation checks, distribution smoke tests, and synthetic runner cases are removed. They are not retained as manual probes or substituted with an empty passing runner. [Validation guidance](../.agents/skills/development/validation.md) owns the direct checks and the repository-wide batch-by-cause rule.

Only [build.yml](../.github/workflows/build.yml) and [test.yml](../.github/workflows/test.yml) define CI. Both run on pull requests and pushes to `master`, install the frozen lockfile with pinned actions and Node 22.23.2, and grant read-only contents access. The build workflow runs the config/product development lint guard before ordinary compilation/configuration checks, alongside formatting. The test workflow keeps Wrtn Evidence and an Ubuntu/Windows unit matrix with fail-fast disabled; unit jobs run their development lint guard, ordinary type checking, and units directly from source with no build step. CI configuration is not CI success. Unit jobs do not establish Blender installation, extension registration, main-thread execution, GUI behavior, or rendering; the supported live workflow needs its own direct product-validation evidence.

Reference: [AutoMovie build CI](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/.github/workflows/build.yml#L17). Its original test implementation is not an adopted Blendia requirement; the user's meaningful-tests rule controls the current scope.

## Agent instructions and skills

The repository now contains seven actual skills: project, development, contracts, documentation, prompting, review, and pull-request. [AGENTS.md](../AGENTS.md) routes the repository guidance and skill triggers. [CLAUDE.md](../CLAUDE.md) contains exactly `@AGENTS.md` plus the final newline. Supporting guides are directly linked siblings in the single `.agents/skills` tree. There are no duplicated `.claude/skills` or `.codex/skills` copies or skills junctions. This follows the inspected AutoMovie files rather than assuming checkout hardlinks are a portable instruction mechanism.

The [prompting skill](../.agents/skills/prompting/SKILL.md) owns frontmatter, triggers, concise routing, supporting-guide layout, and single rule ownership. The [review skill](../.agents/skills/review/SKILL.md) owns complete-change review. The [pull-request skill](../.agents/skills/pull-request/SKILL.md) owns Draft-first issue/branch/PR setup and delivery, including the user's standing instruction to merge after a clean self-review and required green CI on the current head. Product-specific film skills and model-branded prompting links were not copied.

The [contracts skill](../.agents/skills/contracts/SKILL.md) owns the required `@wrtnlabs/evidence` checker, package-local selectors, grounded answers, and applicability. Select a declaration and question because it owns a material requirement; neither all common/performance questions nor a replacement universal question applies to every declaration. Performance contracts belong only to operations with material algorithm, reuse, or resource-lifetime requirements. DTOs, simple parsers, and configuration do not need performance boilerplate, invented `O(1)` assurances, or repeated exclusions. Preserve useful JSDoc and select meaningful first-party unit contracts. A package with no material claim has no claim to prove; report actual selection and results without manufacturing respondents or removing a real obligation to obtain a pass.

`@ttsc/evidence` supplies complementary documented-declaration, singular, and TODO guards through `@ttsc/lint`; it does not replace `@wrtnlabs/evidence`. Evidence structure, reviewers' assessment of grounded answers, unit behavior, and direct live-Blender validation establish different things. Review current answers against the actual transport, reference-lifetime, and launch behavior. A structural pass alone cannot establish that those features work, and future public job interfaces need contracts alongside their real implementation.

References: [AutoMovie router](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/AGENTS.md#L32), [Claude delegation](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/CLAUDE.md#L1), [instruction ownership and layout](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/.agents/skills/prompting/SKILL.md#L10), [evidence contracts](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/.agents/skills/contracts/SKILL.md#L8), [checker dependency](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/package.json#L32), [production checker configuration](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/packages/engine/evidence.config.ts#L1).

## Shared checkout and completion records

The routed skills and repository-wide instructions own shared-checkout edits, Windows cleanup, issue records, and PR delivery. Work uses the original checkout; do not create worktrees, alternate checkouts, or extra clones. Optional personal conversation records under ignored `.agents/local` never enter the Git index, stash, or commits, and their contents must not be copied into public records. Tracked AGENTS and skills remain sufficient in a fresh clone without those records.

The initial convention research was checked by both AutoMovie source researchers and by local source-link inspection. Saved-project implementation history remains in [PR #9](https://github.com/samchon/blendia/pull/9), and the current source-first cleanup and its verification belong in [#12](https://github.com/samchon/blendia/issues/12) and [PR #11](https://github.com/samchon/blendia/pull/11). Historical research is preserved as dated context, not an override of current project rules. This document does not certify a passing run. The broader product work remains tracked by [#1](https://github.com/samchon/blendia/issues/1).
