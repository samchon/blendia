---
name: project
description: Defines Blendia scope, package and language boundaries, and workspace commands. Use when deciding ownership, product scope, or how to build and run checks.
---

# Project

Blendia lets users and coding agents run project TypeScript against an existing Blender installation. Blender owns scene evaluation, modeling, rendering, and its UI. Node.js and `ttsc`'s `ttsx` own TypeScript execution. Three.js integration is outside scope.

Use TypeScript for packages and general development helpers. Use Python where execution must occur inside Blender against `bpy`, including extension registration, main-thread dispatch, UI integration, and API metadata extraction. A Blender fork or another embedded JavaScript engine is unnecessary for the planned execution model.

The scaffold establishes the workspace and checks its toolchain directly. `packages/sdk`, `runtime`, `cli`, and `mcp` are private package shells; `config` owns shared tooling. They do not implement the SDK, transport, runtime, CLI, MCP server, or Blender extension. No first-party product logic or unit cases exist yet; `test/README.md` only reserves the future unit-test location. Introduce public APIs and dependencies with real producers and consumers. Keep execution shared by the SDK, CLI, MCP, and Blender's Run TypeScript action when those consumers arrive.

The package names are `@blendia/sdk`, `@blendia/runtime`, `blendia`, and `@blendia/mcp`. The unscoped CLI package remains in `packages/cli`. Workspace build and Evidence selection must include it alongside the scoped packages.

After the frame is merged, choose bounded functional work from the existing issues according to dependencies and acceptance criteria, under the [canonical staged-mission authorization](../../user-instructions.md#product-and-current-scope). Establish the next Draft before product edits. Research proposals for a complete IDE, universal addon replacement, or full API parity do not silently expand the macro and project-scripting scope.

Use [commands.md](commands.md) for executable workspace commands and their limits. The [research tracker](https://github.com/samchon/blendia/issues/1) owns design questions; [tooling #7](https://github.com/samchon/blendia/issues/7) owns the scaffold and [testing #6](https://github.com/samchon/blendia/issues/6) tracks future tests alongside real implementation. Research proposals do not establish implemented capabilities.
