# Shared script jobs and diagnostics

Tracking: [execution #3](https://github.com/samchon/blendia/issues/3), [validation #6](https://github.com/samchon/blendia/issues/6), and [parent #1](https://github.com/samchon/blendia/issues/1). [PR #13](https://github.com/samchon/blendia/pull/13) added shared script jobs and diagnostics after the file/Text macro slice. The source contract below gives consumers one bounded execution/result owner without a daemon or another TypeScript runtime. Actual acceptance results belong in the issues and PR; API documentation is not an execution-success claim.

## Scope

`packages/runtime` owns one common internal launch/lifecycle implementation, with actual inherit and capture stdio policies. Existing runProjectScript/runTextMacro preserve inherited stdin/stdout/stderr, TTY and input behavior; they are not converted into captured jobs with forwarding. The process-local ScriptJob uses capture policy, bounded log cursor state and the same Text staging/result ownership. Metadata/argv/cwd/environment/spawn/error/close/staging must not be implemented twice. CLI is a foreground terminal/machine adapter, Blender observes that public CLI, and the [MCP server](mcp-agent-tools.md#captured-project-scripts) directly consumes the captured runtime API. Each object shape remains a named interface in its own file.

Captured-job child stdin is ignored and stdout/stderr are piped and continuously drained; the captured core never automatically forwards to parent streams. Incremental UTF-8 decoding, stream tags, byte-bounded retained logs/pages, cursor gap/truncation signals, secret redaction across chunks and terminal/unknown outcomes are owned by first-party logic. Default CLI run preserves legacy inheritance; UI machine/job mode renders captured events, and MCP uses capture only so protocol stdout and input stay isolated. A direct launcher result does not prove every descendant stopped or that Blender mutations rolled back. Live records are never silently evicted; terminal state/retention and close ownership are explicit.

Provide discovery only in an explicit descriptor directory, returning bounded sanitized metadata without tokens. File presence is not a live-session proof. Doctor distinguishes actual Node/public ttsx/project/dependency metadata from unchecked execution; it does not test Go/network/native-plugin preparation or promise first-use readiness. Do not compile a dummy project, run an import probe or change global environments.

No global daemon, durable job lookup between CLI invocations, background-start/inspect promise, cancellation, transaction rollback or mutation replay is included. The jobs API provides no cancel operation: killing a direct launcher cannot establish descendant termination. Python keeps ownership of its private input, while runtime owns the Text sibling. Preserve current file/Text grammar, source-only local execution and public ttsx metadata resolution.

## First-run preparation

The script's project must provide its native TypeScript compiler, SDK, imported packages and configured plugins. The source-checkout setup below supplies those dependencies without publishing packages or building `lib`. Keep optional dependencies enabled so the native compiler can be installed. Local Blendia commands prepare their native temporary environment before the unchanged public toolchain starts; see the [startup guide](native-startup.md#supported-launch-paths). The [CLI guide](../../packages/cli/README.md) and [extension setup](../../blender/extension/README.md#run-typescript-from-blender) identify execution tools and project settings.

### Set up an external source-checkout project

Use the same PowerShell session for these blocks, replacing the two paths. Choose a new project directory outside the checkout, beneath an existing parent; the example intentionally refuses an existing directory. For an existing project, preserve its files and configuration instead of running the initialization steps over them. Prepare the checkout's committed dependencies first, then read its installed compiler and Node type versions rather than guessing compatible versions:

```powershell
$blendiaCheckout = (Resolve-Path -LiteralPath 'D:/path/to/blendia').Path
Set-Location -LiteralPath $blendiaCheckout
pnpm install --frozen-lockfile

$typescriptVersion = (Get-Content -LiteralPath (Join-Path $blendiaCheckout 'node_modules/typescript/package.json') -Raw | ConvertFrom-Json).version
$nodeTypesVersion = (Get-Content -LiteralPath (Join-Path $blendiaCheckout 'node_modules/@types/node/package.json') -Raw | ConvertFrom-Json).version
$projectDirectory = 'D:/projects/프로젝트 space'
New-Item -ItemType Directory -Path $projectDirectory -ErrorAction Stop | Out-Null
Set-Location -LiteralPath $projectDirectory
pnpm init
pnpm add --save-dev "typescript@$typescriptVersion" "@types/node@$nodeTypesVersion"
pnpm link (Join-Path $blendiaCheckout 'packages/sdk')
New-Item -ItemType Directory -Path (Join-Path $projectDirectory 'src') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $projectDirectory 'outputs') | Out-Null
```

The direct-directory [pnpm link](https://pnpm.io/10.x/cli/link) uses the SDK's existing source package without a global link or hand-created junction. The checkout's [pinned pnpm implementation](https://github.com/pnpm/pnpm/blob/v10.6.4/pkg-manager/plugin-commands-installation/src/link.ts#L143-L176) records a `link:` dependency and matching override in the consumer's `package.json` and updates that project's lockfile. The SDK keeps its checkout-owned dependencies, which is why the checkout install comes first. Keep the checkout in place, or rerun the link command with its new location after moving it. Nothing here rewrites the SDK's source exports or installs it from npm.

Create `tsconfig.json` in the new project with the following content. This is the application's configuration, not another repository checking project. It preserves normal Node imports and leaves `rootDir` unset so the linked SDK's TypeScript sources are not artificially confined to the application's source directory:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

Save your script as `src/scene.ts`; the [SDK scene example](../../packages/sdk/README.md) is a complete starting point that takes PNG and `.blend` destination arguments. Install any additional packages your chosen script imports and retain any plugins its configuration declares. For example, a script importing `typia` needs that package and its compiler peer in the external project; the following optional step selects both versions from the prepared checkout without changing Blendia's selected launcher. The SDK scene example itself does not require this step:

```powershell
$typiaVersion = (Get-Content -LiteralPath (Join-Path $blendiaCheckout 'packages/mcp/node_modules/typia/package.json') -Raw | ConvertFrom-Json).version
$ttscVersion = (Get-Content -LiteralPath (Join-Path $blendiaCheckout 'node_modules/ttsc/package.json') -Raw | ConvertFrom-Json).version
pnpm add --save-dev "typia@$typiaVersion" "ttsc@$ttscVersion"
```

Start the extension in Blender and privately set the connection environment using the [extension instructions](../../blender/extension/README.md#install-and-start), with no other SDK client holding the writer lease. Return to the checkout to invoke its public source CLI; the script still uses the external project's cwd, configuration and dependencies:

```powershell
Set-Location -LiteralPath $blendiaCheckout
pnpm blendia doctor --cwd "$projectDirectory" --project tsconfig.json
$pngPath = Join-Path $projectDirectory 'outputs/scene.png'
$blendPath = Join-Path $projectDirectory 'outputs/scene.blend'
pnpm blendia run --cwd "$projectDirectory" --project tsconfig.json src/scene.ts -- "$pngPath" "$blendPath"
```

Doctor should locate the selected checkout's SDK metadata and the external project's compiler/configuration while retaining `execution: "not-tested"`; it does not prove imports, native preparation or Blender execution. The subsequent script must actually connect, run its SDK operations and report its own result. The scene example explicitly saves its outputs and disconnects; existing destinations are refused by default. For a separate owned Blender process, use the same prepared project with the [headless workflow](headless-projects.md) instead of GUI credentials. Neither route requires a TypeScript package build.

The first native transformer run can prepare source plugins and a cold Go cache before user TypeScript begins. Preparation can require network access for dependencies not already available and can take several minutes; installing a platform compiler package does not establish that a project's native plugins are prepared. Later invocations can still be expensive. Read bootstrap output and the final observed outcome rather than treating a quiet interval as completion or launching another copy. The metadata doctor does not execute or verify this preparation, and the source CLI itself must bootstrap before reporting metadata.

PR10's first native emit was manually interrupted after Suspended thread snapshots, with an unknown lifetime; a separate later emit returned zero after 413.840 seconds and that CLI completed naturally. The 801.166-second Go plugin build had itself succeeded. These distinct invocations do not identify a suspending actor, permanent deadlock, or launcher/security cause. The [native startup evidence guide](native-startup.md) separates the recovered original same-TEMP failure/retry, later default-environment guard failures, and PR18's accepted cwd-independent path correction. Source `03ca8b8` passed nineteen-unit CI on both operating systems and six Ubuntu engine groups, with reviewed reuse of unchanged Windows GUI/host/engine paths. Fresh merged-master `3a0201f` config and actual headless scene/render/save runs completed naturally in 7.799 and 32.668 seconds; official Playwright MCP inspected that same new PNG. These are revision-specific observations, not a startup duration or cache speedup promise, and do not reconstruct the historical missing cause. Preserve final diagnostics and the [dated evidence](https://github.com/samchon/blendia/issues/3#issuecomment-6601366606).

## Frozen API and ownership

The process-local [startScriptJob](../../packages/runtime/src/startScriptJob.ts) accepts [IScriptJobRequest](../../packages/runtime/src/IScriptJobRequest.ts) and returns a [ScriptJob](../../packages/runtime/src/ScriptJob.ts). Named file and Text variants use `kind: "file"` with `IProjectScriptOptions`, or `kind: "text"` with `ITextMacroOptions`, in an `options` field snapshotted before deferred effects. Phases are `starting`, `running`, `draining`, and `terminal`; `running` means the direct launcher spawned, not that user TypeScript began. Outcomes distinguish `exited`, `launch-failed`, and `unknown`. Admission is capped at 16 retained records, including terminal records until explicit close. No active eviction, TTL, cancellation, or cross-CLI lookup is promised; this memory bound does not bypass Blender's exclusive writer/BUSY contract.

| API                                          | Contract                                                                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `getScriptJob(id)`                           | Return this owner's retained record, or `undefined` for an unknown/released ID. Another CLI process cannot retrieve it.          |
| `job.inspect()`                              | Return `IScriptJobSnapshot` with IDs, phase/outcome, optional result/diagnostic, `metadataTruncated`, and earliest/tail cursors. |
| `job.readLog(cursor = 0, byteLimit = 16384)` | Return `IScriptLogPage` for this job's entry sequence.                                                                           |
| `await job.wait()`                           | Resolve to a terminal snapshot after bounded output/cleanup observation, without certifying descendant shutdown.                 |
| `job.close()`                                | Release terminal state/log memory; active close is refused and kills no process.                                                 |

Captured logs retain at most 64 KiB and 1024 entries; a page returns at most 16 KiB and 128 entries. Entries contain `cursor`, `stream` (`stdout` or `stderr`), and up to 2048 UTF-8 bytes of `text`. A cursor is a safe integer at least zero; a cursor beyond the tail is refused. `byteLimit` is a safe integer from 4096 through 16384. Pages contain `entries`, `earliestCursor`, `nextCursor`, `gap`, and `hasMore`. `nextCursor` names the first unreturned entry, not a byte offset; gap/hasMore distinguish retention loss from available data. UTF-8 boundaries and known-token redaction are preserved across chunks. Actual child TypeScript diagnostics and stacks remain in bounded logs after redaction; credential-bearing discovery/probe errors and internal diagnostics use fixed sanitized findings. Public state never serializes original options/environment or raw descriptor JSON. Display metadata is capped at 4096 UTF-8 bytes without an added suffix; the `metadataTruncated` flag reports shortening. A shortened displayed staging path is not an exact cleanup path. Internal ownership uses the full path, and inherited API results are unchanged.

discoverBlenderSessions takes IBlenderDiscoveryOptions and returns IBlenderDiscoveryResult with sessions typed as IBlenderDiscoveredSession[], fixed sanitized string issues, truncated and probeTruncated. It requires an explicit directory, scans nonrecursively with at most256 entries,32 descriptors and16 KiB per regular session-*.json file, and excludes symlink/nonregular credential inputs. Default discovery opens no socket. Explicit probes perform at most8 sequential bounded SDK hello/identity checks with finally disconnect; report BUSY without retry/stealing/killing and disclose the brief idle lease. truncated describes directory/descriptor limits; probeTruncated describes the requested probe budget only. A valid descriptor alone is not a live proof.

doctorProject takes optional IProjectDoctorOptions and returns IProjectDoctorReport. It reports the current Node execution/version, public runtime-owned ttsc metadata/bin.ttsx readability/version, cwd and an explicit or nearest tsconfig candidate, plus actual SDK/typescript dependency metadata. execution is not-tested; it does not claim the compiler actually selected that candidate or that native/Go/network/plugin execution works. Invalid options/cwd are refused; missing metadata/dependencies/config produce fixed diagnostic strings. The five discovery/doctor DTOs each live in their own same-named interface file; sessions is the actual field name, and issues are fixed strings rather than anonymous nested object shapes.

The runtime launch/job modules own lifecycle, captured logs and Text staging; separate discovery/doctor modules own metadata inspection and optional session probes. CLI owns grammar/rendering, Python owns its outer CLI observation and private input, and the test workspace owns meaningful first-party units. No separate SDK/protocol/daemon package is introduced.

## CLI machine output

Use `--jsonl` once before the file entry for `run`, or before the first `--` delimiter for `run-text`. Arguments after those boundaries belong to the script. Duplicate launcher flags are refused. Default commands keep inherited streams; JSONL mode captures the child and ignores stdin. Both remain foreground execution without a detached start/inspect command.

```sh
pnpm blendia run --jsonl --cwd /path/to/project --project tsconfig.json src/model.ts
pnpm blendia run-text --jsonl --cwd /path/to/project --source-path src/model.ts --input-file /path/to/snapshot.txt --project tsconfig.json
pnpm blendia sessions --directory /path/to/session-descriptors
pnpm blendia sessions --directory /path/to/session-descriptors --probe --probe-timeout-ms 1000
pnpm blendia doctor --cwd /path/to/project --project tsconfig.json
```

The named [IScriptMachineEvent](../../packages/cli/src/IScriptMachineEvent.ts) union contains these envelopes, each at most 65536 UTF-8 bytes including its terminating LF:

| `type`     | Fields and meaning                                                                          |
| ---------- | ------------------------------------------------------------------------------------------- |
| `snapshot` | `snapshot` carries observed phase and its `id`/`ownerId`.                                   |
| `log`      | `id`, `ownerId`, and `entry` carry one cursor/stream/text entry.                            |
| `gap`      | `id`, `ownerId`, `earliestCursor`, and `nextCursor` explicitly advance past lost retention. |
| `terminal` | `snapshot` commits terminal observation after the emitted cursor reaches the terminal tail. |

The renderer awaits each stdout write while the core continues draining into its bounded ring. Consumers correlate both IDs and follow cursors, including gaps. Outer bootstrap diagnostics may precede machine events; before the first snapshot, Blender shows CLI bootstrapping rather than claiming the user's script started. An outer CLI exit alone does not replace an intact correlated terminal envelope.

Python renders stream tags and job phase/outcome separately from outer CLI exit. Metadata shortening is reported separately from display/log truncation. Explicit retention gaps can omit older logs without invalidating an otherwise accounted terminal tail; a missing or damaged event sequence cannot. Python removes its private Text input only after a valid `exited` or `launch-failed` terminal with its tail accounted for, outer close, and EOF without protocol/observer failure. Missing, damaged, or `unknown` terminal observation retains input and blocks relaunch. No cancel/rollback action is added; resolve surviving execution before restarting Blender or cleaning retained files. Runtime still owns only its Text sibling.

## Discovery and doctor fields

[IBlenderDiscoveryOptions](../../packages/runtime/src/IBlenderDiscoveryOptions.ts) contains required `directory`, optional `probe`, and optional `probeTimeoutMs`. No default/global directory search occurs. `--probe-timeout-ms` requires `--probe` and accepts 100 through 5000 ms, defaulting to 1000 ms per connection/response step rather than a total scan deadline. [IBlenderDiscoveryResult](../../packages/runtime/src/IBlenderDiscoveryResult.ts) contains absolute `directory`, `sessions`, fixed string `issues`, `truncated`, and `probeTruncated`. Each [IBlenderDiscoveredSession](../../packages/runtime/src/IBlenderDiscoveredSession.ts) exposes `descriptorPath`, `protocolVersion`, loopback `host`, `port`, `sessionId`, `probeStatus`, and nullable `blenderVersion`, `generation`, and `probeCode`. Probe status is `not-requested`, `live`, `busy`, `unreachable`, `rejected`, or `identity-mismatch`; foreign exception text and tokens are absent.

[IProjectDoctorOptions](../../packages/runtime/src/IProjectDoctorOptions.ts) contains optional `cwd` and `project`. [IProjectDoctorReport](../../packages/runtime/src/IProjectDoctorReport.ts) reports current `nodeExecutable`/`nodeVersion`; `cwd`, `requestedProjectPath`, `tsconfigPath`/`tsconfigStatus`; runtime-owned `ttscPackagePath`, `ttscVersion`, `ttsxPath`/`ttsxReadable`; project-resolved `sdkPackagePath`, `typescriptPackagePath`/`typescriptVersion`; and fixed `issues` with `execution: "not-tested"`. Config status distinguishes `explicit-readable`, `explicit-missing`, `explicit-unreadable`, `candidate-readable`, `candidate-unreadable`, and `not-located`. Readability does not validate config semantics, extends chains, compiler selection, plugins, Go cache, native execution, or network access.

## Acceptance

- File and Text paths share the actual launch/lifecycle implementation and preserve original source, process result, staging disposition and existing inherited three-stream behavior. No captured-forward substitute or duplicate spawn/staging implementation changes that contract.
- Captured arbitrary child output and stdin cannot corrupt or consume the MCP stdio stream; captured logs have no automatic parent output, and only their CLI adapters render terminal/machine events.
- Meaningful first-party units cover actual UTF-8 chunk/cursor/gap/budget/state/redaction logic; no child fixture, static-config, upstream or artificial-helper suite is added.
- Explicit-directory discovery separates scan truncation from optional-probe incompletion, stays bounded/token-free and does not present files as live. Doctor clearly separates actual metadata from untested compiler/Go/network/native-plugin execution.
- One required actual product observation verifies source CLI/Blender adapter logs, terminal versus bootstrap outcome, EOF/staging/input cleanup and the documented unknown/cancellation limits.
- Applicable Evidence, independent complete-diff review, exact-head COMMENT self-review and all configured CI pass before immediate merge.

The prior 830 s / 395 s intervals and initial silent config failure remain separate observations. Their [existing evidence decomposition](https://github.com/samchon/blendia/issues/3#issuecomment-6601366606) identifies what is proven and what is not. Instrument the already-required next real product run to identify preparation regions; neither these APIs nor a job ID claims a startup improvement.

## Accepted documentation follow-up from PR10

The [current unit guide](../../tests/test-units/UNIT_TESTS.md) distinguishes ordinary compiler checking from explicit development lint, resolving the earlier PR10 wording follow-up without rewriting its historical verification. The [first-run section](#first-run-preparation) and [observed-environment guide](../support.md#first-use-preparation) explain native Go/cache/network preparation and the metadata doctor's limits. The original config exit-1 cause, manually interrupted first emit, and separate naturally completed emit retain their individual evidence limits; they do not establish a solved cause or controlled benchmark.

## Delivery and final product observation

Collect affected local first-party logic units and necessary source-only noEmit/format/Evidence observations with actual Blender evidence and the exact-head remote CI in one round. When that same head's full lint/native guard/distribution build already passed and its raw logs are preserved, reuse the evidence instead of repeating a local aggregate build/guard. A new failure or changed code must still receive the complete affected cause-batch verification; reuse is not permission to skip a material unverified boundary.

The final integrated product observation uses one reproducible secret-free TypeScript script for mesh/material/camera/light creation, native PNG rendering and .blend saving. Use that same scene through MCP native image delivery and isolated headless execution. Preserve the actual PNG, .blend and TS in verified ignored output or external task-owned artifacts and give the user clickable artifact links. Use an existing suitable documentation/example location; do not add a separate example package, fake test, npm publication or unrelated public deployment. The final latest-extension ZIP installation remains an actual setup criterion, separate from PR10's source registration.
