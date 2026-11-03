# Canonical user instructions

Reopen this file before every work unit, tool invocation, or other action. Check the intended action against the latest instructions here and the applicable skills before proceeding. Keep this file current when the user adds or corrects an instruction; update its callers in the same batch. This file owns user requirements; skills own the procedures that apply them.

## Delegation

The supervising agent only manages and supervises sub-agents. Sub-agents perform all research, repository changes, verification, reviews, issue maintenance, and PR delivery. The supervisor coordinates ownership and evaluates their reported results.

## Product and current scope

Blendia is a pnpm TypeScript monorepo that lets coding agents such as Claude Code and Codex use an existing Blender installation through TypeScript. Users should also be able to run project TS from Blender through an extension. Blender owns modeling, scene evaluation, UI, and rendering; this project does not reimplement Blender or create a web Blender. Three.js integration is excluded.

Use the existing `ttsc` package's `ttsx` for TypeScript execution and the Node.js/npm ecosystem. Python is necessary for the Blender extension and code that must execute against `bpy` inside Blender. Use `typia.llm.application` and `@typia/mcp` for the planned MCP surface rather than inventing another MCP framework. MCP complements the TS interface, including visual inspection and debugging; it is not restricted to images.

Complete the package/toolchain frame, Evidence, TypeScript configuration, CI, and agent skills first. After its PR is merged, continue staged functional Blendia issues autonomously. Use judgment to maintain issues, choose the next bounded mission, and complete its PR without requesting repeated approval. Open that mission's Draft before any product implementation. This authorization does not add goals, automations, or unrelated product scope.

The intended scripting experience is project TypeScript and macros through an existing Blender installation. A complete TS IDE inside Blender, replacement of every Python addon callback, and full Blender API parity are separate scopes; do not expand a staged mission into them.

The CLI package is named `blendia` without an npm scope. Its repository directory remains `packages/cli`; do not name the package `@blendia/cli`.

## Draft-first PR delivery

Create a Draft PR before implementation begins. Establish the issue, branch, scope, and Draft URL first; do not wait until the implementation or CI is ready to open it. If GitHub requires a first commit, use a minimal policy or planning seed to establish the Draft, then implement inside that PR.

For every PR, confirm that the work is ready, complete a fresh clean self-review round, and verify configured required CI checks are green on its exact current head. Once these conditions hold, mark the PR ready and merge immediately without another permission request, update the issues, and proceed to the next authorized mission. Never bypass failing checks or branch protection.

Stage an explicit allowlist of intended source, configuration, documentation, and lockfile changes. Inspect the staged diff before committing. Never commit or push generated tarballs, `lib` output, `node_modules`, scratch artifacts, or temporary binaries.

## AutoMovie conventions and tooling

Follow the inspected `D:/github/samchon/AutoMovie` coding style, pnpm/TypeScript toolchain patterns, and skill composition style as adapted by the actual Blendia skills. Keep one `.agents/skills` tree, short skill overviews with directly linked sibling guides, precise triggers, and one owner per rule. `AGENTS.md` routes those skills; `CLAUDE.md` delegates to it.

Use `@wrtnlabs/evidence` with catalog range `^0.9.0`, package-local `evidence.config.ts` files, linked evidence contracts, and recursive aggregation. Keep Evidence configuration in each package; do not replace it with shared configuration. `@ttsc/evidence` compiler-lint guards are complementary.

The common lint implementation belongs directly in `config/lint.config.ts`. Package-local lint configuration re-exports that canonical file. Use each existing `tsconfig.json` with `ttsc --noEmit` for checking; do not add `tsconfig.check.json` or an equivalent extra checking project.

## Meaningful tests only

Write only meaningful unit tests of actual first-party logic. Do not invent implementation solely to have something to test. Do not add package.json/configuration string or structure tests, empty-package import tests, upstream typia transformation tests, distribution/export/tarball smoke tests, or synthetic tests of logic created only for testing. Do not reintroduce those rejected checks as manual smoke probes. Remove all current test implementations and synthetic runner infrastructure.

The current frame reserves only `test/README.md`: no test workspace, test configuration, barrel, harness, dependencies, commands, or CI test job. Future unit-test setup arrives with the first real first-party logic. Use direct compiler, formatter, Evidence, and CI execution to check the frame; do not claim those checks prove product behavior or fabricate passing scenarios.

Earlier integration research is advisory context for future manual validation of real product behavior. It does not authorize automated integration suites under the current unit-test-only instruction. Do not substitute an upstream or synthetic smoke probe for real product validation.

## Fix by cause, in one batch

Never fix one symptom, re-check, then chase the next. For any tests, CI, review, render, or debugging work:

1. Gather all the evidence in one inspection round: every relevant test result, render, measurement, and log.
2. List every phenomenon with its root cause and its contributing factors.
3. Fix them all by cause in one change, then verify with the next full round.

Each fix-and-recheck loop costs usage and time, so batching by cause is what fits the work into the weekly limit.

## Windows cleanup without force

For already-authorized cleanup of verified task-owned paths, use PowerShell `Remove-Item -LiteralPath` without `-Force` by default. If a deletion containing `-Force` is rejected with `blocked by policy`, retry the same verified target without `-Force` before asking the user to perform cleanup. Remove a junction itself before recursively removing its owning temporary directory, and preserve the junction target. Do not treat this as permission to ignore a refusal that still applies without `-Force`.

## Research and work are maintained in GitHub issues

Treat GitHub issues as the persistent record of research, decisions, open questions, implementation scope, and verification for this repository.

1. Search and read relevant existing issues, including closed issues, before creating new ones. Extend the existing issue when it represents the same work.
2. Record substantive research with enough context to stand alone: the problem, user requirements, dated source links, relevant examples or reported experience, limitations, decisions, alternatives, and unresolved questions. Distinguish verified facts, external claims, proposals, and measured results.
3. Keep an overarching tracking issue and focused actionable issues where the scope warrants them. Link dependencies and related work in both directions. Make each actionable issue's scope and acceptance criteria explicit.
4. Consolidate overlapping or superseded issues while preserving source references, useful discussion, and links to replacement issues. Do not close unrelated work or discard history.
5. Keep issue descriptions, checklists, decisions, references, and status current as evidence and implementation change. An issue is complete only when its stated acceptance criteria have been met and the verification evidence is recorded.
6. Reference the relevant issue IDs in implementation changes and review descriptions. Keep repository research documents linked from their tracking issues; documents supplement the issues rather than replacing them.
7. If GitHub access is unavailable, preserve ready-to-file issue content locally and report the exact blocker. Publish and reconcile it with the tracker once access is restored.
