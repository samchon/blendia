# Blendia

Blendia brings TypeScript scripting to an existing Blender installation. It is designed for people and coding agents working in TypeScript projects, with Blender handling modeling, scene evaluation, and rendering.

The initial workflow focuses on running a saved project script to create, inspect, and transform Blender objects through a typed SDK. A Blender extension connects the script to the live scene.

## Status

Blendia is in early development and is not yet published to npm. The first end-to-end workflow is still being validated; released installation instructions are not available yet.

A Blender Run TypeScript action and support for unsaved editor scripts are planned follow-up features.

## Usage documentation

The current interfaces and their limitations are documented here while validation continues:

- [CLI](packages/cli/README.md): running saved project TypeScript files.
- [SDK](packages/sdk/README.md): connecting to Blender and working with scene objects.
- [Blender extension](blender/extension/README.md): establishing the live Blender connection.
