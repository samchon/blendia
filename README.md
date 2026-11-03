# Blendia

Blendia brings TypeScript scripting to an existing Blender installation. It is designed for people and coding agents working in TypeScript projects, with Blender handling modeling, scene evaluation, and rendering.

Run a saved project script to create, inspect, and transform Blender objects through a typed SDK. The Blendia extension connects the script to the live scene.

## Status

Blendia is in early development and is not yet published to npm. The current repository version supports saved project files; setup and usage are documented below.

A Blender Run TypeScript action and support for unsaved editor scripts are planned follow-up features.

## Run a project script

Enable the [Blender extension](blender/extension/README.md) and configure its connection as described in the [CLI guide](packages/cli/README.md). Your script's project needs the native TypeScript compiler (`npm install --save-dev typescript`, with optional dependencies enabled) and the SDK/npm packages it imports. Blendia supplies the `ttsx` launcher.

From the repository with its dependencies installed, run the source CLI directly:

```sh
pnpm blendia run --cwd /path/to/project --project tsconfig.json src/model.ts
```

## Usage documentation

The current interfaces and their limitations are documented here:

- [CLI](packages/cli/README.md): running saved project TypeScript files.
- [SDK](packages/sdk/README.md): connecting to Blender and working with scene objects.
- [Blender extension](blender/extension/README.md): establishing the live Blender connection.
