# blendia

Execute an existing project TypeScript script through the shared `@blendia/runtime` launcher. Blender modeling operations are performed by the SDK imported by that script, against a running Blendia extension. This package does not start a second Blender engine or automatically acquire an SDK connection.

The CLI is not yet published to npm. With the repository's `blendia` executable available, run a file from its own project:

```sh
blendia --help
blendia run --cwd /path/to/project --project tsconfig.json src/model.ts -- --name Cube
```

The script's project must provide its own SDK and npm dependencies; the launcher does not install them or rewrite package resolution.

```text
blendia run [--cwd <dir>] [--project <tsconfig>] <entry> [-- <script args...>]
blendia --help
```

`--cwd` and `--project` may each appear once, before the entry. Omitted cwd uses the current directory and omitted project delegates tsconfig discovery to `ttsx`. Missing, blank, repeated, and unknown launcher options fail. Use an explicit relative path such as `./-model.ts` for an entry whose filename starts with a dash. Every argument after the entry belongs to the script, including `--help` and `--project`. One `--` immediately after the entry is removed as the CLI separator; later `--` values remain intact.

Start the Blender extension and set its connection values in `BLENDIA_PORT` and `BLENDIA_TOKEN` before running a script that calls `BlenderClient.connect()`. Both values are inherited; there are no credential command-line flags. See the [SDK](../sdk/README.md) and [Blender extension](../../blender/extension/README.md) for the connection and scene API.

Project type errors and runtime diagnostics remain on the inherited terminal streams. Ordinary launcher exit codes are returned by the CLI. A reported termination signal or launch failure produces a nonzero status. A successful process exit does not establish that Blender changes were rolled back or that descendants have stopped; there is no Stop or transaction interface in this slice.

Running a saved project file is supported by this command. Blender's own Run TypeScript action and unsaved editor text are planned follow-up features.
