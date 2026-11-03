# Blendia Blender extension

Connect project TypeScript to an existing Blender 5.2 or newer session. The extension creates a local authenticated connection and performs scene edits on Blender's main thread. It supports cube creation, object readback, and local transforms through the Blendia SDK.

## Install and start

No published extension ZIP is available yet. To prepare one from a source checkout, run `pnpm run extension:license` from the repository root before creating the archive. This generates this directory's ignored `LICENSE` from the canonical repository-root license; do not commit the generated copy. See the [packaging notes](../../docs/conventions.md#compiler-exports-and-commands).

Create a ZIP containing this directory's `blender_manifest.toml`, all `.py` files, and the generated `LICENSE` at the archive root. In Blender, open Edit → Preferences → Get Extensions, open the extension menu, select Install from Disk, and choose that ZIP. Enable Blendia.

In the 3D Viewport, press N and open the Blendia tab. Select Start Blendia. The panel shows the local port and whether a TypeScript client owns the connection. Starting the extension does not edit the scene.

Select Copy Session File Path. In the same PowerShell session where you will run your project, read that file without printing its token:

```powershell
$connection = Get-Content -LiteralPath '<copied session file path>' -Raw | ConvertFrom-Json
$env:BLENDIA_PORT = [string]$connection.port
$env:BLENDIA_TOKEN = $connection.token
```

Alternatively, Copy Connection Environment places a JSON object containing `BLENDIA_PORT` and `BLENDIA_TOKEN` on the clipboard. Keep these values private. The project runtime inherits the two environment variables; the [CLI instructions](../../packages/cli/README.md) show how to run a project script.

## Scene behavior

Switch to Object Mode and enable Global Undo before creating or transforming objects. Each supported scene edit uses a native Blender undo step. Coordinates and scales are local properties; Euler rotations are XYZ radians. The initial API accepts positive cube sizes up to `1e20` and transform components with absolute value up to `1e20`.

The bridge accepts one authenticated TypeScript client at a time. Close that client to release ownership. Renaming an object preserves its handle. Loading a file or restoring undo/redo history invalidates old handles; reconnect and obtain current handles before continuing. Deleting an object makes its handle unavailable.

Select Stop Blendia to revoke the token, close connections, and remove this session's descriptor. Disabling the extension also stops it. A process crash can leave a stale descriptor; a descriptor file alone does not prove a session is running.

## Run TypeScript from Blender

Install the Blendia CLI and your project's SDK/npm dependencies. The project needs the native TypeScript compiler, installed with `npm install --save-dev typescript` with optional dependencies enabled. Blendia supplies `ttsx`. Project scripts run through Node.js and call the SDK's supported Blender operations.

Open the TypeScript Macros panel in the viewport's Blendia sidebar. Set Project Directory to an absolute project path and Node Executable to an absolute Node executable. For a local checkout, set CLI Entry to `packages/cli/src/bin.ts` and ttsc package.json to the installed `ttsc/package.json`, both as absolute paths. The extension resolves that package's public `ttsx` launcher and runs the CLI source directly. No prior build is required. A published CLI's JavaScript entry can also be selected directly. Select real files rather than shell wrappers; do not use Blender-relative `//` paths for these tool and directory settings.

Set Source Path to your TypeScript entry, relative to Project Directory or absolute. Project tsconfig optionally selects a configuration relative to the project directory. Arguments (JSON) accepts a JSON string array, such as `["draft", "--quality=low"]`. Select Run TypeScript File to execute the saved file; it does not save or execute a dirty Text buffer. Close any existing SDK client first because the bridge accepts one client at a time.

To execute edits in Blender's Text Editor, select the Text datablock, open its Blendia sidebar, and select Run Active Text Snapshot. Set Source Path explicitly, including for an unsaved Text. It must identify a `.ts`, `.tsx`, `.mts`, or `.cts` source inside the project, with an existing writable parent directory. The UTF-8 snapshot is limited to 256 KiB. Use an ES module, with imports or exports, rather than a global script.

The Text snapshot is executed as a random sibling beside Source Path so relative imports and project package resolution use that directory. The original disk source, Text datablock and tsconfig are preserved. This is not an unsaved editor overlay: the actual staged filename appears in diagnostics, `import.meta.url` and module identity differ, self-imports still resolve the original file, and errors in an old on-disk source can still fail whole-project checking. Sibling staging also follows the project's include/exclude rules.

The panel displays the captured script job's identity, phase and outcome separately from the outer CLI's exit. Child stdout/stderr arrives through Node's captured-log events; bootstrap compiler diagnostics are also retained. Copy TypeScript Output copies the displayed tail, limited to 64 KiB. Earlier output or missing captured-log history is marked as truncated; shortened job metadata is flagged separately. Only one launcher runs at a time. A confirmed normal job terminal, drained output and observed outer CLI exit allow private Text input cleanup; the runtime reports its sibling staging disposition. A CLI exit alone does not confirm script completion. Missing or damaged machine events, interrupted execution and observation failures retain private input and block further launches; resolve any surviving descendants before restarting Blender and deleting retained files.

There is no macro cancellation action in this version. Stop Blendia revokes the bridge connection, and disabling the extension removes its controls, but neither proves a TypeScript process or its descendants stopped or rolls back scene changes. While Blender remains open, a disabled extension continues draining and reaping its already launched CLI without reading removed UI settings. Closing Blender can leave TypeScript descendants and private inputs; resolve those processes before deleting retained files. Arbitrary project code runs with your user account's permissions.
