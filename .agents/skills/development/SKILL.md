---
name: development
description: Implements and validates Blendia source, tests, package wiring, tooling, and workflows. Use before editing those files; declaration evidence belongs to contracts.
---

# Development

Read [project](../project/SKILL.md) for scope and language ownership, [contracts](../contracts/SKILL.md) for selected declarations, and [documentation](../documentation/SKILL.md) for comments.

## TypeScript style

Annotate variables, parameters, and function return types. Use inference where syntax does not permit an annotation, such as `for...of` bindings; catch bindings may infer `unknown`. Keep each source file below 500 lines and export one same-named symbol, with barrel files as the exception. Give maintained declarations meaningful JSDoc rather than repeating their names and types.

Every object type in repository-authored TypeScript must be a named interface in its own same-named file. Inline object type literals are forbidden in aliases, unions, signatures, generic arguments, assertions, and configuration; `IBlendiaCommand` has no exception. Reference the named interface instead of hiding an inline object shape behind another type expression. This rule concerns type syntax, not object values.

Separate logical steps with blank lines. Explain a non-obvious step's intent, premise, or reason in a nearby comment. Precede an inner comment with a blank line unless it opens its block. Production arrow functions are permitted; scenario exports follow [testing.md](testing.md).

Shared `config` owns strict compiler settings, correctness lint through `@ttsc/lint`, complementary `@ttsc/evidence` declaration guards, and Prettier formatting. The common lint implementation belongs directly in `config/lint.config.ts`; a package's `lint.config.ts` re-exports it. The workspace's `@ttsc/lint` entry uses the public `enabled: false` option in each existing tsconfig to opt out of automatic discovery, while the explicit `lint` command checks those rules separately. Normal `ttsc` and `ttsx` retain the other configured and automatically discovered plugins, including typia. Keep formatting diagnostics disabled in compiler lint; see [validation](validation.md) for the additional diagnostics guard.

## Local source and distribution

Local development uses TypeScript sources without a build. Preserve this invariant in every package, resolver, launcher, and CI change. Following AutoMovie, package `main` is `src/index.ts`, local `exports["."]` points to `./src/index.ts`, and there is no local `types` field. Local CLI execution uses `ttsx`, with package `start` running `ttsx src/bin.ts`. Local execution, unit tests, test type checking, and Evidence must not require `lib` output or a preceding build.

Keep distribution metadata separate in `publishConfig`: `main` points to `lib/index.js`, `types` to `lib/index.d.ts`, and the published root export has built `types` and `default` entries. The CLI's `lib/bin.js` bin is a distribution entry, not the local execution path. Compilation remains an independent output-validation or distribution step. Do not add custom conditions, extra checking projects, or compiled fallbacks to compensate for broken source resolution.

The repository-root `LICENSE` is the sole maintained product license. Create package copies only as distribution artifacts, ignore them in Git, and never commit those copies.

## Changes and verification

Add a public producer API with its real consumer and verify that seam. Add package dependencies at their owner; do not create abstractions for unimplemented product features. Use [testing.md](testing.md) when changing tests and [validation.md](validation.md) when planning checks or completing a change.

Use the original repository checkout under the [PR workflow](../pull-request/SKILL.md), own your scratch paths and edits, stage explicit intended files, and preserve other agents' work. Cleanup follows the repository-wide Windows rule.
