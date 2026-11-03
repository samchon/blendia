import {
  BlenderClient,
  type IBlenderObjectSnapshot,
  type IBlenderSceneSnapshot,
} from "@blendia/sdk";
import assert from "node:assert/strict";

/** Read a fresh saved scene, leave an observable ordinary mutation, and fail only the script. */
async function reopen(): Promise<void> {
  const client: BlenderClient = await BlenderClient.connect();
  try {
    const scene: IBlenderSceneSnapshot = await client.inspectScene({
      limit: 100,
    });
    assert.equal(scene.objectCount, 4);
    assert.deepEqual(
      new Set(
        scene.objects.map(
          (object: IBlenderObjectSnapshot): string => object.name,
        ),
      ),
      new Set([
        "Blendia Camera",
        "Blendia Ground",
        "Blendia Pyramid 한글",
        "Blendia Softbox",
      ]),
    );
    const camera: IBlenderObjectSnapshot | undefined = scene.objects.find(
      (object: IBlenderObjectSnapshot): boolean =>
        object.name === "Blendia Camera",
    );
    assert.ok(camera);
    assert.deepEqual(scene.activeCamera, camera.handle);
    assert.deepEqual(camera.location, [5, -7, 5]);
    console.log("BLENDIA_REOPENED_SCENE_OK");
    const partial: IBlenderObjectSnapshot = await client.createCube({
      name: "Blendia Unsaved Partial Cube",
    });
    const readback: IBlenderObjectSnapshot = await client.getObject(
      partial.handle,
    );
    assert.equal(readback.name, "Blendia Unsaved Partial Cube");
    assert.equal((await client.inspectScene()).objectCount, 5);
    console.log("BLENDIA_PARTIAL_MUTATION_OK");
  } finally {
    await client.disconnect();
  }
  throw new Error("BLENDIA_EXPECTED_APPLICATION_ERROR");
}

reopen().catch((error: unknown): void => {
  console.error(error);
  process.exitCode = 1;
});
