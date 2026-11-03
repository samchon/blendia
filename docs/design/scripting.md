# Project TypeScript scripting

This design records the first functional mission in [Draft PR #9](https://github.com/samchon/blendia/pull/9), following [frame PR #8](https://github.com/samchon/blendia/pull/8). The contracts below coordinate implementation; they are not a claim of completed product validation. The existing [tracker #1](https://github.com/samchon/blendia/issues/1) and [SDK #2](https://github.com/samchon/blendia/issues/2), [runtime #3](https://github.com/samchon/blendia/issues/3), [Blender execution #4](https://github.com/samchon/blendia/issues/4), and [verification #6](https://github.com/samchon/blendia/issues/6) retain the research context and remaining work.

## First bounded outcome

A project TypeScript entry imports the SDK and creates, reads, and transforms a cube in an existing live Blender session. The unscoped `blendia` CLI invokes the shared runtime, which uses its installed `ttsc` package's public `ttsx` executable while preserving the user's project root, tsconfig, entry, arguments, and diagnostics. The Python extension owns Blender registration and main-thread API execution. This is a useful first seam, not full bpy parity or a replacement for Blender's engine or editor.

The known development host has Blender 5.2.0 LTS and a pnpm-managed Node 22.23.2 installation; the global Node is a different version. Discovery and launch behavior must respect the project toolchain rather than silently assuming the global executable is equivalent.

## Ownership and dependency direction

| Owner | First responsibility |
| --- | --- |
| `packages/sdk` | Internal wire types and framing, async client, session/object handles, create/read/transform operations |
| `packages/runtime` | Project run specification, owned ttsc dependency and public ttsx executable resolution/launch, session handoff, execution result and diagnostics |
| `packages/cli` (`blendia`) | Terminal consumer of the shared runtime and SDK |
| `blender/extension` | Python extension registration, authenticated local transport, bounded nonblocking polling, main-thread commands |
| `packages/mcp` | Later additive facade over the same runtime/SDK; no second implementation |

Runtime imports SDK connection types, CLI imports runtime, and future MCP imports runtime/SDK. SDK does not import runtime. Shared compiler configuration does not own runtime product types. A new public protocol package is unnecessary for this slice.

## Initial execution contracts

- The local bridge binds to loopback with an ephemeral or explicitly configured port and a random session token. A framed handshake checks the token, protocol version, capabilities, session identity, and generation.
- JSON messages have a four-byte big-endian length prefix, bounded payload size, and request correlation IDs. Decoder behavior covers partial and coalesced frames and rejects invalid/oversized input.
- One SDK owner executes a macro at a time. Reject competing ownership as busy; do not build a distributed queue or silently race writers.
- Blender socket accept/receive/send work is nonblocking and bounded per timer tick. Only the Blender main thread performs bpy operations. Long blocking receives must not freeze the UI.
- The initial SDK supports cube creation, object readback, and transform changes through explicit async calls. Validate finite vectors and session/generation-aware handles. The agreed method and wire contracts are specified below.
- Connection loss after a mutation was sent can leave an unknown outcome. Do not automatically retry it. Report partial changes and cancellation limitations honestly; a batch is not a transaction.
- Runtime execution resolves its installed ttsc package's public bin metadata and launches ttsx with the current Node executable, preserving cwd, tsconfig, arguments, stdout/stderr, and original TS diagnostics. It does not import ttsc's internal launcher functions, create another TS engine, download tools, or alter the global environment.
- Add meaningful unit cases for implemented first-party logic only. Do not restore discarded manifest/configuration, upstream transformation, empty-import, distribution, tarball, or synthetic-runner tests or manual equivalents.
- Validate the actual supported TS-to-Blender workflow against the installed Blender when implementation exists. This is direct product validation; the historical automated integration/benchmark proposals are advisory and are not current test-suite authorization.

## Agreed wire contract

The transport is TCP on `127.0.0.1`. Each frame contains a four-byte unsigned big-endian body length followed by a nonempty UTF-8 JSON object of at most 1,048,576 bytes. Receivers retain partial headers/bodies and separate coalesced frames. Network reads and writes must tolerate partial progress without waiting for another client action to finish a frame.

A request is `{ id, method, params, sessionId?, generation? }`. IDs are positive decimal strings matching `^[1-9][0-9]{0,19}$` and strictly increase within a connection; a repeated or lower ID is rejected as `INVALID_REQUEST` without executing its command. IDs correlate replies and do not provide replay or idempotency guarantees across connections. The SDK sends one request at a time.

The first request is `hello` with `{ protocolVersion: 1, token }`. Its result is `{ protocolVersion: 1, sessionId, generation, blenderVersion, capabilities }`, where the version string describes the active Blender and capabilities is an array of supported method names. A successful handshake reserves the single owner connection; a competing authenticated owner receives `BUSY`. The token is a connection credential and must not appear in normal logs or diagnostics.

Authenticated requests include the session ID and nonnegative integer generation returned by the handshake. An authenticated response always includes the server's current `sessionId` and `generation`, even when rejecting a stale identity. Authentication and malformed-input errors may omit those fields. A success is `{ id, sessionId?, generation?, ok: true, result }`; a failure is `{ id, sessionId?, generation?, ok: false, error: { code, message, effects } }`. `effects` is `none` when rejected before a change, or `possible` when a mutation or its subsequent result capture may already have changed the scene. A stale-identity error must reach the caller as that error rather than being hidden by a generic response-identity check.

The object handle is `{ sessionId, generation, objectId }`, with the Blender `ID.session_uid` represented as a decimal string to preserve integer precision. Python resolves the current object for each operation. Rename does not change the handle; deletion, session replacement, and generation changes invalidate it. The extension advances generation on supported file-load and undo/redo events rather than claiming references survive those changes.

| Wire method | Parameters | Result |
| --- | --- | --- |
| `hello` | `{ protocolVersion: 1, token }` | Session/version/capability information described above |
| `cube.create` | `{ name?, size? }`; size defaults to 2 and must be finite with `0 < size <= 1e20` | Object snapshot |
| `object.get` | `{ object: handle }` | Object snapshot |
| `object.setTransform` | `{ object: handle, location?, rotationEuler?, scale? }`; at least one vector is required | Object snapshot |
| `disconnect` | `{}` | `{}`, flushed before closing the connection |

An object snapshot is `{ handle, name, type, location, rotationEuler, scale }`. Its name is the actual Blender-assigned name, not the requested name. Transform vectors contain exactly three finite numbers with absolute values at most `1e20` and describe local Blender properties; Euler angles use radians. The initial API's explicit magnitude limit avoids accepting JavaScript numbers that overflow Blender's floating-point properties; it is not a claim about every Blender API's numeric range. Applying `rotationEuler` selects XYZ Euler rotation. The snapshot does not promise evaluated geometry or world-space transforms. All supplied arguments are checked before beginning a mutation, and an empty transform update is `INVALID_ARGUMENT`.

The SDK surface is `BlenderClient.connect(options?)`, `createCube`, `getObject`, `setTransform`, and best-effort `disconnect`. Connection options contain `port` and `token`; omitted options read `BLENDIA_PORT` and `BLENDIA_TOKEN`. The host is fixed to loopback. A timeout or connection loss after a mutation was sent is an unknown execution outcome, not evidence that Blender rejected or rolled back the change. The SDK does not resend that mutation automatically.

Python owns one private undoable mutation operator. Successful mutation completion creates the supported Blender undo step. If an error occurs after data was changed, the operator preserves the undo step while returning a separate typed bridge error with `effects: possible`. This does not promise transaction rollback or restoration of Node/file side effects.

## Shared launcher contract

The CLI grammar is `blendia run [--cwd directory] [--project file] <entry> [-- <script arguments...>]`. CLI options are consumed only before the entry. One separator immediately after the entry is removed; all remaining tokens, including `--cwd`, `--project`, `--help`, and additional separators, belong to the script. The selected cwd is passed through, and an explicit project path is interpreted relative to that cwd by ttsx.

Runtime resolves the public `ttsx` bin recorded by its direct `ttsc` dependency and starts it using `process.execPath`, an argument array, `shell: false`, and `windowsHide: true`. It forwards stdout/stderr and the child environment. Explicit connection options set the two Blendia credential variables for the child; otherwise the existing environment is inherited. The launcher never acquires the SDK owner connection itself. A signal is distinct from exit code zero, and child failure does not establish that earlier Blender changes were reversed.

## Five-stage roadmap

1. Connect the live Blender Python bridge, typed SDK operations, shared ttsx runtime, and `blendia run` consumer for a real project script with useful errors and first-party units.
2. Add Blender's Run TypeScript project/file action, session selection, logs, and honest Stop/job behavior using the same execution path.
3. Support Blender Text datablocks in their project context, including unsaved edits, import/tsconfig resolution, source mapping, and safe staging without overwriting unrelated files. Preserve this original in-Blender scripting requirement without expanding it into a complete TS IDE or LSP.
4. Extend the useful SDK with required material/render/modeling operations, bulk data, and reference/context/undo contracts as actual consumers justify them.
5. Add the thin requested typia/MCP facade for execution and structured/visual observation, including native image blocks where needed, while reusing the same service.

## Markdown alignment in this mission

Write one logical Markdown prose paragraph per physical line, without manual word wrapping, while preserving blank paragraph separators, list items, tables, headings, and fenced code. The [documentation skill](../../.agents/skills/documentation/SKILL.md) owns this formatting rule and [AGENTS.md](../../AGENTS.md) routes the durable project instructions. Inspect the appropriate formatter setting without unrelated semantic rewrites; a fresh clone does not require an ignored personal instruction file.

## Delivery and exclusions

Keep the mission Draft during implementation. Collect all applicable source/unit check and review findings before fixing causes together. Complete a fresh self-review and configured CI on the exact head, then mark ready and merge under the standing authorization. Commit an explicit source/configuration/documentation/lockfile allowlist; generated binaries, dependencies, build output, and tarballs remain excluded.

No universal bpy code generation, synchronous Python-addon callback replacement, complete TS IDE, arbitrary asset-generation platform, hosted execution, Three.js integration, or package publication is included in this first slice.
