import {
  BlenderClient,
  BlenderError,
  type BlenderRenderJob,
  type IBlenderAreaLightSnapshot,
  type IBlenderCameraSnapshot,
  type IBlenderMaterialSnapshot,
  type IBlenderMeshSnapshot,
  type IBlenderObjectSnapshot,
  type IBlenderSceneSnapshot,
} from "@blendia/sdk";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { verifyArtifact } from "./verifyArtifact";

/** Author one small reproducible scene through the public SDK and publish its native outputs. */
async function scene(): Promise<void> {
  const png: string | undefined = process.argv[2];
  const blend: string | undefined = process.argv[3];
  assert.ok(png && path.isAbsolute(png), "Supply an absolute PNG destination.");
  assert.ok(
    blend && path.isAbsolute(blend),
    "Supply an absolute .blend destination.",
  );
  const client: BlenderClient = await BlenderClient.connect({
    timeoutMs: 120000,
  });
  try {
    const initial: IBlenderSceneSnapshot = await client.inspectScene({
      limit: 100,
    });
    assert.equal(
      initial.objectCount,
      0,
      "CPU seed must start with an empty scene.",
    );
    const pyramid: IBlenderMeshSnapshot = await client.createMesh({
      name: "Blendia Pyramid 한글",
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
    assert.equal(pyramid.vertexCount, 5);
    assert.equal(pyramid.polygonCount, 5);
    const material: IBlenderMaterialSnapshot = await client.createMaterial({
      name: "Blendia Blue",
      baseColorLinearRGB: [0.08, 0.3, 0.8],
      roughness: 0.35,
      metallic: 0.1,
    });
    const assigned: IBlenderObjectSnapshot = await client.assignMaterial({
      object: pyramid.handle,
      material: material.handle,
    });
    assert.deepEqual(assigned.handle, pyramid.handle);
    const floor: IBlenderMeshSnapshot = await client.createMesh({
      name: "Blendia Ground",
      vertices: [
        [-4, -4, -0.03],
        [4, -4, -0.03],
        [4, 4, -0.03],
        [-4, 4, -0.03],
      ],
      faces: [[0, 1, 2, 3]],
    });
    const matte: IBlenderMaterialSnapshot = await client.createMaterial({
      name: "Blendia Ground Matte",
      baseColorLinearRGB: [0.5, 0.5, 0.5],
      roughness: 0.8,
    });
    await client.assignMaterial({
      object: floor.handle,
      material: matte.handle,
    });
    const camera: IBlenderCameraSnapshot = await client.createCamera({
      name: "Blendia Camera",
      location: [5, -7, 5],
      target: [0, 0, 0.9],
      lensMm: 50,
      setActive: true,
    });
    assert.equal(camera.isActive, true);
    const light: IBlenderAreaLightSnapshot = await client.createAreaLight({
      name: "Blendia Softbox",
      location: [2, -3, 6],
      target: [0, 0, 0.9],
      powerWatts: 1000,
      size: 5,
    });
    assert.equal(light.powerWatts, 1000);
    const observed: IBlenderSceneSnapshot = await client.inspectScene({
      limit: 2,
    });
    assert.equal(observed.objectCount, 4);
    assert.equal(observed.objects.length, 2);
    const cursor: string | null = observed.nextCursor;
    assert.ok(cursor !== null);
    const last: IBlenderSceneSnapshot = await client.inspectScene({
      limit: 2,
      cursor,
    });
    assert.equal(last.objects.length, 2);
    assert.equal(last.nextCursor, null);
    assert.equal(
      new Set(
        [...observed.objects, ...last.objects].map(
          (object: IBlenderObjectSnapshot): string => object.handle.objectId,
        ),
      ).size,
      4,
    );
    assert.deepEqual(observed.activeCamera, camera.handle);

    const render: BlenderRenderJob = await client.startRender({
      renderId: randomUUID(),
      width: 128,
      height: 128,
    });
    assert.equal(
      render.status,
      "succeeded",
      "Owned headless start must observe native render completion.",
    );
    if (render.status !== "succeeded")
      throw new Error("Native render did not succeed.");
    await verifyArtifact(client, render.artifact, png);
    await client.saveBlendCopy({ path: blend });
    const saved: Buffer = fs.readFileSync(blend);
    assert.ok(saved.length > 12);
    await assert.rejects(
      client.saveBlendCopy({ path: blend }),
      (error: unknown): boolean =>
        error instanceof BlenderError && error.code === "FILE_EXISTS",
    );
    assert.deepEqual(fs.readFileSync(blend), saved);
    console.log("BLENDIA_AUTHORED_SCENE_OK");
  } finally {
    await client.disconnect();
  }
}

scene().catch((error: unknown): void => {
  console.error(error);
  process.exitCode = 1;
});
