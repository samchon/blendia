# Source-first contracts and repository cleanup

This debt-only mission starts from merged PR #9, before any changes from the paused UI/Text PR #10. Its useful planning seed establishes the Draft before implementation. The UI feature working tree was preserved separately; it must not be mixed into this cleanup.

## Decided requirements

1. Local workspace entrypoints resolve TypeScript source and run through ttsx without a prior build. Follow the inspected AutoMovie source-main/source-exports and separate publishConfig distribution pattern. Local units and Evidence must not require generated lib output. Ordinary build output remains a distribution concern, not a local development prerequisite.
2. Replace every inline TypeScript object type (AST TypeLiteral) with a named declaration in its own appropriately named file, including command unions such as IBlendiaCommand. Preserve actual public behavior and avoid manufacturing AST/configuration assertion tests.
3. Remove blanket performance-contract boilerplate across packages. Retain only performance claims that are necessary, specific and supported by the declaration; preserve meaningful common/testing contracts and the required package-local @wrtnlabs/evidence integration.
4. Personal records under .agents/local remain ignored local data and must never enter an index, stash or commit. Portable AGENTS/skills remain sufficient in a fresh clone. Metadata-only inspection found the current local path absent from the index, HEAD, origin/master and fetched all-reference history; the older differently named tracked record was removed in PR #9. Do not expose private contents or rewrite history without authorization.
5. The original cleanup removed .github/workflows/verify.yml and kept build.yml and test.yml. The later authorized [actual-engine validation scope](automated-validation.md#ci-and-coverage-limits) adds a separate blender.yml workflow; source-first execution and the rejection of fake/static checks remain unchanged.
6. Remove tracked package LICENSE copies. Preserve the root LICENSE, prepare necessary copies only for distribution using the actual AutoMovie pattern, and ignore generated package copies. No tarballs, lib, node_modules, scratch artifacts or private records may be committed.

## Verification and boundary

### Execution and development lint

The subsequent macro slice preserves this source-first baseline while separating Blendia's development lint from automatic product execution. Existing shared and child tsconfigs opt out of their own `@ttsc/lint` entry through its public `enabled: false` setting. Other configured or automatically discovered plugins, including typia, continue under the ordinary toolchain policy; no global plugin bypass or alternate checking tsconfig is introduced.

The additional `pnpm lint` command runs [config/checkLint.ts](../../config/checkLint.ts) through `ttsx` for config, the product packages, and the test workspaces. It uses the public `TtscCompiler` with an explicit lint-only plugin list against each workspace's existing tsconfig. That API has no `noEmit` option: the guard discards its private memory/temporary output without writing package `lib`. Normal `ttsc` builds, `ttsc --noEmit`, and material package-local Wrtn Evidence checks retain their roles. The guard adds development diagnostics rather than replacing emit or transformer validation. No runtime/core scene behavior or measured speedup is claimed by this configuration change. [Conventions](../conventions.md#compiler-exports-and-commands) own the executable command list.

### Original debt acceptance

Use direct applicable toolchain checks, existing meaningful units of implemented first-party logic, and a complete independent review. Do not add static configuration/manifest assertions, upstream tests, artificial source-compile/import probes, package/tarball smoke tests or an automated integration harness to demonstrate these changes. Gather all relevant failures first, correct them by cause in one batch, then perform the next full affected round.

Keep the PR Draft through implementation. Record current-head self-review as COMMENT and require every configured check green on the exact source head before Ready and immediate merge. No UI/Text feature, material/render/jobs/MCP behavior, publication, version bump or release is part of this debt slice. Resume the preserved UI/Text mission only after the cleanup is merged and its contract is reconciled with the new source-first baseline.

Tracking starts with #1 and completed infrastructure issue #7; a focused debt issue will hold the detailed acceptance and audit evidence. [AutoMovie](https://github.com/samchon/AutoMovie/tree/ba7f7569ac664aaf5540eb9dde5c5039850899c5) is a read-only reference, not a destination for edits.
