# Project TypeScript scripting

This planning seed establishes the first functional mission after [frame PR #8](https://github.com/samchon/blendia/pull/8). Implementation begins only after this mission's Draft PR exists. The existing [tracker #1](https://github.com/samchon/blendia/issues/1) and [SDK #2](https://github.com/samchon/blendia/issues/2), [runtime #3](https://github.com/samchon/blendia/issues/3), [Blender execution #4](https://github.com/samchon/blendia/issues/4), and [verification #6](https://github.com/samchon/blendia/issues/6) retain the research context and remaining work.

## First bounded outcome

A project TypeScript entry imports the SDK and creates, reads, and transforms a cube in an existing live Blender session. The unscoped `blendia` CLI invokes the shared runtime, which uses the installed project `ttsx` and preserves project root, tsconfig, entry, arguments, and diagnostics. The Python extension owns Blender registration and main-thread API execution. This is a useful first seam, not full bpy parity or a replacement for Blender's engine or editor.

The known development host has Blender 5.2.0 LTS and a pnpm-managed Node 22.23.2 installation; the global Node is a different version. Discovery and launch behavior must respect the project toolchain rather than silently assuming the global executable is equivalent.

## Ownership and dependency direction

| Owner | First responsibility |
| --- | --- |
| `packages/sdk` | Internal wire types and framing, async client, session/object handles, create/read/transform operations |
| `packages/runtime` | Project run specification, installed ttsx resolution/launch, session handoff, execution result and diagnostics |
| `packages/cli` (`blendia`) | Terminal consumer of the shared runtime and SDK |
| `blender/extension` | Python extension registration, authenticated local transport, bounded nonblocking polling, main-thread commands |
| `packages/mcp` | Later additive facade over the same runtime/SDK; no second implementation |

The intended dependency direction is SDK to runtime to CLI, with future MCP consuming runtime/SDK. Shared compiler configuration does not own runtime product types. A new public protocol package is unnecessary for this slice. Agree shared contracts before concurrent implementations diverge.

## Initial execution contracts

- The local bridge binds to loopback with an ephemeral or explicitly configured port and a random session token. A framed handshake checks the token, protocol version, capabilities, session identity, and generation.
- JSON messages have a four-byte big-endian length prefix, bounded payload size, and request correlation IDs. Decoder behavior covers partial and coalesced frames and rejects invalid/oversized input.
- One SDK owner executes a macro at a time. Reject competing ownership as busy; do not build a distributed queue or silently race writers.
- Blender socket accept/receive/send work is nonblocking and bounded per timer tick. Only the Blender main thread performs bpy operations. Long blocking receives must not freeze the UI.
- The initial SDK supports cube creation, object readback, and transform changes through explicit async calls. Validate finite vectors and session/generation-aware handles. Final method/type names are agreed by the implementation owners.
- Connection loss after a mutation was sent can leave an unknown outcome. Do not automatically retry it. Report partial changes and cancellation limitations honestly; a batch is not a transaction.
- Runtime execution resolves the installed project ttsx and intended Node executable, preserving cwd, tsconfig, arguments, stdout/stderr, and original TS diagnostics. Do not create another TS engine or force unrelated global environment changes.
- Add meaningful unit cases for implemented first-party logic only. Do not restore discarded manifest/configuration, upstream transformation, empty-import, distribution, tarball, or synthetic-runner tests or manual equivalents.
- Validate the actual supported TS-to-Blender workflow against the installed Blender when implementation exists. This is direct product validation; the historical automated integration/benchmark proposals are advisory and are not current test-suite authorization.

## Five-stage roadmap

1. Connect the live Blender Python bridge, typed SDK operations, shared ttsx runtime, and `blendia run` consumer for a real project script with useful errors and first-party units.
2. Add Blender's Run TypeScript project/file action, session selection, logs, and honest Stop/job behavior using the same execution path.
3. Support Blender Text datablocks in their project context, including unsaved edits, import/tsconfig resolution, source mapping, and safe staging without overwriting unrelated files. Preserve this original in-Blender scripting requirement without expanding it into a complete TS IDE or LSP.
4. Extend the useful SDK with required material/render/modeling operations, bulk data, and reference/context/undo contracts as actual consumers justify them.
5. Add the thin requested typia/MCP facade for execution and structured/visual observation, including native image blocks where needed, while reusing the same service.

## Markdown alignment in this mission

The latest user instruction requires one logical Markdown prose paragraph per physical line, without manual word wrapping. Normalize existing documentation and skill prose while preserving blank paragraph separators, list items, tables, headings, and fenced code. Record the rule in canonical instructions and inspect the appropriate formatter setting; avoid unrelated semantic rewrites.

## Delivery and exclusions

Keep the mission Draft during implementation. Collect all applicable source/unit check and review findings before fixing causes together. Complete a fresh self-review and configured CI on the exact head, then mark ready and merge under the standing authorization. Commit an explicit source/configuration/documentation/lockfile allowlist; generated binaries, dependencies, build output, and tarballs remain excluded.

No universal bpy code generation, synchronous Python-addon callback replacement, complete TS IDE, arbitrary asset-generation platform, hosted execution, Three.js integration, or package publication is included in this first slice.
