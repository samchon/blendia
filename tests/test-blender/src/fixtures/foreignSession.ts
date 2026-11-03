import {
  BlenderClient,
  BlenderError,
  type IBlenderObjectHandle,
  type IBlenderObjectSnapshot,
  type IBlenderSceneSnapshot,
} from "@blendia/sdk";
import assert from "node:assert/strict";
import fs from "node:fs";

/** Refuse the prior real session's public handle while preserving its saved scene in the new native lifetime. */
async function foreignSession(): Promise<void> {
  const handlePath: string | undefined = process.argv[2];
  assert.ok(handlePath);
  const old: IBlenderObjectHandle = JSON.parse(
    fs.readFileSync(handlePath, "utf8"),
  ) as IBlenderObjectHandle;
  const client: BlenderClient = await BlenderClient.connect();
  try {
    assert.notEqual(client.session.sessionId, old.sessionId);
    await assert.rejects(
      client.getObject(old),
      (error: unknown): boolean =>
        error instanceof BlenderError &&
        error.code === "STALE_HANDLE" &&
        error.effects === "none",
    );
    const scene: IBlenderSceneSnapshot = await client.inspectScene({
      limit: 100,
    });
    assert.equal(scene.objectCount, 5);
    const cube: IBlenderObjectSnapshot | undefined = scene.objects.find(
      (object: IBlenderObjectSnapshot): boolean => object.name === "Same Name",
    );
    assert.ok(cube);
    assert.deepEqual(cube.location, [1, 2, 3]);
    const selected: IBlenderObjectSnapshot | undefined = scene.objects.find(
      (object: IBlenderObjectSnapshot): boolean =>
        object.name === "Selected Camera",
    );
    assert.ok(selected);
    assert.deepEqual(scene.activeCamera, selected.handle);
  } finally {
    await client.disconnect();
  }
}

foreignSession().catch((error: unknown): void => {
  console.error(error);
  process.exitCode = 1;
});
