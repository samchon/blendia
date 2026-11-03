# MCP agent tools

## Scope

Blendia's MCP server lets a coding agent inspect and change a Blender scene, start native renders, receive bounded native PNG images, and run project TypeScript through the same SDK and runtime used by the CLI. It also exposes explicit-directory session discovery, metadata-only setup diagnostics, and privately configured owned headless execution. The package is private and unpublished; local execution uses TypeScript source without a build.

This guide describes the authored source contract in [PR #16](https://github.com/samchon/blendia/pull/16). [MCP #5](https://github.com/samchon/blendia/issues/5) owns actual protocol and host observations. Native-image consumption in both Codex and Claude Code remains pending; generating a content block or receiving a protocol response alone does not prove that a host's model saw the image.

## Stdio host setup

Install repository dependencies and enable the [Blender extension](../../blender/extension/README.md). Supply the bridge port and token privately to the server process as `BLENDIA_PORT` and `BLENDIA_TOKEN`; do not put credentials in prompts or tool arguments. The server snapshots this configuration at creation. `connect` explicitly opens the configured live connection; it does not discover a replacement or retry a mutation.

Configure your host's stdio command with an explicit Node executable, the installed `ttsc` package's public `bin.ttsx` target, and the absolute MCP source entry. For the repository's installed layout, the command fields below illustrate the values; replace paths and supply credentials through the host's private environment mechanism. This is a configuration template, not a claimed executed host session.

```json
{
  "command": "C:/path/to/node.exe",
  "args": [
    "D:/path/to/blendia/node_modules/ttsc/lib/launcher/ttsx.js",
    "-P",
    "D:/path/to/blendia/packages/mcp/tsconfig.json",
    "D:/path/to/blendia/packages/mcp/src/bin.ts"
  ]
}
```

The launcher path comes from the installed package's public bin metadata; it is not a private API import or compiled Blendia fallback. `pnpm --filter @blendia/mcp start` is a local convenience command, but a host's protocol command should use the direct invocation above so package-manager banners cannot enter stdout. The [stdio entry](../../packages/mcp/src/bin.ts) reserves stdout for JSON-RPC and sends generic startup/protocol diagnostics to stderr. It bounds incoming transport data at 4 MiB. Child project output is captured rather than forwarded into either protocol stream.

First-use native compiler/plugin preparation can require network access, Go tooling, and a cold cache, and can take substantially longer than a warm launch. The [first-run guide](script-jobs.md#first-run-preparation) explains the prerequisites. A host's startup/initialization timeout, a tool-call timeout, an SDK request observation timeout, and owned Blender startup/shutdown deadlines are separate. Increasing one does not extend all the others or create cancellation. Metadata `doctor` results do not prove native plugin preparation or execution readiness.

## Tools and typed results

`tools/list` derives method names, parameters, documentation, and outputs from the actual [controller](../../packages/mcp/src/BlendiaMcpController.ts), using `typia.llm.application` and `@typia/mcp`. The names below are controller/tool names, without a separate hand-maintained schema or duplicate tool registry. Use the host's discovered schema for each method's parameter object and required fields.

Spatial and RGB triples in MCP are JSON number arrays with exactly three finite components, including transform fields, mesh vertices, camera/light placement, and material/light colors. Named MCP DTOs adapt those inputs and returned snapshots, including inherited object fields and nested scene-page objects; the SDK's native tuple contract remains unchanged. The [production mapper](../../packages/mcp/src/BlendiaMcpSceneMapping.ts) checks exact length and finite indexed values before constructing fresh SDK tuples, without truncation or coercion; SDK identity, numeric, and topology bounds still apply. The [array type's length tags](../../packages/mcp/src/BlendiaMcpVector3.ts) become LLM schema descriptions rather than an enforced schema length constraint, so actual mapper admission owns that guarantee.

| Purpose | Tools | Ownership |
| --- | --- | --- |
| Live connection | `connect`, `getSession`, `disconnect` | One explicitly configured SDK writer lease |
| Objects and scene | `createCube`, `getObject`, `setTransform`, `inspectScene`, `createMesh`, `createMaterial`, `assignMaterial`, `createCamera`, `createAreaLight` | Existing SDK validation, scene generation, and mutation effects |
| Native rendering | `startRender`, `getRender` | Caller-known render UUID, native render lifetime |
| PNG and output files | `readImage`, `readArtifact`, `releaseArtifact`, `saveArtifact`, `saveBlendCopy` | Observed live images or explicit user output destinations |
| Setup observations | `discoverSessions`, `doctor` | Explicit directory or project; no default socket probe or execution smoke test |
| Captured project TS | `startScript`, `getScript`, `readScriptLogs`, `closeScript` | Process-local captured runtime records |
| Owned background Blender | `runHeadless` | One-shot runtime with privately configured executable and extension root |

Controller operations return one object schema, `IBlendiaMcpResult<T>`, with all three fields present: `ok`, `result`, and `error`. Success uses `ok: true`, the actual result, and `error: null`; failure uses `ok: false`, `result: null`, and a non-null error containing `code`, `message`, and `effects` (`none` or `possible`). A successful void operation also has `result: null`, so inspect `ok` before interpreting null. Framework input/output validation and protocol failures are separate from these declared service failures. Envelope success means the service returned its declared observation; inspect a script's outcome and exit code or a render's status rather than equating it with application success.

The server preserves typed Blender errors and effect uncertainty. Diagnostics omit raw causes and private configuration; captured child diagnostics remain bounded and known-token-redacted. A successful projection containing a known connection credential is suppressed rather than returned with altered identity fields. Credentials are not model-visible connection overrides. No arbitrary Python endpoint or filesystem-read tool is exposed; explicit file saving remains available through the existing SDK contracts.

## Native PNG tools and resources

Call `connect`, create or inspect the scene, and call `startRender` with a caller-generated `renderId`. In the normal GUI bridge, start returns a pending job; call `getRender` with its handle until the retained job succeeds. See the [scene/render guide](scene-render-save.md) for native settings, partial effects, and output ownership. After an unknown response, preserve the original UUID, reconnect explicitly if needed, and use `getRender`; do not resend the mutation as a retry.

Only succeeded jobs observed through this server's `startRender` or `getRender` add their artifact metadata to its image observations. Pass that artifact's handle to `readImage`. The private image reader checks real SDK chunks, contiguous offsets, canonical base64, and the PNG signature and IHDR dimensions against the observed metadata. It accepts at most **1 MiB of raw PNG bytes**, independently of the SDK's larger artifact bound; it does not resize, invent an image from metadata, or read a saved file as a fallback. The tool's declared result contains only `kind: "image"`, `artifact`, `mimeType`, and an opaque one-use `deliveryId`; it has no raw base64 field. The separate `readArtifact` chunk tool retains its existing explicit base64 chunk contract.

The [public transport adapter](../../packages/mcp/src/BlendiaMcpTransport.ts) correlates the real `readImage` callback through Node's public async context and adds a native `image` block at `Transport.send` only when the original JSON-RPC response ID, full metadata, and one-use ticket match the private delivery. `structuredContent` remains the declared metadata-only result, unchanged; no schema field is secretly deleted, and PNG bytes appear only in the native image block for that tool response. `textFallback: false` also avoids a JSON text copy. Generated validation, dispatch, request correlation, and unrelated errors remain with their existing owners.

The [private delivery owner](../../packages/mcp/src/BlendiaMcpImageDelivery.ts) admits at most four pending images, each at most 1 MiB, with a 4 MiB raw-equivalent total budget. Each expires after at most 30 seconds or at artifact expiry, whichever comes first; release, session replacement, and server close also retire the relevant pending copies. Full admission returns `BUSY` rather than evicting another response. A matched ticket is removed before transport send, with no retained retry copy. It is neither a durable image address nor a later image-fetch capability. Library consumers call `await createBlendiaMcpServer(transport, options)`: the asynchronous factory creates the private owner, composes the adapter, and connects the supplied public transport. Do not wrap it again or make a second `server.connect` call.

The public resource template is `blendia://artifact/{sessionId}/{artifactId}`, registered as `render-artifact` with MIME type `image/png`. `resources/read` calls the private validated image reader with the same ownership and byte checks, returning one standard base64 resource blob without creating a delivery ticket or consuming the pending tool-delivery budget. Typed failure code/effects are preserved in protocol error data. There is no resource listing or arbitrary path parameter. Template discovery or reading a blob does not itself establish native image consumption by the model.

The server retains at most four observed artifact metadata records, not durable PNG copies. Reads need the current connected session, an observed unexpired artifact, and its live bridge bytes. The bridge's 600-second artifact TTL, explicit release, session lifetime, and render provenance remain authoritative; an older observation can also leave the four-record window. `releaseArtifact` removes the bridge artifact and its local observation, while explicit saved user files remain intact. Disconnect does not cancel a native render or delete its artifacts; reconnecting to a different session drops foreign observations. A URI is not a durable output address.

## Captured project scripts

`startScript` accepts a saved entry, optional cwd/project, and arguments through [IBlendiaMcpScriptOptions](../../packages/mcp/src/IBlendiaMcpScriptOptions.ts). The script's project needs its native TypeScript compiler and imported SDK/npm dependencies, as in the [runtime guide](script-jobs.md#first-run-preparation). The tool first disconnects the MCP SDK writer so the project script can acquire the bridge lease. It then starts the existing captured runtime job; it does not reconnect the scene tools automatically.

Use the returned job `id` as `jobId` with `getScript` and `readScriptLogs`. A `running` phase means the launcher spawned, not that user TypeScript has begun. Logs preserve stream tags, cursor pages, explicit retention gaps, bounded UTF-8 text, and redacted compiler diagnostics under the [shared job contract](script-jobs.md#frozen-api-and-ownership). Job IDs belong to this server process; another CLI or server cannot query them. There is no daemon, cancel, or Stop tool.

`closeScript` releases a terminal record; an active job returns `BUSY`. Inspect terminal outcome/code/signal, consume the required logs, close the record, and call `connect` explicitly before using live scene tools again. Closing the MCP server releases observations and terminal records and defers active-record release until actual completion. It does not kill the launcher, its descendants, or Blender work, and it does not roll back mutations.

## Owned headless execution

To enable `runHeadless`, privately supply both `BLENDIA_MCP_BLENDER_EXECUTABLE` and `BLENDIA_MCP_EXTENSION_DIRECTORY` to the server. The latter is the actual source or extracted installed extension root containing the bootstrap, with no repository-relative default. Optional `BLENDIA_MCP_STARTUP_TIMEOUT_MS` and `BLENDIA_MCP_SHUTDOWN_TIMEOUT_MS` accept 100 through 3600000 milliseconds; they retain the runtime defaults when omitted. These executable, extension, and deadline settings are not model tool parameters.

The tool accepts saved-project inputs and an optional `blendFile`, delegates to [owned headless execution](headless-projects.md), and removes private `retainedDirectory` metadata from its result. Startup's default 120000 milliseconds covers Blender readiness/control attachment only; shutdown's default 10000 milliseconds covers cooperative closure after known script completion. Neither is a total script or native-plugin preparation deadline. Unknown outcomes can leave Blender, the launcher, and descendants alive with private state retained; a tool timeout or server disconnect is not cancellation.

Background native `startRender` blocks until Blender's native render returns, and its main-thread pump cannot observe control requests or cancellation while rendering. The SDK's default 30-second response observation may expire first; a script can select a larger explicit connection `timeoutMs`, without a wall-time guarantee or automatic replay. This is distinct from asynchronous GUI start/poll behavior.

Save desired PNG and `.blend` outputs explicitly from the script before the one-shot process exits. Bridge artifacts and image IDs expire with that process/session; `runHeadless` does not import them into the live MCP connection, retain PNG copies, or return durable image URIs. Persistent user files survive independently, but this facade provides no arbitrary file-image read endpoint.

## Actual acceptance and remaining scope

Protocol initialization, generated schema, and the source path above are not host acceptance results. Actual `tools/list`/`tools/call`, typed failures, shared service use, stdout purity, and native PNG delivery must be observed with the current product. Existing meaningful unit and exact-head CI observations remain separate. The later authorized `tests/test-units` and `tests/test-blender` migration belongs to its own Draft; MCP automated E2E and standalone typia revalidation were explicitly canceled.

Both real coding-agent native-image runs remain required: each Codex and Claude Code host must identify two visual properties omitted from prompt and metadata using the native image tool result. Provide neither answer nor image path/base64, and audit the complete host tool stream for zero shell/file/image-open fallback. Initialization, protocol receipt, or resource access alone is insufficient evidence. Use task-owned temporary configuration without changing global/project settings or authentication.

Final integrated acceptance installs the latest actual extension ZIP and uses a secret-free scene TypeScript workflow to produce persistent PNG and `.blend` outputs, including the same scene through headless and MCP image consumption. Preserve actual artifacts outside Git with provenance and hashes. These observations remain tracked in [MCP #5](https://github.com/samchon/blendia/issues/5); this guide does not assert they passed. Source registration is not ZIP installation or UI click automation.

Full bpy/RNA parity, an embedded JavaScript runtime, a Blender rewrite, Three.js, a daemon, process-tree cancellation, publication, and release remain outside this facade's scope.
