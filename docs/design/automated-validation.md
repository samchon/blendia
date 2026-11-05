# Automated validation

Tracking: [validation #6](https://github.com/samchon/blendia/issues/6) and [PR #17](https://github.com/samchon/blendia/pull/17). This guide describes the authored test modules and execution boundaries. Counts and configured workflows describe verification scope, not passing results; current-head outcomes belong in the tracker. The [support matrix](../support.md) separates prior real-host observations from this automated coverage.

## Two source test modules

| Workspace                                      | Execute from repository root     | Scope                                                                                                                                  |
| ---------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/test-units` / `@blendia/test-units`     | `pnpm test:units` or `pnpm test` | Named first-party cases in the [current inventory](../../tests/test-units/UNIT_TESTS.md), with no Blender, sockets, or child processes |
| `tests/test-blender` / `@blendia/test-blender` | `pnpm test:blender`              | Six sequential actual-engine behavior groups after native ZIP installation verification                                                |

Both modules run `src/index.ts` through public `ttsx` after the [pre-native environment step](native-startup.md#supported-launch-paths). `pnpm test:types` checks both existing test tsconfigs through ordinary `ttsc --noEmit`; `test:units:types` and `test:blender:types` select one. `pnpm lint`, `pnpm run format:check`, and `pnpm run evidence` have their separate development roles. No product build, compiled fallback, or extra checking tsconfig is a prerequisite. See [conventions](../conventions.md#compiler-exports-and-commands) for the complete workspace command contract.

## First-party units

The [unit inventory](../../tests/test-units/UNIT_TESTS.md) owns the current named-case list and each case's first-party observations; consult it rather than a duplicated count or historical increment list. The cases exercise CLI argument ownership, SDK framing/admission/response validation, runtime state and logs, native-image delivery policy and MCP scene representation. Native-environment policy observes coherent temporary paths, caller copies and owned filesystem checks; the separate connection-environment case observes credential aliases and overrides, fresh headless credential removal, copied inputs and canary redaction through real log/state owners. Neither case launches a child or compiler, changes global process state, or certifies unsafe host redirection. MCP cases do not establish generated schemas, upstream typia, protocol integration or host image consumption. Authored scope and revision-specific execution results remain separate.

SDK sparse-array/finite-value admission and runtime headless sparse string-array admission are separate production boundaries in the same indexed-validation family. Their regressions require malformed inputs to fail before transmission or prerequisite filesystem access. Array length and checks that skip missing indices are insufficient. These cases preserve real numeric/string admission and detached ownership rather than inventing test-only APIs or artificial child processes.

## Running actual Blender

Supply an actual Blender executable and the extension packaging source root, prepare its ignored license copy, and run the engine suite. The commands below are a PowerShell setup template with explicit paths, not a claimed completed run:

```powershell
$env:BLENDIA_BLENDER_EXECUTABLE = 'C:/path/to/blender.exe'
$env:BLENDIA_EXTENSION_SOURCE_DIRECTORY = 'D:/path/to/blendia/blender/extension'
$env:BLENDIA_TEST_OUTPUT_DIRECTORY = 'D:/existing/output-parent'
pnpm extension:license
pnpm test:blender
```

The first two environment variables are required. The output parent is optional but must already exist when supplied; otherwise the runner uses the operating system's temporary directory. It reserves and prints a unique child directory. Missing or incompatible prerequisites fail instead of silently skipping. The package's [TESTING guide](../../tests/test-blender/TESTING.md) owns the detailed preparation and retained-file instructions.

Before scenarios, the suite invokes Blender's official extension build/install commands, installs the actual ZIP into an isolated offline USER repository, verifies native `bl_ext` registration and disable/enable behavior, compares installed payload members with the ZIP, and checks the license against the repository root. Only that verified installed root supplies the scenario bootstrap. Installation failure stops the suite; there is no source-import fallback. Native extension packaging is separate from compiling TypeScript distribution output.

| Behavior group          | Actual observations                                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scene roundtrip         | CPU Cycles PNG, SDK chunk/export agreement, native decoded pixel variation, saved `.blend` reopening, and independent geometry/material/camera/light/settings readback |
| Session ownership       | Writer-lease refusal/reacquisition and object identity across real reconnect and fresh owned sessions                                                                  |
| Shared material refusal | Rejection of assignment to a genuinely shared mesh, with independent native state inspection                                                                           |
| Render admission        | No-camera refusal and duplicate caller-ID admission against the real engine                                                                                            |
| Artifact capacity       | Four-artifact capacity and explicit release using small native CPU renders                                                                                             |
| Output publication      | PNG/native-copy conflicts, explicit overwrite, persistent user outputs, and preserved preexisting backups                                                              |

The main scene uses 128-by-128 pixels and eight CPU samples; resource-admission renders use 32-by-32 pixels. An independent native load inspects real geometry, shading inputs, camera aim, lights, saved settings, and decoded image data. SDK self-reports alone are insufficient, and PNG hashes are not required to match across machines, versions, or repeated renders. This is engine automation, not graphical click automation.

## Observation and output ownership

Native packaging, installation, seed preparation, and independent readback each have a ten-minute observation budget. Journals retain sanitized stage, observed PID, UTC time, outcome, code, and signal. This budget does not impose a total deadline on user TypeScript or native toolchain preparation. Expired, signaled, abnormal, or unknown native observation stops new native/recipe admissions; a public headless `unknown` closes the same barrier. Subsequent groups are reported as blocked, while ordinary assertion failures with known lifetimes allow independent groups to continue.

Unknown observation preserves private state and user outputs and unrefs only the runner's direct child handle. It does not kill Blender, prove descendant termination, retry, or replay mutations. Resolve uncertain surviving work before starting another native run or cleaning retained paths. The suite does not intentionally induce unknown outcomes to manufacture timeout coverage.

Retained output includes explicit PNG/`.blend` files, the built extension ZIP, installation observations, sanitized native journals/readbacks, and public runtime results. Upload the explicit allowlist only, never the whole run directory: `private-runtime` can retain live credentials after an unknown outcome. Configuration, descriptors, preferences, caches, and private bootstrap bodies are excluded. The CI staging step caps each selected file at 64 MiB and total selected payload at 256 MiB; its manifest records exclusions, and uploaded artifacts expire after seven days.

## CI and coverage limits

[test.yml](../../.github/workflows/test.yml) runs unit lint/types/execution on Ubuntu and Windows plus applicable Evidence. [blender.yml](../../.github/workflows/blender.yml) separates engine source checks from the Ubuntu 24.04 CPU job. The engine job downloads the official Blender 5.2.0 Linux x64 archive and checks SHA-256 `96f6c181a30f4950607839dc84d42a354b250d8a0231b098b59b7bc69c351c48` even on a cache hit, then prepares the extension license and runs the installed-engine suite. Workflow configuration does not establish a successful Ubuntu run.

Unclaimed boundaries include GUI clicks, native cancellation, real ten-minute artifact expiry, aggregate 128-MiB image capacity, ambiguous native callbacks, filesystem publication races, external-image autosave refusal, current-session rename/delete/undo/load, direct working-filepath before/after inspection, parent loss, and unknown/timeout retention behavior. The suite adds no private protocol fallback or product hook to fabricate those observations. MCP E2E, standalone typia revalidation, fake/static/upstream tests, renaming, publication, and release remain outside this validation slice. Real-host MCP image observations remain separate in [MCP #5](https://github.com/samchon/blendia/issues/5#issuecomment-6612053287).
