# @blendia/sdk

Run project TypeScript against an existing Blender session. Create and inspect objects, author bounded meshes and materials, position cameras and lights, render a native PNG, and save explicit PNG and .blend results.

This package is currently available in the Blendia workspace and has not been published to npm. Enable the Blendia extension in Blender and start its bridge. Run the project script through `blendia run`, or supply the displayed connection port and session token to `BlenderClient.connect({ port, token })`. Treat the token as a secret.

The following script creates a pyramid, assigns an opaque material, selects a camera, lights the scene, and saves both outputs. Pass the PNG and .blend destination paths as its two script arguments. Their parent directories must already exist; existing files are preserved unless `overwrite: true` is explicitly supplied.

```ts
import {
  BlenderClient,
  type BlenderRenderJob,
  type IBlenderMaterialSnapshot,
  type IBlenderMeshSnapshot,
  type IBlenderRenderHandle,
} from "@blendia/sdk";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { setTimeout } from "node:timers/promises";

async function main(): Promise<void> {
  if (!process.argv[2] || !process.argv[3])
    throw new Error("Pass PNG and .blend destination paths.");
  const blender: BlenderClient = await BlenderClient.connect();
  const render: IBlenderRenderHandle = {
    sessionId: blender.session.sessionId,
    renderId: randomUUID(),
  };
  try {
    console.log(await blender.inspectScene({ limit: 50 }));
    const mesh: IBlenderMeshSnapshot = await blender.createMesh({
      name: "Pyramid",
      vertices: [
        [-1, -1, 0],
        [1, -1, 0],
        [1, 1, 0],
        [-1, 1, 0],
        [0, 0, 2],
      ],
      faces: [
        [3, 2, 1, 0],
        [0, 1, 4],
        [1, 2, 4],
        [2, 3, 4],
        [3, 0, 4],
      ],
    });
    const material: IBlenderMaterialSnapshot = await blender.createMaterial({
      baseColorLinearRGB: [0.1, 0.4, 0.8],
      roughness: 0.35,
    });
    await blender.assignMaterial({
      object: mesh.handle,
      material: material.handle,
    });
    await blender.createCamera({
      location: [5, -7, 5],
      target: [0, 0, 1],
      setActive: true,
    });
    await blender.createAreaLight({
      location: [2, -3, 6],
      target: [0, 0, 1],
      powerWatts: 1000,
      size: 5,
    });
    console.log("Native render identity:", render);
    let job: BlenderRenderJob = await blender.startRender({
      renderId: render.renderId,
      width: 512,
      height: 512,
    });
    while (job.status === "running" || job.status === "finalizing") {
      await setTimeout(100);
      job = await blender.getRender(render);
    }
    if (job.status !== "succeeded")
      throw new Error("Native render ended with status: " + job.status);
    console.log(
      await blender.saveArtifact({
        artifact: job.artifact.handle,
        path: path.resolve(process.argv[2]),
      }),
    );
    console.log(
      await blender.saveBlendCopy({ path: path.resolve(process.argv[3]) }),
    );
    await blender.releaseArtifact(job.artifact.handle);
  } finally {
    await blender.disconnect();
  }
}

main().catch((error: unknown): void => {
  console.error(error);
  process.exitCode = 1;
});
```

`connect()` reads `BLENDIA_PORT` and `BLENDIA_TOKEN`; explicit options override them. Optional `timeoutMs` changes the default 30-second connection and per-response timeout. Each call must be awaited sequentially: another pending call fails with `BUSY`, and another client cannot steal an active bridge. New methods require their advertised capability and otherwise fail with `UNSUPPORTED`; baseline cube/read/transform calls remain available on older bridges.

`inspectScene({ limit, cursor })` returns a UID-ordered page, current scene/camera metadata, and an opaque `nextCursor`. The limit defaults to 50 and cannot exceed 100. Pages are fresh observations; GUI edits between pages can change their contents. Existing `createCube`, `getObject`, and `setTransform` remain available. Object/material handles survive renaming, but deletion, file loading, undo, and redo can invalidate them. Object snapshots contain local properties; transform updates use XYZ Euler radians. Finite coordinates and transform components are limited to absolute `1e20`.

Bulk meshes allow at most 8192 vertices, 8192 polygons, and 32768 corners, with distinct in-range indices within each face. Empty or points-only meshes are allowed. Encoded requests also have a 1 MiB limit. Invalid topology is rejected without silent repair; manifoldness is not promised. Material assignment replaces the whole mesh's DATA slot and polygon indices and rejects shared or linked mesh data. Material colors are scene-linear RGB in 0..1, alpha is fixed to one, and roughness/metallic are in 0..1.

New cameras and area lights are unparented and aimed at a distinct world target using local -Z tracking/+Y up. Camera lens is 1..500 mm, default 50; clipping defaults to 0.1/1000 with `1e-6 <= start < end <= 1e12`. Area lights default to white, 1000 W, and size 5; power is 0..1e12 and size is 1e-6..1e6. `setActive: true` persists the camera selection.

Native rendering currently requires Blender's GUI. It uses the current camera, frame, and engine, and persists the requested resolution and PNG 8-bit RGBA settings. The SDK accepts dimensions within an outer bound of 1..4096 each. Blender additionally checks its current native RNA limits before changing settings; values below its native minimum are rejected rather than silently clamped. Its temporary output path is restored after owned finalization; the saved .blend retains the camera and render settings. One render runs at a time. During it, only render status, artifact reads/releases, and disconnect are available. Native Esc can cancel rendering; programmatic cancellation is not provided. Stopping a TS process or disconnecting does not cancel the render.

Keep `renderId` before calling `startRender`. A lost response can be `OUTCOME_UNKNOWN` with `effects: "possible"`: reconnect explicitly to the same bridge and use `getRender` with that ID. Do not resend the start; duplicate IDs are rejected. A bridge session admits at most 4096 distinct render IDs to preserve duplicate rejection after terminal metadata expires; exhaustion fails before settings changes with `LIMIT_EXCEEDED` and requires a new bridge session. Native render/artifact handles are session-scoped, while metadata keeps the original `startGeneration`. Foreign render starts, file loads, undo, or uncertain path restoration can make capture `unknown` without an artifact.

`readArtifact({ artifact, offset, maxBytes })` returns canonical base64 with exact offsets, total bytes, and EOF; it reads at most 196608 raw bytes per call and never accepts a filesystem path. PNGs are limited to 32 MiB each, with four retained artifacts and 128 MiB total, expiring after 600 seconds or explicit release. Terminal render metadata is retained up to eight jobs for 600 seconds. An expired or released ID is unavailable. These bounds cover owned outputs; they do not bound Blender engine memory or arbitrary existing scene effects.

`saveArtifact` exports a PNG to a distinct user file. `saveBlendCopy` uses native copy/remap semantics, preserves the open working filepath, and does not pack external assets. Both require explicit absolute paths with their .png/.blend extension and existing parents. Publication uses no-replace by default or explicit atomic replacement; unsupported filesystems fail. Known native modified-external-image auto-save conflicts are rejected without changing global preferences. Native save handlers and other existing scene/addon outputs can still have effects. File IO is outside Blender undo and rollback; a timed-out sent save may already have published its destination.

Failures are `BlenderError` values with `code` and `effects`. The SDK never retries mutations or promises transaction rollback, arbitrary Python access, full Blender API parity, or headless rendering in this GUI slice. See the [Blendia overview](../../README.md) for the supported workflow.
