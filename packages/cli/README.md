# blendia

Execute an existing project TypeScript script through the shared `@blendia/runtime` launcher. Blender modeling operations are performed by the SDK imported by that script, against a running Blendia extension. This package does not start a second Blender engine or automatically acquire an SDK connection.

The CLI is not yet published to npm. Run it directly from this checkout through `ttsx`, without building first:

```sh
pnpm exec ttsx packages/cli/src/bin.ts --help
pnpm exec ttsx packages/cli/src/bin.ts run --cwd /path/to/project --project tsconfig.json src/model.ts -- --name Cube
```

The script's project must provide its native TypeScript compiler, SDK, imported npm packages, and any plugins named in its tsconfig. Install the compiler there with `npm install --save-dev typescript`, with optional dependencies enabled. The launcher does not install dependencies or rewrite package resolution.

```text
blendia run [--cwd <dir>] [--project <tsconfig>] <entry> [-- <script args...>]
blendia run-text --cwd <dir> --source-path <logical.ts> --input-file <utf8> [--project <tsconfig>] [--origin <label>] [-- <script args...>]
blendia --help
```

`--cwd` and `--project` may each appear once, before the entry. Omitted cwd uses the current directory and omitted project delegates tsconfig discovery to `ttsx`. Missing, blank, repeated, and unknown launcher options fail. Use an explicit relative path such as `./-model.ts` for an entry whose filename starts with a dash. Every argument after the entry belongs to the script, including `--help` and `--project`. One `--` immediately after the entry is removed as the CLI separator; later `--` values remain intact.

`run-text` reads a regular UTF-8 snapshot file of at most 256 KiB. Its project directory, logical source path, and input file are explicit required options; relative paths use the project directory. Each option may appear once, and its first `--` separates script arguments. `--origin` optionally labels the Blender Text in the final report. The CLI reads and closes the input file before execution and never deletes it; its creator owns cleanup.

The logical source must be a non-declaration `.ts`, `.tsx`, `.mts`, or `.cts` module within the project, with an existing writable parent directory. A unique sibling is created without overwriting the original and runs through the same source-based `ttsx` path. Its filename and module identity differ, and errors in the original on-disk source still participate in project checking. Diagnostics name the staged file; the final report names its origin and intended source. Normal launcher completion removes the owned sibling; abnormal termination or cleanup failure retains and reports its path. A retained staging file makes the command return a nonzero status even when the script itself returned zero.

Start the Blender extension and set its connection values in `BLENDIA_PORT` and `BLENDIA_TOKEN` before running a script that calls `BlenderClient.connect()`. Both values are inherited; there are no credential command-line flags. See the [SDK](../sdk/README.md) and [Blender extension](../../blender/extension/README.md) for the connection and scene API.

Project type errors and runtime diagnostics remain on the inherited terminal streams. Ordinary launcher exit codes are returned by the CLI. A reported termination signal or launch failure produces a nonzero status. A successful process exit does not establish that Blender changes were rolled back or that descendants have stopped; there is no Stop or transaction interface in this slice.

The extension's project-file and Text actions use the same source CLI commands. Text execution stages a sibling module; it does not provide an editor overlay or a full TypeScript IDE.
