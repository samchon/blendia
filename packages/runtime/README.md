# @blendia/runtime

Run an existing project TypeScript file through `ttsc`'s `ttsx`. The runtime uses the current Node executable, the actual project directory, and an argument array without a shell. `ttsx` owns project discovery, type checking, transformations, source maps, and its private compilation cache.

The runtime prepares a copied child environment before native initialization, preserving healthy caller temporary settings or automatically selecting verified process-owned storage. Supported outer CLI/MCP commands also prepare their own environment before loading public `ttsx`; an already-failed external compiler initialization cannot be repaired by importing this library later. See the [startup guide](../../docs/design/native-startup.md#supported-launch-paths) for the public preload and intentionally retained scratch. No manual TEMP path is needed for the supported routes.

The `blendia run` command uses this package. It is not yet published to npm. Applications with the package available can also launch scripts directly:

```ts
import { type IProjectScriptResult, runProjectScript } from "@blendia/runtime";

async function main(): Promise<void> {
  const result: IProjectScriptResult = await runProjectScript({
    cwd: "/path/to/project",
    project: "tsconfig.json",
    entry: "src/model.ts",
    args: ["--name", "Cube"],
  });
  console.log(result);
}

void main().catch((error: unknown): void => {
  console.error(error);
});
```

`IProjectScriptOptions` specifies `entry`, optional `cwd`, optional `project`, optional `args`, and optional `connection`. Relative entry and explicit tsconfig paths use `cwd`; omitted cwd uses the calling process's working directory. Omitted project delegates configuration discovery to `ttsx`. Arguments are forwarded verbatim to the script, without consuming a separator in this programmatic API.

Use the [external-project setup](../../docs/design/script-jobs.md#set-up-an-external-source-checkout-project) for the consuming project's compiler, source SDK link and imported packages, retaining any compiler plugins named in its tsconfig. The launcher supplies public `ttsx`; it does not build packages before local execution or invent a replacement project configuration.

`runTextMacro` accepts `ITextMacroOptions`: a `text` snapshot, explicit `cwd`, a logical `sourcePath`, and optional `origin`, `project`, `args`, and `connection`. `ITextMacroContext` represents those same project and origin fields before a snapshot is read. Text is limited to `TEXT_MACRO_MAX_BYTES` (256 KiB of UTF-8). The source must be a non-declaration `.ts`, `.tsx`, `.mts`, or `.cts` path within the project and have an existing writable parent directory. An unsaved source path is allowed; an existing file is never overwritten.

The snapshot runs as a uniquely named sibling module with the same TypeScript suffix. Relative imports keep their directory context, but its filename, module identity, diagnostics, `__filename`, and `import.meta.url` differ from the intended source. The original on-disk source can still fail whole-project checking. The tsconfig must support the staged sibling; this is a module macro, not an unsaved-file overlay or self-import replacement.

`ITextMacroResult` adds `origin`, `sourcePath`, `stagedPath`, `staging`, and optional `cleanupError` to the process result. An ordinary direct-launcher exit attempts removal of the runtime-owned staging file after comparing its full file identity. A signal, uncertain launch, changed path identity, or cleanup failure retains the file and reports the path. Creation failure does not establish file ownership; write or close failure after exclusive creation reports the owned retained path. Abrupt host termination can leave a staging file behind. Macros must not detach descendants that continue to rely on that temporary module; their lifetime is not controlled here.

The script inherits standard input, standard output, and standard error with a copied environment whose temporary storage has passed admission. `connection.port` and `connection.token`, when provided, override `BLENDIA_PORT` and `BLENDIA_TOKEN` for that child only; other values are inherited. The caller's environment object and global settings are not changed. The runtime opens no SDK connection; the script's `BlenderClient` owns its socket. Keep credentials in the environment rather than command arguments.

`runProjectScript` resolves after the direct `ttsx` launcher closes, returning `{ code, signal }`. A spawn failure rejects. A zero code describes the launched program's exit status; it does not independently prove a Blender mutation completed. Source diagnostics remain on the inherited streams. There is no cancellation API, recursive process-tree shutdown guarantee, retry, or rollback. Run the CLI through the intended Node toolchain so `process.execPath` refers to that executable; this package does not install or discover another Node version.

See the [CLI](../cli/README.md) for terminal use and the [SDK](../sdk/README.md) for Blender scene operations.

For captured execution, use `startScriptJob({ kind: "file", options })` or `startScriptJob({ kind: "text", options })`. It returns a process-local `ScriptJob` immediately. Captured stdin is ignored; stdout and stderr are decoded incrementally and kept in a bounded journal without automatically writing parent streams. The existing `runProjectScript` and `runTextMacro` continue to inherit all three streams and preserve terminal input/TTY behavior.

```ts
import {
  type IScriptJobSnapshot,
  type ScriptJob,
  startScriptJob,
} from "@blendia/runtime";

async function main(): Promise<void> {
  const job: ScriptJob = startScriptJob({
    kind: "file",
    options: { cwd: "/path/to/project", entry: "src/model.ts" },
  });
  const terminal: IScriptJobSnapshot = await job.wait();
  console.log(terminal, job.readLog());
  job.close();
}

void main().catch(console.error);
```

`inspect()` reports `id`, `ownerId`, phase, optional outcome/result/diagnostic, `metadataTruncated`, and earliest/tail log cursors. `running` means the launcher spawned, not that user TypeScript began. Terminal outcomes are `exited` (including ordinary nonzero script exits), `launch-failed`, and `unknown`. Signal, a Windows unsigned exit status at least `0x80000000`, lost pipe observation, or pipes still open two seconds after direct exit produce `unknown`; descendants may remain active and Text staging is retained. The raw code is preserved. No outcome certifies Blender success, rollback, or cancellation.

`readLog(cursor = 0, byteLimit = 16384)` returns entries with `cursor`, `stream`, and `text`, plus `earliestCursor`, `nextCursor`, `gap`, and `hasMore`. Cursors count entries starting at zero and apply only to the same job and owner. `nextCursor` is the first unreturned position. Reads reject unsafe, negative, or future cursors and budgets outside 4096–16384 UTF-8 payload bytes. Retention is at most 64 KiB and 1024 entries; entries contain at most 2048 UTF-8 bytes, and a page contains at most 128 entries. A slow consumer gets an explicit gap while capture continues draining. These are bounded defaults, not benchmark results or serialized JSON size limits.

Known effective connection tokens are redacted across output chunks using a separator that cannot reconstruct the token; the replacement spelling is not fixed. Public snapshots contain no raw connection/options/environment, and internal launcher failures use fixed findings; actual child diagnostics and stacks remain in captured logs after redaction. Public Text metadata fields are limited to 4096 UTF-8 bytes and set `metadataTruncated: true` when shortened; no suffix is added that could recreate a token. Such displayed paths are not exact cleanup operands. Filesystem ownership and cleanup use the original full paths. Keep credentials out of script-generated data and arguments; this is known-token redaction, not a general secret detector.

At most 16 live or terminal job records are retained. `getScriptJob(id)` looks up this process's retained record only. `close()` releases a terminal record and logs; active close is refused as BUSY and never kills anything. Terminal records are not silently evicted. This registry cap does not override Blender's exclusive connection owner, and a later CLI process cannot inspect an earlier job.

`runHeadlessProject(options)` runs one saved project script against a newly owned background Blender. Supply `entry`, an explicit `blenderExecutable`, and an explicit `extensionDirectory` containing `headless_bootstrap.py` with its matching Python core. Both a source extension directory and an actual extracted ZIP installation work; there is no repository-path fallback, automatic extension search, or Python source copy. Optional `cwd`, `project`, and `args` keep their project-runner meanings. Optional `blendFile` loads an existing .blend before bootstrap; otherwise Blender uses factory startup data. Existing GUI credentials are not adopted, and `connection` is not a headless option.

```ts
import {
  type IHeadlessProjectResult,
  runHeadlessProject,
} from "@blendia/runtime";

async function main(): Promise<void> {
  const result: IHeadlessProjectResult = await runHeadlessProject({
    blenderExecutable: "/path/to/blender",
    extensionDirectory: "/path/to/installed/blendia",
    cwd: "/path/to/project",
    project: "tsconfig.json",
    entry: "src/scene.ts",
  });
  console.log(result);
}

void main().catch(console.error);
```

`startupTimeoutMs` defaults to 120000 and covers only native Blender readiness plus private control authentication. `shutdownTimeoutMs` defaults to 10000 and covers cooperative completion acknowledgment and Blender exit/pipe closure after a known script terminal result. Both accept safe integers from 100 through 3600000 ms. Neither bounds the user's script, `ttsx`, typia, or cold native preparation. SDK response deadlines are separate. Invalid options or unavailable explicit prerequisite paths reject before creating a private workspace or launching a process.

The one-shot captures and ignores child stdin, returns the existing script snapshot in `script`, and reports Blender's raw `blender` status, `blenderOutcome`, and observed `blenderPid` separately. `scriptLogs` and `blenderLogs` contain separate bounded retained journal pages with cursor gaps; each process retains at most 64 KiB and 1024 entries. `completed` requires a known script terminal result, cooperative acknowledgment, and ordinary Blender zero exit with pipe closure. It can still contain a nonzero script exit. A script zero alone establishes no composite success.

Unknown startup, control loss, native status, or pipe completion retains runtime-owned private config/readiness storage and reports `cleanup: "retained"` with `retainedDirectory`; that directory contains private credentials. Capture readers and process references are released so a surviving child cannot indefinitely pin the caller's event loop. Either Blender, the TypeScript launcher, or their unknown descendants may remain active after an unknown result; releasing observation never kills or proves termination. The original script file is not copied or deleted, and this entry does not stage a Text input. Known cleanup removes only unchanged owned config/readiness files and an empty owned directory, without recursive deletion or touching explicit user outputs.

Bridge artifact IDs and bridge-owned PNGs expire with the owned Blender session. Persist a PNG or .blend by explicitly publishing it to a user-selected path from the same TypeScript script. Process exit does not automatically save a file, establish rollback, or make an expired bridge artifact a durable URI. This is a foreground one-shot, with no persistent session, cancellation, process-tree termination, replay, or takeover of a user's Blender process.

`discoverBlenderSessions({ directory })` scans one explicit descriptor directory and returns sanitized session metadata without tokens or socket access. `probe: true` explicitly permits bounded hello/disconnect observations, briefly reserving idle sessions and reporting BUSY without takeover. Scan truncation and probe-budget truncation are separate. `doctorProject({ cwd, project })` reports actual Node, public ttsx, dependency metadata, and config candidates with `execution: "not-tested"`; it does not execute a compiler or verify Go, network, plugins, or native first-use preparation. The source CLI itself must bootstrap before reporting metadata. Initial native/plugin preparation can take several minutes and require network access.
