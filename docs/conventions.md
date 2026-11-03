# Blendia development conventions

Tracking: [conventions and tooling #7](https://github.com/samchon/blendia/issues/7), [integration and evidence #6](https://github.com/samchon/blendia/issues/6), and [overall research and implementation #1](https://github.com/samchon/blendia/issues/1).

This document records Blendia's current development structure and its adaptation of the inspected AutoMovie repository. The SDK, runtime, CLI, and Python extension now contain the first project-scripting implementation, with unit cases for actual CLI grammar and stream-framing logic. The MCP package remains an empty reserved boundary. These are source-level implementation facts, not claims that compilation, unit execution, CI, or live Blender validation has passed. The [repository instructions](../AGENTS.md) route requirements, the [project skill](../.agents/skills/project/SKILL.md) owns scope and commands, and the other routed skills own their procedures. The initial frame is recorded in [PR #8](https://github.com/samchon/blendia/pull/8); the current scripting slice is developed in [PR #9](https://github.com/samchon/blendia/pull/9).

The reference was inspected read-only on 2026-11-03 at AutoMovie commit [`ba7f7569ac664aaf5540eb9dde5c5039850899c5`](https://github.com/samchon/AutoMovie/tree/ba7f7569ac664aaf5540eb9dde5c5039850899c5). No AutoMovie installation, build, or test was run during that inspection. Source configuration establishes the reference behavior; it is not execution evidence. Research and implementation status belong in the repository's GitHub issues. The [architecture research](research/2026-11-03-blender-ts-mcp.md) supplies product context and the open design questions.

## Product boundaries and language ownership

Blendia lets users and coding agents write project TypeScript that controls an existing Blender installation. Blender owns geometry, scene evaluation, viewport, rendering, and file formats. Node.js and the existing `ttsc` package's `ttsx` own TypeScript execution. Three.js integration is outside the requested scope.

Use TypeScript for the SDK, execution management, CLI, MCP facade, generators, and general development helpers. Use Python for code that must run against `bpy` inside Blender: the extension, main-thread dispatch, UI integration, and API metadata extraction. Do not reproduce Blender functionality merely to satisfy a TypeScript-only rule. C++, Rust, another embedded JS engine, and a Blender fork are not prerequisites for the first implementation.

The current CLI delegates saved project-file execution to the shared runtime, and the script uses the SDK to connect to Blender. The extension owns authenticated loopback transport and main-thread scene operations. Public job, Stop, and log-cursor interfaces are not implemented in this slice. MCP and Blender's Run TypeScript action remain future consumers of the shared implementation. The requested `typia.llm.application` and `@typia/mcp` approach remains the MCP direction; no MCP server or direct typia/MCP product dependency is introduced by this slice.

The first vertical slice contains explicit cube creation, object readback, and local-transform operations, along with session/generation-aware handles and errors that distinguish potentially applied mutations. Its source and remaining validation scope are described in [the scripting design](design/scripting.md). Blender's Run TypeScript action, unsaved editor text, rendering, and additional scene operations are follow-up work. Full `bpy` parity, all synchronous Python addon callbacks in TS, and a complete TS IDE inside Blender remain separate scopes requiring explicit issues and evidence.

## Workspace and dependency ownership

The current pnpm workspace contains `config`, `packages/*`, and the first-party `test` workspace. The Python extension is maintained alongside those Node projects:

```text
blendia/
  .agents/skills/                seven scoped skills and their linked guides
  .github/workflows/
  config/                       shared compiler, lint, and formatting support
  packages/{sdk,runtime,cli,mcp}/ TS packages; MCP remains reserved
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

`@blendia/sdk` exposes `BlenderClient`, scene/session types, and `BlenderError`; internal protocol/framing code belongs with that client. `@blendia/runtime` exposes `runProjectScript` and its options/result types. The unscoped `blendia` package remains at `packages/cli`, consumes the runtime, and declares its built `blendia` executable. `@blendia/mcp` still exports an empty module. `@blendia/config` owns shared tooling, and `@blendia/test` consumes actual first-party CLI and SDK logic. The product packages remain private and are not published. Protocol and codegen packages are not added merely to reach the count in an earlier proposal.

Put shared dependency versions in `pnpm-workspace.yaml` catalogs and use `workspace:^` for internal dependencies unless a documented constraint requires another workspace range. Pin the package manager in `package.json` and commit the lockfile. Declare package dependencies so recursive pnpm builds follow their dependency graph; do not hardcode package ordering or introduce Turbo/Nx by default. Include only the actual Blendia workspace directories, without AutoMovie's `movies`, `experimental`, or website entries.

Blendia pins pnpm 10.6.4 and Node 22.23.2, following the inspected reference. Its lockfile selects TypeScript 7.0.2, `ttsc`, `@ttsc/lint`, and `@ttsc/evidence` 0.35.0, and `@wrtnlabs/evidence` 0.9.0 from the required catalog range `^0.9.0`. The unit workspace uses the catalog's `@nestia/e2e` range `^12.1.0` for its minimal DynamicExecutor entrypoint. The workspace catalogs declare ranges, and the lockfile supplies installed versions; these are not claims of current releases. AutoMovie's separate `typescript-compiler` alias points to TypeScript 5.9.3, which this repository does not need. No upstream typia test is introduced. Verification results and toolchain constraints belong in the implementation issues and PR.

References: [root package](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/package.json#L6), [workspace catalogs](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/pnpm-workspace.yaml#L1).

## Compiler, exports, and commands

The implemented [shared compiler configuration](../config/tsconfig.json) follows AutoMovie's pattern. Package configurations extend it, use `src` as `rootDir`, and emit to `lib`. The baseline is ES2022, CommonJS, strict checking, unused-local and unused-parameter checking, declarations, source maps, consistent filename casing, `stripInternal`, and Node types. Blendia omits AutoMovie's shared DOM library because these packages have no DOM consumer. Package-specific ESM configuration remains an option if an actual dependency requires it.

Package-local `lint.config.ts` files re-export the [shared lint configuration](../config/lint.config.ts), which contains the policy directly and is applied through the `@ttsc/lint` compiler transform. This canonical filename follows the user's Blendia configuration choice; the historical AutoMovie source remains `config/lint.ts`. Prettier owns formatting, with duplicate formatting diagnostics disabled in compiler lint. AutoMovie's correctness rule families cover promise handling, strict equality, exhaustive decisions, and `node:` imports. Neither repository's base setup introduces a separate ESLint CLI. `config:check` runs `ttsc --noEmit` against the existing `config/tsconfig.json`; no separate checking tsconfig is introduced. Evidence configuration remains package-local.

The shared configuration uses the exact owner-relative exclusion `ignores: ["lint.config.ts"]` because this conventional tooling filename is not a public same-named API declaration. It excludes that tooling file from all compiler-lint rules, not only the singular-declaration rule. Ordinary `ttsc --noEmit` checking, its `satisfies ITtscLintConfig` constraint, and Prettier formatting still apply to the shared configuration. Product source guards remain enabled at their configured error severity.

The SDK, runtime, and CLI manifests resolve their public package specifiers to built JavaScript and declarations in `lib`, both in the workspace and through `publishConfig`; the reserved MCP package retains its empty source entrypoint for workspace resolution. `prepack` is configured to build each package. `blendia` declares `lib/bin.js` as its executable and uses `ttsx src/bin.ts` for its local `start` script. Build packages before running their consumers; manifest settings do not establish a release or distribution-testing claim, and package publication remains disabled.

The executable command contract belongs to [workspace commands](../.agents/skills/project/commands.md), backed by [root scripts](../package.json). A complete local source-and-unit check uses:

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm run config:check
pnpm run test:types
pnpm run format:check
pnpm run evidence
pnpm test
```

Root `build` recursively compiles the four `packages/*` projects in dependency order, while `config:check` checks shared tooling and `test:types` separately compiles the unit workspace without emitting. Product builds use `rimraf lib && ttsc`. Run `build` before `test:types`, `test`, or `evidence` because package consumers resolve built `lib` output. `pnpm test` executes the two named first-party unit files through `ttsx src/index.ts`; it needs no Blender installation. Root Evidence aggregation includes the product packages and `test` without stopping at the first package failure. None of these checks alone establishes extension, GUI, or end-to-end Blender behavior, and the existence of the commands does not imply a successful run.

The current runtime launches `ttsx` using the calling process's Node executable, explicit argument arrays, and the selected cwd/entry/optional tsconfig. It inherits terminal streams and environment, with optional connection values applied to the child. `ttsx` owns project discovery, diagnostics, transformations, source maps, and its private compilation cache. Runtime success reports the direct launcher's exit, not an independently verified scene mutation or process-tree shutdown. Define unsaved Blender text's project identity and imports before adding that path; an arbitrary temporary directory is not an equivalent project.

References: [shared compiler configuration](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/config/tsconfig.json#L3), [package compiler transform](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/packages/interface/tsconfig.json#L2), [source and publish exports](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/packages/interface/package.json#L5), [CLI scripts](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/packages/cli/package.json#L6), [lint configuration](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/config/lint.ts#L1).

## Source and documentation style

The [development skill](../.agents/skills/development/SKILL.md) owns explicit type annotations, meaningful JSDoc, one matching exported symbol per file, file size, logical paragraphs, and consumer verification. The [documentation skill](../.agents/skills/documentation/SKILL.md) owns language and explanation style. Blendia retains requested Korean research and conversation evidence as a deliberate adaptation to AutoMovie's broader English-language policy. Both production named functions and arrows are permitted; test scenario exports follow the narrower testing convention.

Markdown follows the user's explicit one-paragraph-per-line convention: each ordinary prose paragraph occupies one physical source line, with editor word wrap providing visual wrapping. Blank paragraph separators, headings, list structure, tables, and fenced code retain their semantic boundaries. The documentation skill owns this rule for future writing and formatter choices.

The implemented [Prettier configuration](../.prettierrc.json) follows AutoMovie's 80-column, two-space, semicolon, trailing-comma, and import-grouping choices. Interface-prefixed names and closed-union names remain observed patterns rather than a claim that every type must have an `I` prefix. AutoMovie's product-specific prohibition on typia tags is not copied into a project whose protocol and MCP design explicitly uses typia. Film-production, Three.js, and browser-viewer ownership rules are likewise excluded.

References: [development rules](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/.agents/skills/development/SKILL.md#L14), [formatting configuration](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/.prettierrc.json#L2), [documentation rules](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/.agents/skills/documentation/SKILL.md#L10).

## Meaningful tests and current checks

The [testing guide](../.agents/skills/development/testing.md) applies the user's requirement to test only actual first-party logic. Two authored unit files now observe code consumed by the real product: [CLI argument grammar](../test/src/features/cli/test_cli_arguments.ts) and [SDK stream framing](../test/src/features/sdk/test_blender_frames.ts). Their literal expectations cover argument ownership/refusals and framed-byte fragmentation, coalescing, strict decoding, and size boundaries. They do not start child processes, sockets, or Blender. [Unit verification guidance](../test/UNIT_TESTS.md) owns execution instructions and limitations.

The minimal [unit entrypoint](../test/src/index.ts) discovers named `test_` exports under `features`, reports each result, and returns nonzero for failures or an empty discovery. It has no synthetic runner test suite or case-selection grammar. The test workspace uses the existing shared Node compiler configuration, a package-local lint configuration, and an Evidence selector for the two actual case functions. These files are authored verification scope, not a passing-results claim; outcomes and any production diagnostics that prevent execution are recorded in [#6](https://github.com/samchon/blendia/issues/6) and [PR #9](https://github.com/samchon/blendia/pull/9).

The rejected package/configuration assertions, empty-module imports, upstream transformation checks, distribution smoke tests, and synthetic runner cases are removed. They are not retained as manual probes or substituted with an empty passing runner. [Validation guidance](../.agents/skills/development/validation.md) owns the direct checks and the repository-wide batch-by-cause rule.

The implemented [verification workflow](../.github/workflows/verify.yml) runs on pull requests and pushes to `master`, installs the frozen lockfile with pinned actions and Node 22.23.2, and grants read-only contents access. Separate jobs execute source build/configuration checks, formatting, and Evidence; an Ubuntu/Windows unit matrix performs `test:types` and unit execution with fail-fast disabled. Evidence and unit jobs build packages before their consumer checks. CI configuration is not CI success. Unit jobs do not establish Blender installation, extension registration, main-thread execution, GUI behavior, or rendering; the supported live workflow needs its own direct product-validation evidence.

Reference: [AutoMovie build CI](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/.github/workflows/build.yml#L17). Its original test implementation is not an adopted Blendia requirement; the user's meaningful-tests rule controls the current scope.

## Agent instructions and skills

The repository now contains seven actual skills: project, development, contracts, documentation, prompting, review, and pull-request. [AGENTS.md](../AGENTS.md) routes the repository guidance and skill triggers. [CLAUDE.md](../CLAUDE.md) contains exactly `@AGENTS.md` plus the final newline. Supporting guides are directly linked siblings in the single `.agents/skills` tree. There are no duplicated `.claude/skills` or `.codex/skills` copies or skills junctions. This follows the inspected AutoMovie files rather than assuming checkout hardlinks are a portable instruction mechanism.

The [prompting skill](../.agents/skills/prompting/SKILL.md) owns frontmatter, triggers, concise routing, supporting-guide layout, and single rule ownership. The [review skill](../.agents/skills/review/SKILL.md) owns complete-change review. The [pull-request skill](../.agents/skills/pull-request/SKILL.md) owns Draft-first issue/branch/PR setup and delivery, including the user's standing instruction to merge after a clean self-review and required green CI on the current head. Product-specific film skills and model-branded prompting links were not copied.

The [contracts skill](../.agents/skills/contracts/SKILL.md) owns the required `@wrtnlabs/evidence` checker, H2 checklists, grounded `@evidence` answers, and scoped reasoned exclusions. Each product package and the unit workspace has a package-local `evidence.config.ts`, error severity, and `evidence` CLI script. Product selectors reference common/performance contracts for maintained source declarations; the test selector references testing contracts for the two named units. SDK, runtime, and CLI declarations and first-party units are now actual respondents. MCP still has no product declarations. Report checker selection and results from the real run rather than inferring coverage or correctness from configuration alone.

`@ttsc/evidence` supplies complementary documented-declaration, singular, and TODO guards through `@ttsc/lint`; it does not replace `@wrtnlabs/evidence`. Evidence structure, reviewers' assessment of grounded answers, unit behavior, and direct live-Blender validation establish different things. Review current answers against the actual transport, reference-lifetime, and launch behavior. A structural pass alone cannot establish that those features work, and future public job interfaces need contracts alongside their real implementation.

References: [AutoMovie router](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/AGENTS.md#L32), [Claude delegation](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/CLAUDE.md#L1), [instruction ownership and layout](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/.agents/skills/prompting/SKILL.md#L10), [evidence contracts](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/.agents/skills/contracts/SKILL.md#L8), [checker dependency](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/package.json#L32), [production checker configuration](https://github.com/samchon/AutoMovie/blob/ba7f7569ac664aaf5540eb9dde5c5039850899c5/packages/engine/evidence.config.ts#L1).

## Shared checkout and completion records

The routed skills and repository-wide instructions own shared-checkout edits, Windows cleanup, issue records, and PR delivery. The initial convention research was checked by both AutoMovie source researchers and by local source-link inspection. Current source checks, unit results, complete review, exact CI head, and direct Blender observations belong in their implementation issues and [PR #9](https://github.com/samchon/blendia/pull/9); the initial frame history remains in [tooling #7](https://github.com/samchon/blendia/issues/7). This document does not certify a passing run or a completed live workflow. The broader product work remains tracked by [#1](https://github.com/samchon/blendia/issues/1).
