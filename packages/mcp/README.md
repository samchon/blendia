# @blendia/mcp

Use an existing Blender installation from an MCP client through the same typed SDK and project runtime as Blendia scripts. Tools inspect and modify scenes, manage project script jobs, run isolated headless projects, and return owned render PNGs as native MCP image content.

## Connect a client

This package is currently used from a source checkout and is not published. Install the workspace dependencies as described in the [project overview](../../README.md), enable the Blendia extension in Blender, and supply its port and token privately to the MCP process.

Use an absolute checkout path in your client's stdio configuration. The example invokes the installed `ttsx` executable directly, avoiding package-manager banners on the JSON-RPC stream.

```json
{
  "mcpServers": {
    "blendia": {
      "command": "node",
      "args": [
        "C:/path/to/blendia/node_modules/ttsc/lib/launcher/ttsx.js",
        "--cwd",
        "C:/path/to/blendia/packages/mcp",
        "-P",
        "C:/path/to/blendia/packages/mcp/tsconfig.json",
        "C:/path/to/blendia/packages/mcp/src/bin.ts"
      ],
      "env": {
        "BLENDIA_PORT": "9877",
        "BLENDIA_TOKEN": "<private extension token>"
      }
    }
  }
}
```

Keep credentials in private client configuration. Connection options and headless executable paths are server configuration; tools do not accept credentials. The command writes JSON-RPC to stdout and generic process diagnostics to stderr.

The first source launch may prepare the compiler's native plugins before the MCP handshake. A client's MCP startup timeout must allow that preparation; it is separate from Blender startup observation, script execution, and rendering deadlines. A timeout does not prove that a scene operation stopped.

## Use Blender tools

Call `connect` explicitly to open the configured bridge, and inspect `getSession` before retaining scene identities. Scene tools require an existing connection and never reconnect implicitly. Tools return either `{ "ok": true, "result": ... }` or `{ "ok": false, "error": { "code": ..., "message": ..., "effects": ... } }`; an unknown outcome must be reconciled rather than blindly replayed.

Scene, mesh, transform, material, camera, lighting, render, artifact, and copy-save tools delegate to the SDK. `discoverSessions` and `doctor` expose bounded discovery and project diagnostics. `startScript`, `getScript`, `readScriptLogs`, and `closeScript` expose captured project jobs. `closeScript` releases a terminal record; it does not stop a running script or cancel a native render.

`startScript` transfers the writer lease before launching the script's SDK connection. After completion, reconnect and inspect the live scene. A render needs a caller-retained `renderId`; use `getRender` to reconcile a lost response. Only successful renders observed by this MCP server make their PNGs available to `readImage` and the image resource.

`readImage` accepts an artifact handle and emits native PNG content alongside its declared structured result. The base64 field remains in `structuredContent` to satisfy the generated output schema, so clients receive two representations of the same bounded image. Native images are limited to 1 MiB of raw PNG bytes; larger SDK artifacts remain available through chunked artifact reads or explicit export.

The resource template is `blendia://artifact/{sessionId}/{artifactId}`. It uses the same observed-handle reader and returns a PNG blob, never arbitrary filesystem bytes. Artifacts expire after the bridge's 600-second retention window or explicit release, and the MCP server retains at most four metadata observations. Disconnecting does not turn an artifact into a durable file. Save a copy explicitly when it must outlive its owning session.

## Run an isolated project

Set both `BLENDIA_MCP_BLENDER_EXECUTABLE` and `BLENDIA_MCP_EXTENSION_DIRECTORY` privately on the server process to enable `runHeadless`. The tool accepts project inputs rather than arbitrary executable or extension paths. Optional `BLENDIA_MCP_STARTUP_TIMEOUT_MS` and `BLENDIA_MCP_SHUTDOWN_TIMEOUT_MS` configure the runner's lifecycle observations in milliseconds, from 100 through 3600000.

Headless runs own a fresh Blender process and clean up their private session. Their returned logs and explicitly saved user artifacts can be consumed after completion; handles from the retired session cannot be read through the live image resource. Render an image in the live MCP session when native image delivery is required.

## Embed the server

```typescript
import { BlendiaMcpTransport, createBlendiaMcpServer } from "@blendia/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = createBlendiaMcpServer();
await server.connect(new BlendiaMcpTransport(new StdioServerTransport()));
```

The factory uses `typia.llm.application` and `@typia/mcp` for generated schemas, validation, and dispatch. The public transport adapter only adds native image presentation, and public resource registration owns the separate resource route. The stdio command bounds incoming JSON-RPC buffers to 4 MiB; embedding applications own their chosen transport's input policy.
