# Blendia Blender extension

Connect project TypeScript to an existing Blender 5.2 or newer session. The extension creates a local authenticated connection and performs scene edits on Blender's main thread. The Blendia SDK supports bounded scene inspection, cube and mesh creation, opaque Principled materials, cameras, area lights, local transforms, native PNG rendering and explicit PNG/.blend destinations.

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

Mesh creation accepts up to 8192 vertices, 8192 faces and 32768 face corners, subject to the separate message-size limit. Invalid topology is rejected rather than silently repaired. Whole-mesh material assignment requires local editable single-user mesh data; shared or linked data is refused. Camera creation changes the active scene camera only with explicit `setActive: true`. See the [SDK guide](../../packages/sdk/README.md) for typed operations.

Native rendering uses the current scene camera, frame and engine. Requested resolution and PNG settings remain in the scene; only the owned temporary output filepath is conditionally restored. While rendering/finalizing, only render status, existing artifact reads/releases and disconnect remain available. Save operations require an explicit absolute destination and refuse overwriting by default. Filesystem publication and native save handlers are outside scene undo/rollback.

Select Stop Blendia to revoke the token, close connections, and remove this session's descriptor. Disabling the extension also revokes bridge access. Neither action cancels a native render; its owned callbacks continue observing completion and temporary-path cleanup. Starting another session waits for that retirement boundary. A process crash can leave a stale descriptor or private output; a descriptor file alone does not prove a session is running.

## Run TypeScript from Blender

Prepare the source checkout and your project's compiler, local SDK link and imports with the [external-project setup](../../docs/design/script-jobs.md#set-up-an-external-source-checkout-project). Blendia supplies public `ttsx`; project scripts run through Node.js and call the SDK's supported Blender operations.

Open the TypeScript Macros panel in the viewport's Blendia sidebar. Set Project Directory to an absolute project path and Node Executable to an absolute Node executable. For a local checkout, set CLI Entry to `packages/cli/src/bin.ts` and ttsc package.json to the installed `ttsc/package.json`, both as absolute paths. The extension resolves that package's public `ttsx` launcher and runs the CLI source without a build. The selected CLI package must also contain its shipped `nativeBootstrap.cjs` beside the `src` or `lib` directory; Node loads that environment shim before the source launcher or package's JavaScript entry. It preserves healthy temporary settings and prepares verified owned storage automatically, with no new panel field or manual TEMP setup. Select real files rather than shell wrappers; do not use Blender-relative `//` paths for these tool and directory settings. See the [startup guide](../../docs/design/native-startup.md#supported-launch-paths) for retained scratch and observation limits.

Set Source Path to your TypeScript entry, relative to Project Directory or absolute. Project tsconfig optionally selects a configuration relative to the project directory. Arguments (JSON) accepts a JSON string array, such as `["draft", "--quality=low"]`. Select Run TypeScript File to execute the saved file; it does not save or execute a dirty Text buffer. Close any existing SDK client first because the bridge accepts one client at a time.

To execute edits in Blender's Text Editor, select the Text datablock, open its Blendia sidebar, and select Run Active Text Snapshot. Set Source Path explicitly, including for an unsaved Text. It must identify a `.ts`, `.tsx`, `.mts`, or `.cts` source inside the project, with an existing writable parent directory. The UTF-8 snapshot is limited to 256 KiB. Use an ES module, with imports or exports, rather than a global script.

The Text snapshot is executed as a random sibling beside Source Path so relative imports and project package resolution use that directory. The original disk source, Text datablock and tsconfig are preserved. This is not an unsaved editor overlay: the actual staged filename appears in diagnostics, `import.meta.url` and module identity differ, self-imports still resolve the original file, and errors in an old on-disk source can still fail whole-project checking. Sibling staging also follows the project's include/exclude rules.

The panel displays the captured script job's identity, phase and outcome separately from the outer CLI's exit. Child stdout/stderr arrives through Node's captured-log events; bootstrap compiler diagnostics are also retained. Copy TypeScript Output copies the displayed tail, limited to 64 KiB. Earlier output or missing captured-log history is marked as truncated; shortened job metadata is flagged separately. Only one launcher runs at a time. A confirmed normal job terminal, drained output and observed outer CLI exit allow private Text input cleanup; the runtime reports its sibling staging disposition. A CLI exit alone does not confirm script completion. Missing or damaged machine events, interrupted execution and observation failures retain private input and block further launches; resolve any surviving descendants before restarting Blender and deleting retained files.

There is no macro cancellation action in this version. Stop Blendia revokes the bridge connection, and disabling the extension removes its controls, but neither proves a TypeScript process or its descendants stopped or rolls back scene changes. While Blender remains open, a disabled extension continues draining and reaping its already launched CLI without reading removed UI settings. Closing Blender can leave TypeScript descendants and private inputs; resolve those processes before deleting retained files. Arbitrary project code runs with your user account's permissions.

## Owned background projects

The extension also includes `headless_bootstrap.py` for the runtime's one-shot background project operation. Supply the actual extracted or installed extension directory explicitly; the bootstrap imports its colocated core without registering the GUI. An older installed ZIP without this entry cannot run that operation. See the [headless guide](../../docs/design/headless-projects.md) for the runtime and CLI setup.

The owned Blender runs scene operations on one main thread with the same input, identity and partial-effects checks. Background scene edits bypass the GUI undo adapter and do not promise undo or rollback. Native background rendering uses blocking execution, so SDK/control deadlines can expire before Blender can read another request. The parent control connection is separate from the SDK writer lease; parent loss or a finish request is observed between commands and never authorizes replay or cancellation.

Only explicitly saved PNG/.blend destinations persist beyond the owned session. Private bridge artifacts end with that session. Normal shutdown observes native completion and cleans owned resources; incomplete execution or cleanup remains uncertain and can retain private paths. The one-shot runtime does not adopt an existing GUI Blender, search for a different extension checkout, or kill unknown descendants.
