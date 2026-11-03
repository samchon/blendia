# @blendia/sdk

Run project TypeScript against an existing Blender session. The SDK provides explicit async calls to create a cube, read an object, and change its local transform.

This package is currently available in the Blendia workspace; it has not been published to npm. Enable the Blendia extension in Blender and start its bridge. Use the displayed connection port and session token, or run the script through `blendia run` so the runtime hands the connection to it.

```ts
import { BlenderClient } from "@blendia/sdk";

async function main(): Promise<void> {
  const blender = await BlenderClient.connect();
  try {
    const cube = await blender.createCube({ name: "My Cube", size: 2 });
    await blender.setTransform({
      object: cube.handle,
      location: [1, 2, 3],
      rotationEuler: [0, 0, Math.PI / 4],
      scale: [1, 1, 2],
    });
    console.log(await blender.getObject(cube.handle));
  } finally {
    await blender.disconnect();
  }
}

main().catch((error: unknown): void => {
  console.error(error);
  process.exitCode = 1;
});
```

`connect()` reads `BLENDIA_PORT` and `BLENDIA_TOKEN`. Pass `{ port, token }` to override them, and optional `timeoutMs` to change the default 30-second connection and response timeout. Connections use this computer's loopback interface. Treat the token as a session secret.

Calls on one client must be awaited sequentially. A second pending operation fails with `BUSY`; a second client cannot take ownership of the active bridge. `blender.session` returns the authenticated Blender version, capabilities, session identity, and data generation.

Object handles survive renaming, but deletion, file loading, undo, and redo can invalidate them. Returned snapshots contain actual Blender names and local properties. Translation uses Blender units, Euler updates use XYZ radians, and scale is local. Cube sizes must be positive and at most `1e20`; each transform component must be finite and within absolute `1e20`.

Failures are `BlenderError` values with `code` and `effects`. An `OUTCOME_UNKNOWN` error with `effects: "possible"` means a sent mutation may have changed the scene before its response was lost. Inspect the scene before deciding what to do next; the SDK never retries mutations automatically. Disconnecting releases the connection and preserves scene data.

This initial API does not provide arbitrary Python execution, full Blender API parity, rendering, world-space evaluation, or transaction rollback. See the [Blendia overview](../../README.md) for the supported user workflow.
