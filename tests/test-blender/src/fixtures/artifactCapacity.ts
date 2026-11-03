import {
  BlenderClient,
  BlenderError,
  type BlenderRenderJob,
  type IBlenderArtifact,
  type IBlenderArtifactChunk,
  type IBlenderRenderHandle,
} from "@blendia/sdk";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

/** Fill actual PNG retention, hand off the lease, and recover capacity only through explicit release. */
async function artifactCapacity(): Promise<void> {
  const destination: string | undefined = process.argv[2];
  assert.ok(destination);
  let client: BlenderClient = await BlenderClient.connect({
    timeoutMs: 120000,
  });
  const artifacts: IBlenderArtifact[] = [];
  try {
    await client.createCube();
    await client.createCamera({
      location: [3, -4, 3],
      target: [0, 0, 0],
      setActive: true,
    });
    for (let index: number = 0; index < 4; index++) {
      const render: BlenderRenderJob = await client.startRender({
        renderId: randomUUID(),
        width: 32,
        height: 32,
      });
      assert.equal(render.status, "succeeded");
      if (render.status !== "succeeded")
        throw new Error("Native capacity render did not succeed.");
      artifacts.push(render.artifact);
    }
    const nextId: string = randomUUID();
    const rejected: IBlenderRenderHandle = {
      sessionId: client.session.sessionId,
      renderId: nextId,
    };
    await assert.rejects(
      client.startRender({ renderId: nextId, width: 32, height: 32 }),
      (error: unknown): boolean =>
        error instanceof BlenderError &&
        error.code === "LIMIT_EXCEEDED" &&
        error.effects === "none",
    );
    await assert.rejects(
      client.getRender(rejected),
      (error: unknown): boolean =>
        error instanceof BlenderError && error.code === "NOT_FOUND",
    );
    const first: IBlenderArtifact = artifacts[0];
    await client.saveArtifact({ artifact: first.handle, path: destination });
    const exported: Buffer = fs.readFileSync(destination);
    const sessionId: string = client.session.sessionId;
    await client.disconnect();
    client = await BlenderClient.connect({ timeoutMs: 120000 });
    assert.equal(client.session.sessionId, sessionId);
    for (const artifact of artifacts) {
      const read: IBlenderArtifactChunk = await client.readArtifact({
        artifact: artifact.handle,
        offset: 0,
        maxBytes: 8,
      });
      assert.deepEqual(
        Buffer.from(read.dataBase64, "base64"),
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );
      assert.equal(read.totalBytes, artifact.bytes);
      const job: BlenderRenderJob = await client.getRender({
        sessionId,
        renderId: artifact.renderId,
      });
      assert.equal(job.status, "succeeded");
    }
    await client.releaseArtifact(first.handle);
    await assert.rejects(
      client.readArtifact({ artifact: first.handle, offset: 0, maxBytes: 8 }),
      (error: unknown): boolean =>
        error instanceof BlenderError && error.code === "NOT_FOUND",
    );
    const admitted: BlenderRenderJob = await client.startRender({
      renderId: nextId,
      width: 32,
      height: 32,
    });
    assert.equal(admitted.status, "succeeded");
    if (admitted.status !== "succeeded")
      throw new Error("Released capacity was not reusable.");
    assert.equal(admitted.handle.renderId, nextId);
    for (const artifact of artifacts.slice(1))
      await client.releaseArtifact(artifact.handle);
    await client.releaseArtifact(admitted.artifact.handle);
    assert.deepEqual(fs.readFileSync(destination), exported);
  } finally {
    await client.disconnect();
  }
}

artifactCapacity().catch((error: unknown): void => {
  console.error(error);
  process.exitCode = 1;
});
