---
name: project
description: Defines Blendia scope, package and language boundaries, and workspace commands. Use when deciding ownership, product scope, or how to build and run checks.
---

# Project

Blendia is a pnpm TypeScript monorepo that lets users and coding agents run project TypeScript against an existing Blender installation, including project scripts and macros launched through a Blender extension. Blender owns scene evaluation, modeling, rendering, and its UI. Node.js and `ttsc`'s `ttsx` own TypeScript execution. Three.js integration and reimplementing Blender as a web application are outside scope.

Use TypeScript for packages and general development helpers. Use Python where execution must occur inside Blender against `bpy`, including extension registration, main-thread dispatch, UI integration, and API metadata extraction. A Blender fork or another embedded JavaScript engine is unnecessary for the planned execution model.

Local consumers execute source TypeScript without a build, under the [source and distribution contract](../development/SKILL.md#local-source-and-distribution). Package configuration, execution wrappers, and verification must preserve that contract.

`packages/sdk`, `runtime`, `cli`, and `mcp` own their public surfaces; `config` owns shared tooling. Introduce APIs and dependencies with real producers and consumers. Keep session and job execution reusable across the SDK, CLI, MCP, and Blender's Run TypeScript action rather than implementing the product twice. Use `typia.llm.application` and `@typia/mcp` for the MCP surface, including appropriate native image content for visual inspection. MCP also supports nonvisual inspection and execution.

The package names are `@blendia/sdk`, `@blendia/runtime`, `blendia`, and `@blendia/mcp`. The unscoped CLI package remains in `packages/cli`. Workspace build and Evidence selection must include it alongside the scoped packages.

Choose bounded work from the existing issues according to dependencies and acceptance criteria, following the [PR workflow](../pull-request/SKILL.md). A complete TS IDE inside Blender, replacement of every Python addon callback, and full Blender API parity are separate scopes requiring explicit issue decisions; they do not silently expand the macro and project-scripting contract.

Use [commands.md](commands.md) for executable workspace commands and their limits. The [research tracker](https://github.com/samchon/blendia/issues/1) owns design questions; [tooling #7](https://github.com/samchon/blendia/issues/7) owns the scaffold and [testing #6](https://github.com/samchon/blendia/issues/6) tracks future tests alongside real implementation. Research proposals do not establish implemented capabilities.
