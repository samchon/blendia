# Blendia Blender extension

Connect project TypeScript to an existing Blender 5.2 or newer session. The extension creates a local authenticated connection and performs scene edits on Blender's main thread. It supports cube creation, object readback, and local transforms through the Blendia SDK.

## Install and start

No published extension ZIP is available yet. To prepare one from a source checkout, run `pnpm run extension:license` from the repository root before creating the archive. This generates this directory's ignored `LICENSE` from the canonical repository-root license; do not commit the generated copy. See the [packaging notes](../../docs/conventions.md#compiler-exports-and-commands).

Create a ZIP containing this directory's `blender_manifest.toml`, `__init__.py`, `commands.py`, `protocol.py`, `server.py`, and the generated `LICENSE` at the archive root. In Blender, open Edit → Preferences → Get Extensions, open the extension menu, select Install from Disk, and choose that ZIP. Enable Blendia.

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

The extension does not execute arbitrary Python or TypeScript code inside Blender. Project TypeScript runs through Node.js and `ttsx`, calling the SDK's supported scene operations. The in-Blender Run TypeScript project action and unsaved Text datablock execution are planned follow-up work.
