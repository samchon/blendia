# @blendia/runtime

Run an existing project TypeScript file through `ttsc`'s `ttsx`. The runtime uses the current Node executable, the actual project directory, and an argument array without a shell. `ttsx` owns project discovery, type checking, transformations, source maps, and its private compilation cache.

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

The consuming project needs its native TypeScript compiler, imported npm packages, and any compiler plugins named in its tsconfig. Install the compiler there with `npm install --save-dev typescript`, with optional dependencies enabled. The launcher supplies `ttsx`; it does not build packages before local execution or invent a replacement project configuration.

`runTextMacro` accepts `ITextMacroOptions`: a `text` snapshot, explicit `cwd`, a logical `sourcePath`, and optional `origin`, `project`, `args`, and `connection`. `ITextMacroContext` represents those same project and origin fields before a snapshot is read. Text is limited to `TEXT_MACRO_MAX_BYTES` (256 KiB of UTF-8). The source must be a non-declaration `.ts`, `.tsx`, `.mts`, or `.cts` path within the project and have an existing writable parent directory. An unsaved source path is allowed; an existing file is never overwritten.

The snapshot runs as a uniquely named sibling module with the same TypeScript suffix. Relative imports keep their directory context, but its filename, module identity, diagnostics, `__filename`, and `import.meta.url` differ from the intended source. The original on-disk source can still fail whole-project checking. The tsconfig must support the staged sibling; this is a module macro, not an unsaved-file overlay or self-import replacement.

`ITextMacroResult` adds `origin`, `sourcePath`, `stagedPath`, `staging`, and optional `cleanupError` to the process result. An ordinary direct-launcher exit attempts removal of the runtime-owned staging file after comparing its full file identity. A signal, uncertain launch, changed path identity, or cleanup failure retains the file and reports the path. Creation failure does not establish file ownership; write or close failure after exclusive creation reports the owned retained path. Abrupt host termination can leave a staging file behind. Macros must not detach descendants that continue to rely on that temporary module; their lifetime is not controlled here.

The script inherits standard input, standard output, standard error, and the process environment. `connection.port` and `connection.token`, when provided, override `BLENDIA_PORT` and `BLENDIA_TOKEN` for that child only. Otherwise existing values are inherited. The runtime opens no SDK connection; the script's `BlenderClient` owns its socket. Keep credentials in the environment rather than command arguments.

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

`inspect()` reports `id`, `ownerId`, phase, optional outcome/result/diagnostic, `metadataTruncated`, and earliest/tail log cursors. `running` means the launcher spawned, not that user TypeScript began. Terminal outcomes are `exited` (including nonzero script exits), `launch-failed`, and `unknown`. Signal, lost pipe observation, or pipes still open two seconds after direct exit produce `unknown`; descendants may remain active and Text staging is retained. No outcome certifies Blender success, rollback, or cancellation.

`readLog(cursor = 0, byteLimit = 16384)` returns entries with `cursor`, `stream`, and `text`, plus `earliestCursor`, `nextCursor`, `gap`, and `hasMore`. Cursors count entries starting at zero and apply only to the same job and owner. `nextCursor` is the first unreturned position. Reads reject unsafe, negative, or future cursors and budgets outside 4096–16384 UTF-8 payload bytes. Retention is at most 64 KiB and 1024 entries; entries contain at most 2048 UTF-8 bytes, and a page contains at most 128 entries. A slow consumer gets an explicit gap while capture continues draining. These are bounded defaults, not benchmark results or serialized JSON size limits.

Known effective connection tokens are redacted across output chunks. Public snapshots contain no raw connection/options/environment, and internal launcher failures use fixed findings; actual child diagnostics and stacks remain in captured logs after redaction. Public Text metadata fields are limited to 4096 UTF-8 bytes with `[truncated]` and `metadataTruncated: true`; such displayed paths are not exact cleanup operands. Filesystem ownership and cleanup use the original full paths. Keep credentials out of script-generated data and arguments; this is known-token redaction, not a general secret detector.

At most 16 live or terminal job records are retained. `getScriptJob(id)` looks up this process's retained record only. `close()` releases a terminal record and logs; active close is refused as BUSY and never kills anything. Terminal records are not silently evicted. This registry cap does not override Blender's exclusive connection owner, and a later CLI process cannot inspect an earlier job.

`discoverBlenderSessions({ directory })` scans one explicit descriptor directory and returns sanitized session metadata without tokens or socket access. `probe: true` explicitly permits bounded hello/disconnect observations, briefly reserving idle sessions and reporting BUSY without takeover. Scan truncation and probe-budget truncation are separate. `doctorProject({ cwd, project })` reports actual Node, public ttsx, dependency metadata, and config candidates with `execution: "not-tested"`; it does not execute a compiler or verify Go, network, plugins, or native first-use preparation. The source CLI itself must bootstrap before reporting metadata. Initial native/plugin preparation can take several minutes and require network access.
