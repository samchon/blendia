# blendia

Execute an existing project TypeScript script through the shared `@blendia/runtime` launcher. Blender modeling operations are performed by the SDK imported by that script, against a running Blendia extension. This package does not start a second Blender engine or automatically acquire an SDK connection.

The CLI is not yet published to npm. From the checkout root, run its source through the supported command without building first:

```sh
pnpm blendia --help
pnpm blendia run --cwd /path/to/project --project tsconfig.json src/model.ts -- --name Cube
```

This route prepares the native temporary environment before the unchanged public `ttsx` initializes. Healthy caller settings are preserved; an unsafe effective temporary location receives verified process-owned storage automatically. No repeated manual TEMP setup is required. Direct Node integrations can use the shipped public `blendia/native-bootstrap` preload as described in the [startup guide](../../docs/design/native-startup.md#supported-launch-paths).

The script's project must provide its native TypeScript compiler, SDK, imported npm packages, and any plugins named in its tsconfig. Install the compiler there with `npm install --save-dev typescript`, with optional dependencies enabled. The launcher does not install dependencies or rewrite package resolution.

```text
blendia run [--jsonl] [--cwd <dir>] [--project <tsconfig>] <entry> [-- <script args...>]
blendia run-text [--jsonl] --cwd <dir> --source-path <logical.ts> --input-file <utf8> [--project <tsconfig>] [--origin <label>] [-- <script args...>]
blendia sessions --directory <dir> [--probe] [--probe-timeout-ms <100..5000>]
blendia doctor [--cwd <dir>] [--project <tsconfig>]
blendia headless --blender <executable> --extension-directory <dir> [--blend-file <input.blend>] [--cwd <dir>] [--project <tsconfig>] [--startup-timeout-ms <100..3600000>] [--shutdown-timeout-ms <100..3600000>] <entry> [-- <script args...>]
blendia --help
```

`--cwd` and `--project` may each appear once, before the entry. Omitted cwd uses the current directory and omitted project delegates tsconfig discovery to `ttsx`. Missing, blank, repeated, and unknown launcher options fail. Use an explicit relative path such as `./-model.ts` for an entry whose filename starts with a dash. Every argument after the entry belongs to the script, including `--help` and `--project`. One `--` immediately after the entry is removed as the CLI separator; later `--` values remain intact.

`run-text` reads a regular UTF-8 snapshot file of at most 256 KiB. Its project directory, logical source path, and input file are explicit required options; relative paths use the project directory. Each option may appear once, and its first `--` separates script arguments. `--origin` optionally labels the Blender Text in the final report. The CLI reads and closes the input file before execution and never deletes it; its creator owns cleanup.

The logical source must be a non-declaration `.ts`, `.tsx`, `.mts`, or `.cts` module within the project, with an existing writable parent directory. A unique sibling is created without overwriting the original and runs through the same source-based `ttsx` path. Its filename and module identity differ, and errors in the original on-disk source still participate in project checking. Diagnostics name the staged file; the final report names its origin and intended source. Normal launcher completion removes the owned sibling; abnormal termination or cleanup failure retains and reports its path. A retained staging file makes the command return a nonzero status even when the script itself returned zero.

Start the Blender extension and set its connection values in `BLENDIA_PORT` and `BLENDIA_TOKEN` before running a script that calls `BlenderClient.connect()`. Both values are inherited; there are no credential command-line flags. See the [SDK](../sdk/README.md) and [Blender extension](../../blender/extension/README.md) for the connection and scene API.

Project type errors and runtime diagnostics remain on the inherited terminal streams. Ordinary launcher exit codes are returned by the CLI. A reported termination signal or launch failure produces a nonzero status. A successful process exit does not establish that Blender changes were rolled back or that descendants have stopped; there is no Stop or transaction interface in this slice.

The extension's project-file and Text actions use the same source CLI commands. Text execution stages a sibling module; it does not provide an editor overlay or a full TypeScript IDE.

Use `--jsonl` once before the file entry or Text argument delimiter for a machine observer such as the Blender extension. This mode ignores child stdin and captures stdout/stderr; the default commands preserve inherited terminal input/output. JSONL stdout contains only LF-terminated `snapshot`, `log`, `gap`, and `terminal` envelopes. Logs carry `id`, `ownerId`, and an `entry` with `cursor`, `stream`, and `text`; snapshot/terminal carry `snapshot`. Gaps carry both IDs plus `earliestCursor` and `nextCursor`. Each frame, including LF, is at most 65536 UTF-8 bytes, and the renderer waits for stdout writes while bounded capture continues. The final terminal frame follows all observed logs or explicit gaps through its `tailCursor`.

Captured logs preserve UTF-8 and redact the effective known connection token across chunks with a safe separator whose spelling is not fixed. They retain 64 KiB and 1024 entries, so a slow observer can lose older entries and receive a gap. Public metadata fields cap at 4096 UTF-8 bytes and set `metadataTruncated` when shortened, without appending a suffix that could recreate a token; truncated displayed paths must not be used as exact cleanup paths. `running` describes the launcher, and `exited` includes ordinary nonzero user exits. Signals, Windows high-bit unsigned statuses, or uncertain pipe observation are reported as `unknown`, not a successful Blender operation or rollback. Source/bootstrap failures before the first job event remain outer CLI diagnostics; missing or malformed terminal frames must remain unknown to an observer. Jobs are foreground, process-local records, not durable cross-command jobs or cancellable processes.

`sessions --directory` outputs JSON metadata for bounded regular session descriptors without exposing credentials. Discovery opens no socket by default; `--probe` explicitly permits at most eight sequential hello/disconnect probes, briefly leasing an idle session. BUSY is reported without retry or owner takeover. `--probe-timeout-ms` requires `--probe` and accepts 100–5000 ms, defaulting to 1000 ms per connection/response step. `truncated` reports scan limits and `probeTruncated` reports the distinct probe limit; descriptor presence alone is not live-session proof.

`doctor` outputs JSON for the current Node, installed public ttsx, project SDK/compiler metadata, and an explicit or nearest tsconfig candidate. It runs no compiler or native plugin and reports `execution: "not-tested"`. First native/plugin use may prepare Go caches or download missing dependencies and take several minutes; metadata readability does not prove those prerequisites are ready. Local source CLI bootstrapping happens before doctor output. See the [execution guide](../../docs/design/script-jobs.md) for the complete observation limits.

`headless` owns one new background Blender for a saved project script. Provide the actual Blender executable and the actual extension root containing `headless_bootstrap.py` and its matching colocated core, from a source checkout or an extracted extension installation. No repository-relative fallback or extension discovery occurs. Optional `--blend-file` loads an existing .blend before bootstrap. Options belong before the entry, may appear once, and the usual immediate post-entry `--` separator policy preserves script arguments. Existing GUI credentials are not used.

After source CLI bootstrapping, the command emits one JSON result containing separate script and native Blender statuses plus bounded `scriptLogs`/`blenderLogs` pages. Both subprocesses ignore stdin and their output is captured, without live terminal forwarding. `--startup-timeout-ms` defaults to 120000 for Blender readiness/control only; `--shutdown-timeout-ms` defaults to 10000 for cooperative close after known script completion. Both accept 100–3600000 ms. They do not time out user TypeScript or native/plugin preparation.

Exit zero requires composite `completed`, ordinary zero exits and null signals for both the script and Blender, and `cleanup: "removed"`. All other results return one, including known script errors, unknown observation, and retained private storage. Prerequisite admission errors produce a diagnostic and nonzero exit before execution. A timeout or lost observation releases capture readers/process references without killing; Blender, the TypeScript launcher, or unknown descendants may remain active. `retainedDirectory` identifies private credential storage that was preserved, and the original script is never a cleanup target.

The owned Blender's bridge artifact IDs and private PNGs expire at session exit. Save a PNG/.blend explicitly to a user-selected output path from the script to persist it independently. Headless execution does not provide a persistent MCP editing session, cancellation, automatic saving, rollback, or process-tree shutdown. See the [headless guide](../../docs/design/headless-projects.md) for the lifetime contract.
