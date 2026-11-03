import {
  BlenderClient,
  BlenderError,
  type BlenderRenderJob,
  type IBlenderArtifactChunk,
  type IBlenderObjectSnapshot,
} from "@blendia/sdk";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

/** Preserve conflicting destinations and independent backups until replacement is explicitly requested. */
async function outputPublication(): Promise<void> {
  const png: string | undefined = process.argv[2];
  const saved: string | undefined = process.argv[3];
  assert.ok(png && saved);
  fs.writeFileSync(png, "KEEP EXISTING PNG", { flag: "wx" });
  fs.writeFileSync(saved, "KEEP EXISTING BLEND", { flag: "wx" });
  fs.writeFileSync(`${saved}1`, "KEEP USER BACKUP", { flag: "wx" });
  const client: BlenderClient = await BlenderClient.connect({
    timeoutMs: 120000,
  });
  try {
    const cube: IBlenderObjectSnapshot = await client.createCube({
      name: "Published Cube",
    });
    await client.createCamera({
      location: [3, -4, 3],
      target: [0, 0, 0],
      setActive: true,
    });
    const render: BlenderRenderJob = await client.startRender({
      renderId: randomUUID(),
      width: 32,
      height: 32,
    });
    assert.equal(render.status, "succeeded");
    if (render.status !== "succeeded")
      throw new Error("Native publication render did not succeed.");
    const chunk: IBlenderArtifactChunk = await client.readArtifact({
      artifact: render.artifact.handle,
      offset: 0,
      maxBytes: 196608,
    });
    assert.equal(chunk.eof, true);
    const original: Buffer = Buffer.from(chunk.dataBase64, "base64");
    await assert.rejects(
      client.saveArtifact({ artifact: render.artifact.handle, path: png }),
      (error: unknown): boolean =>
        error instanceof BlenderError &&
        error.code === "FILE_EXISTS" &&
        error.effects === "none",
    );
    await assert.rejects(
      client.saveBlendCopy({ path: saved }),
      (error: unknown): boolean =>
        error instanceof BlenderError &&
        error.code === "FILE_EXISTS" &&
        error.effects === "none",
    );
    assert.equal(fs.readFileSync(png, "utf8"), "KEEP EXISTING PNG");
    assert.equal(fs.readFileSync(saved, "utf8"), "KEEP EXISTING BLEND");
    assert.equal(fs.readFileSync(`${saved}1`, "utf8"), "KEEP USER BACKUP");
    await client.saveArtifact({
      artifact: render.artifact.handle,
      path: png,
      overwrite: true,
    });
    assert.deepEqual(fs.readFileSync(png), original);
    fs.writeFileSync(png, "USER MODIFIED THEIR EXPORT");
    const afterEdit: IBlenderArtifactChunk = await client.readArtifact({
      artifact: render.artifact.handle,
      offset: 0,
      maxBytes: 196608,
    });
    assert.deepEqual(Buffer.from(afterEdit.dataBase64, "base64"), original);
    await client.saveArtifact({
      artifact: render.artifact.handle,
      path: png,
      overwrite: true,
    });
    await client.saveBlendCopy({ path: saved, overwrite: true });
    assert.notDeepEqual(
      fs.readFileSync(saved),
      Buffer.from("KEEP EXISTING BLEND"),
    );
    assert.equal(fs.readFileSync(`${saved}1`, "utf8"), "KEEP USER BACKUP");
    await client.setTransform({ object: cube.handle, location: [3, 2, 1] });
    await client.saveBlendCopy({ path: saved, overwrite: true });
    assert.equal(fs.readFileSync(`${saved}1`, "utf8"), "KEEP USER BACKUP");
    await client.releaseArtifact(render.artifact.handle);
    assert.deepEqual(fs.readFileSync(png), original);
  } finally {
    await client.disconnect();
  }
}

outputPublication().catch((error: unknown): void => {
  console.error(error);
  process.exitCode = 1;
});
