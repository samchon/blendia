# Blendia

Blendia brings TypeScript scripting to an existing Blender installation. It is designed for people and coding agents working in TypeScript projects, with Blender handling modeling, scene evaluation, and rendering.

Run a project script to create and inspect Blender scenes through a typed SDK, including meshes, materials, cameras, lights, native PNG renders, and `.blend` copies. The Blendia extension connects the script to the live scene.

## Status

Blendia is in early development and is not yet published to npm. The current repository version supports saved project files; setup and usage are documented below.

The Blender extension includes preview actions for running project files and active Text snapshots. Their setup and limitations are described in the [extension guide](blender/extension/README.md#run-typescript-from-blender).

## Run a project script

Enable the [Blender extension](blender/extension/README.md) and configure its connection as described in the [CLI guide](packages/cli/README.md). Your script's project needs the native TypeScript compiler (`npm install --save-dev typescript`, with optional dependencies enabled) and the SDK/npm packages it imports. Blendia supplies the `ttsx` launcher.

From the repository with its dependencies installed, run the source CLI directly:

```sh
pnpm blendia run --cwd /path/to/project --project tsconfig.json src/model.ts
```

See the [execution and diagnostics guide](docs/design/script-jobs.md#first-run-preparation) for first-run native compiler/plugin preparation, structured output, session discovery, and metadata-only setup checks.

## Run from Blender

The extension's TypeScript Macros panel provides Run TypeScript File for a saved project entry and Run Active Text Snapshot for the selected Text Editor buffer. Both use your project's compiler and dependencies. Follow the [extension setup](blender/extension/README.md#run-typescript-from-blender) to select the project and execution tools.

An active Text snapshot runs as a sibling module in an explicit project directory. The original disk file and Text are preserved, but module identity changes, self-imports still use the original file, and old on-disk errors can still fail project checking. There is no macro Stop or automatic rollback: stopping the bridge does not cancel the script, and changes already made to Blender can remain after failure.

## Usage documentation

The current interfaces and their limitations are documented here:

- [CLI](packages/cli/README.md): running saved project TypeScript files.
- [SDK](packages/sdk/README.md): connecting to Blender and working with scene objects.
- [MCP agent tools](docs/design/mcp-agent-tools.md): connecting a coding agent to scene tools, captured scripts, and bounded native PNG images.
- [Scene authoring and outputs](docs/design/scene-render-save.md): creating a scene, rendering a PNG, and saving a `.blend` copy with explicit output ownership.
- [Owned headless projects](docs/design/headless-projects.md): running one project script in a new background Blender with explicit executable and extension paths.
- [Blender extension](blender/extension/README.md): establishing the live Blender connection.
