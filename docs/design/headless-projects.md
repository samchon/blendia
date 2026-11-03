# Run a project in an owned headless Blender

Tracking: [execution #3](https://github.com/samchon/blendia/issues/3), [validation #6](https://github.com/samchon/blendia/issues/6), and [PR #15](https://github.com/samchon/blendia/pull/15). The one-shot headless API starts one new Blender process for one saved project script, then observes its cooperative shutdown. It does not adopt an existing GUI session or provide a persistent editing daemon. This source-based guide describes the contract; actual execution and artifact evidence belong in the tracker.

## Scope and API

Use `runHeadlessProject` from `@blendia/runtime`, or the foreground `headless` CLI command. [IHeadlessProjectOptions](../../packages/runtime/src/IHeadlessProjectOptions.ts) reuses `entry`, optional `cwd`, `project`, and `args`, while excluding a caller-supplied `connection`. The owned private bridge supplies the script's SDK connection; it does not borrow the caller's GUI port/token. The script still runs through the normal public `ttsx` launcher with its own project's compiler, imports, and plugins. Local source execution requires no package build.

Both `blenderExecutable` and `extensionDirectory` are required explicit paths, resolved against the selected cwd; no executable discovery is performed. The extension directory must be the actual extracted root containing `headless_bootstrap.py` and its colocated Python core. For a source checkout, supply that checkout's `blender/extension` explicitly. For a ZIP installation, supply the actual installed root from a version containing the bootstrap. There is no repository-relative runtime default, automatic extension search, or fallback to an unrelated checkout. An older extension ZIP without the entry is insufficient.

| Option | Meaning |
| --- | --- |
| `blenderExecutable` | Explicit Blender executable; no PATH or GUI-process search. |
| `extensionDirectory` | Explicit source/installed extension root with the bootstrap and shared core. |
| `entry`, `cwd`, `project`, `args` | Saved project script and its normal TypeScript resolution/argument context. |
| `blendFile` | Optional input `.blend`, loaded before bootstrap; omission uses factory startup data. |
| `startupTimeoutMs` | Readiness plus private-control attachment observation, default 120000 ms. |
| `shutdownTimeoutMs` | Cooperative Blender-close observation after known script completion, default 10000 ms. |

Both timeout options are safe integers from 100 through 3600000 ms. They do not impose a deadline on the whole TypeScript script or its typia/native-plugin preparation. A slow source-plugin build after Blender is ready does not consume the already-finished startup observation. The SDK's connection/request timeout is a separate limit described below; none of these observations is a cancellation guarantee or startup performance promise.

## Command and script setup

```sh
pnpm blendia headless --blender /absolute/path/to/blender --extension-directory /absolute/path/to/extension --cwd /absolute/path/to/project --project tsconfig.json src/scene.ts
```

Optional launcher flags are `--blend-file`, `--startup-timeout-ms`, and `--shutdown-timeout-ms`. Launcher flags precede the entry and may appear only once. After the entry, arguments belong to the script; one immediately following `--` is removed as the usual separator. Quote paths containing spaces. These are explicit path placeholders, not an installed-binary or repository-location default. See the [CLI guide](../../packages/cli/README.md) for its actual terminal adapter.

After the outer TypeScript launcher has bootstrapped, `headless` writes one result JSON to stdout; it has no headless `--jsonl` flag or live-event stream. Exit zero requires composite `completed`, both script and Blender known exited with code zero/no signal, and private cleanup `removed`. Other observed results exit one. Invalid options or unavailable explicit prerequisites are rejected before admission with a nonzero CLI error rather than a completed result; admitted lifecycle failures use the structured observation.

The project provides its native TypeScript compiler, SDK, imports, and tsconfig plugins; [first-run preparation](script-jobs.md#first-run-preparation) explains cold native cache/network limits. The script connects through `BlenderClient.connect()` using the invocation's provided environment, performs its SDK operations, explicitly saves wanted outputs, and disconnects in its normal cleanup. There is no automatic scene save during shutdown.

## One lifetime owner

The runtime reserves private invocation storage and starts one new Blender child without a shell, using the shared process/log owner. The input file, bootstrap, and private configuration are explicit resolved paths. A new background session has new object/material identities; GUI handles are not portable into it.

Blender is launched with ordered public flags `--background --factory-startup --disable-autoexec`, optional input `.blend`, then the bootstrap via `--python`. Loading occurs before bootstrap so it cannot replace an already-running bridge's settings. The factory flag skips the user's startup scene; it does not establish isolation from every preference, driver, addon, or external render dependency. Credentials are private configuration/environment data, not command arguments or public result fields. [Blender's argument order](https://docs.blender.org/manual/en/5.2/advanced/command_line/arguments.html) matters to this contract.

The bootstrap imports its colocated core without registering Blender's GUI panels and keeps a synchronous main-thread request pump alive. It publishes authenticated private readiness after binding. Runtime authenticates that invocation and its separate control channel without taking the script's exclusive SDK lease, then runs the project as a captured ScriptJob. Main-thread scene validation, mutations, rendering, and saving reuse the existing SDK/extension contracts.

After a known script terminal result, the owner requests cooperative bootstrap completion and observes Blender closure and pipe EOF. Private control can observe parent loss only between commands. Startup timeout means readiness was not observed, not proof that the child cannot still be starting. Lost control or incomplete shutdown does not authorize replay, forced termination, or cleanup of paths that may remain in use.

## Read the result and logs

[IHeadlessProjectResult](../../packages/runtime/src/IHeadlessProjectResult.ts) keeps composite observation, script execution, and Blender status separate:

| Field | Meaning |
| --- | --- |
| `outcome` | `completed`, `launch-failed`, or `unknown`; completed observation is not proof of a successful script or scene. |
| `script` | Optional existing terminal script snapshot, absent if no script launched. Inspect its outcome and result code/signal. |
| `blender`, `blenderOutcome` | Optional raw direct Blender code/signal and separate `not-started`, `exited`, `launch-failed`, or `unknown` observation. |
| `blenderPid` | PID observed at spawn for ownership reporting, not a process-tree guarantee. |
| `scriptLogs`, `blenderLogs` | Separate arrays of bounded retained log pages with their original cursor/gap metadata. |
| `cleanup` | Private bootstrap storage was `not-created`, `removed`, or `retained`; explicit user files are separate. |
| `retainedDirectory` | Present for retained private storage, which can contain credentials and is not a public log attachment. |
| `diagnostic` | Fixed sanitized finding; useful child/native diagnostics stay in their bounded journals. |

An ordinary nonzero script exit can still have composite `completed` observation. Inspect the script and Blender statuses independently; neither process's code substitutes for the other's, and code zero does not verify expected PNG/scene contents. The returned value is an observation, not a live job handle; unknown processes can still remain. Public retained log pages are bounded/redacted observations; missing earlier entries remain visible through cursor/gap metadata. Private configuration/readiness files are a different credential-bearing owner, not extra public diagnostics to dump or share as logs.

## Main thread and finite conditions

Background command-line teardown follows the bootstrap's return, so this bootstrap stays executing until its stop condition instead of registering a timer and immediately returning. This is not a persistent background server after the one-shot owner completes. [Blender's creator entry point](https://github.com/blender/blender/blob/blender-v5.2-release/source/creator/creator.cc) distinguishes background exit from the GUI event loop.

All bpy work occurs on that main thread. Unlike the GUI bridge's asynchronous start/poll path, headless `startRender` uses blocking native `EXEC_DEFAULT` and returns the existing terminal render job after native completion/finalization. While it is blocked, Blender cannot process additional RPC/control traffic or react to parent EOF/finish. Client-side SDK timers can still expire independently; that does not interrupt native work. There is no finite render-response wall-clock promise. [Blender's threading guidance](https://docs.blender.org/api/main/info_gotchas_threading.html) is not bypassed by moving bpy into a worker.

The SDK's default connection/request timeout is 30 seconds. If a legitimate render can take longer, the script can explicitly choose a larger `timeoutMs` when connecting through the existing SDK API. A sent request timing out produces `OUTCOME_UNKNOWN`/connection closure, not native cancellation or permission to resend the render. The 120000 ms startup observation is not this SDK timeout and does not bound total script execution.

## Scene and output lifetime

The same script can use the existing [scene/render/save SDK](scene-render-save.md) in the new session. Background scene dispatch bypasses only the GUI undo/context adapter, preserving finite-value/topology/shared-mesh/linked-data validation, session/generation identities, fresh resolution, and possible-effect reporting. It does not introduce arbitrary Python execution or full bpy parity.

Rendering retains the current camera, frame, and engine; requested resolution/PNG settings persist in the scene, and only the owned temporary output filepath is conditionally restored. Single-view/dimension/provenance restrictions, bounded artifact ownership, and atomic no-overwrite publication remain the [scene output contract](scene-render-save.md). Blocking completion does not add a GUI modal window or cancellation control. [The native render operator](https://docs.blender.org/api/5.2/bpy.ops.render.html) remains Blender's renderer.

To retain a PNG or `.blend`, the script must explicitly call `saveArtifact` and `saveBlendCopy` at user-selected destinations before its session ends. Existing parent-directory, extension, overwrite, working-filepath, and relative-asset rules still apply. Process completion does not save anything implicitly. Explicit published user files survive process teardown and are never bootstrap cleanup targets. [Native Save Copy](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.save_as_mainfile) does not switch the working document to the saved copy.

Bridge artifact IDs and private PNGs expire with the owned Blender/session and cannot be used later as durable GUI or MCP resources. A future MCP wrapper must expose an actually retained copy or explicit user output with a real owner/lifetime, rather than an expired bridge artifact. This one-shot API adds no persistent artifact service.

## Unknown outcomes and Windows

A blocking render can prevent the main-thread pump from reacting to control loss until rendering returns. Timeouts, transport loss, signals, Windows high-bit unsigned statuses, missing EOF, or a lost completion message can leave the outcome unknown; do not infer cancellation or rollback, replay a mutation, or remove uncertain owned staging. Retain private bootstrap/input/staging metadata when it may still be in use, report artifact existence separately from completion, and preserve existing bounded-log gaps. Successful native writes may remain after an unknown caller outcome.

On Windows, Node's ordinary kill signals are forceful, not an orderly Blender shutdown mechanism. The first slice requests cooperative completion only of its own child. Never enumerate/kill existing user Blender processes; never claim that killing the owned direct child terminates unknown renderer descendants. No taskkill tree sweep, OS JobObject guarantee, automatic cancellation, or process-group ownership promise is introduced. If an owned Blender fails to close, report unknown and the retained ownership information; termination escalation requires a separate explicit product decision. [Node child-process termination](https://nodejs.org/api/child_process.html#subprocesskillsignal).

## Scope and actual verification

Runtime/CLI owns the one-shot lifecycle and private storage; the extension owns main-thread bootstrap/control and the background render adapter. SDK methods remain those of the scene/render/save slice. This is foreground one-shot execution, not a daemon, background-start/inspect API, durable job lookup, automatic cancellation, or process-group ownership guarantee.

Use the same secret-free TypeScript scene consumer for GUI, headless and later MCP acceptance, explicitly producing a PNG and .blend. Observe owned PID creation, private ready identity, actual SDK operations, render/save results, script terminal status, cooperative Blender exit, EOF and retained/cleaned paths. Preserve actual TS/PNG/.blend outputs. Meaningful units may cover any real new option or lifecycle decision logic; no fixture child, compiler/import probe, benchmark or automated integration suite is introduced. Windows cooperative shutdown and the background pump remain actual-host acceptance criteria, not facts established by this memo.
