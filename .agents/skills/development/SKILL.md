---
name: development
description: Implements and validates Blendia source, tests, package wiring, tooling, and workflows. Use before editing those files; declaration evidence belongs to contracts.
---

# Development

Read [project](../project/SKILL.md) for scope and language ownership, [contracts](../contracts/SKILL.md) for selected declarations, and [documentation](../documentation/SKILL.md) for comments.

## TypeScript style

Annotate variables, parameters, and function return types. Use inference where syntax does not permit an annotation, such as `for...of` bindings; catch bindings may infer `unknown`. Keep each source file below 500 lines and export one same-named symbol, with barrel files as the exception. Give maintained declarations meaningful JSDoc rather than repeating their names and types.

Separate logical steps with blank lines. Explain a non-obvious step's intent, premise, or reason in a nearby comment. Precede an inner comment with a blank line unless it opens its block. Production arrow functions are permitted; scenario exports follow [testing.md](testing.md).

Shared `config` owns strict compiler settings, correctness lint through `@ttsc/lint`, complementary `@ttsc/evidence` declaration guards, and Prettier formatting. The common lint implementation belongs directly in `config/lint.config.ts`; a package's `lint.config.ts` re-exports it. Keep formatting diagnostics disabled in compiler lint. The implemented SDK, runtime, and CLI expose built JS and declarations from `lib` through `main`, `types`, and public exports; only the reserved MCP shell retains source exports. Build producer packages in dependency order before unit tests, test type checking, and Evidence checks.

## Changes and verification

Add a public producer API with its real consumer and verify that seam. Add package dependencies at their owner; do not create abstractions for unimplemented product features. Use [testing.md](testing.md) when changing tests and [validation.md](validation.md) when planning checks or completing a change.

In a shared checkout, own your scratch paths and edits, stage explicit intended files, and preserve other agents' work. Cleanup follows the repository-wide Windows rule.
