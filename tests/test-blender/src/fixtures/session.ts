import {
  BlenderClient,
  BlenderError,
  type IBlenderCameraSnapshot,
  type IBlenderObjectSnapshot,
  type IBlenderSession,
} from "@blendia/sdk";
import assert from "node:assert/strict";
import fs from "node:fs";

/** Observe a real exclusive writer lease, stable UIDs and explicit active-camera selection. */
async function session(): Promise<void> {
  const destination: string | undefined = process.argv[2];
  const handlePath: string | undefined = process.argv[3];
  assert.ok(destination && handlePath);
  const first: BlenderClient = await BlenderClient.connect();
  let active: BlenderClient = first;
  try {
    await assert.rejects(
      BlenderClient.connect(),
      (error: unknown): boolean =>
        error instanceof BlenderError &&
        error.code === "BUSY" &&
        error.effects === "none",
    );
    await assert.rejects(
      BlenderClient.connect({ token: "explicit-invalid-test-credential" }),
      (error: unknown): boolean =>
        error instanceof BlenderError &&
        error.code === "UNAUTHORIZED" &&
        error.effects === "none",
    );
    const firstCube: IBlenderObjectSnapshot = await first.createCube({
      name: "Same Name",
    });
    const secondCube: IBlenderObjectSnapshot = await first.createCube({
      name: "Same Name",
    });
    assert.notEqual(firstCube.name, secondCube.name);
    assert.notEqual(firstCube.handle.objectId, secondCube.handle.objectId);
    await first.setTransform({ object: firstCube.handle, location: [1, 2, 3] });
    await first.setTransform({
      object: secondCube.handle,
      location: [-3, -2, -1],
    });
    const before: IBlenderSession = first.session;
    await first.disconnect();
    await assert.rejects(
      first.getObject(firstCube.handle),
      (error: unknown): boolean =>
        error instanceof BlenderError && error.code === "CONNECTION_CLOSED",
    );
    active = await BlenderClient.connect();
    assert.equal(active.session.sessionId, before.sessionId);
    assert.equal(active.session.generation, before.generation);
    assert.deepEqual(
      (await active.getObject(firstCube.handle)).location,
      [1, 2, 3],
    );
    assert.deepEqual(
      (await active.getObject(secondCube.handle)).location,
      [-3, -2, -1],
    );
    const inactive: IBlenderCameraSnapshot = await active.createCamera({
      name: "Initially Inactive",
      location: [5, -7, 5],
      target: [0, 0, 0],
      setActive: false,
    });
    assert.equal(inactive.isActive, false);
    assert.equal((await active.inspectScene()).activeCamera, null);
    const selected: IBlenderCameraSnapshot = await active.createCamera({
      name: "Selected Camera",
      location: [5, -7, 5],
      target: [0, 0, 0],
      setActive: true,
    });
    const later: IBlenderCameraSnapshot = await active.createCamera({
      name: "Later Inactive",
      location: [6, -7, 5],
      target: [0, 0, 0],
      setActive: false,
    });
    assert.equal(later.isActive, false);
    assert.deepEqual(
      (await active.inspectScene()).activeCamera,
      selected.handle,
    );
    await active.saveBlendCopy({ path: destination });
    fs.writeFileSync(handlePath, JSON.stringify(firstCube.handle), {
      flag: "wx",
    });
  } finally {
    await active.disconnect();
  }
}

session().catch((error: unknown): void => {
  console.error(error);
  process.exitCode = 1;
});
