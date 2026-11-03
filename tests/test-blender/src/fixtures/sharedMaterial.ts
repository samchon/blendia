import {
  BlenderClient,
  BlenderError,
  type IBlenderMaterialSnapshot,
  type IBlenderObjectSnapshot,
  type IBlenderSceneSnapshot,
} from "@blendia/sdk";
import assert from "node:assert/strict";

/** Exercise native single-user admission against two real shared-mesh siblings. */
async function sharedMaterial(): Promise<void> {
  const destination: string | undefined = process.argv[2];
  assert.ok(destination);
  const client: BlenderClient = await BlenderClient.connect();
  try {
    const scene: IBlenderSceneSnapshot = await client.inspectScene({
      limit: 100,
    });
    assert.equal(scene.objectCount, 2);
    const replacement: IBlenderMaterialSnapshot = await client.createMaterial({
      name: "Unassigned Replacement",
      baseColorLinearRGB: [1, 0, 0],
    });
    for (const name of ["Shared A", "Shared B"]) {
      const object: IBlenderObjectSnapshot | undefined = scene.objects.find(
        (candidate: IBlenderObjectSnapshot): boolean => candidate.name === name,
      );
      assert.ok(object);
      await assert.rejects(
        client.assignMaterial({
          object: object.handle,
          material: replacement.handle,
        }),
        (error: unknown): boolean =>
          error instanceof BlenderError &&
          error.code === "INVALID_ARGUMENT" &&
          error.effects === "none",
      );
      assert.deepEqual(await client.getObject(object.handle), object);
    }
    await client.saveBlendCopy({ path: destination });
  } finally {
    await client.disconnect();
  }
}

sharedMaterial().catch((error: unknown): void => {
  console.error(error);
  process.exitCode = 1;
});
