import {
  BlenderClient,
  BlenderError,
  type BlenderRenderJob,
  type IBlenderArtifactChunk,
  type IBlenderRenderHandle,
} from "@blendia/sdk";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

/** Exercise actual no-camera refusal, accepted-ID uniqueness and retained job lookup. */
async function renderAdmission(): Promise<void> {
  const destination: string | undefined = process.argv[2];
  assert.ok(destination);
  const client: BlenderClient = await BlenderClient.connect({
    timeoutMs: 120000,
  });
  try {
    const renderId: string = randomUUID();
    const handle: IBlenderRenderHandle = {
      sessionId: client.session.sessionId,
      renderId,
    };
    assert.equal((await client.inspectScene()).activeCamera, null);
    await assert.rejects(
      client.startRender({ renderId, width: 32, height: 32 }),
      (error: unknown): boolean =>
        error instanceof BlenderError &&
        error.code === "INVALID_CONTEXT" &&
        error.effects === "none",
    );
    await assert.rejects(
      client.getRender(handle),
      (error: unknown): boolean =>
        error instanceof BlenderError && error.code === "NOT_FOUND",
    );
    await client.createCamera({
      location: [3, -4, 3],
      target: [0, 0, 0],
      setActive: true,
    });
    const result: BlenderRenderJob = await client.startRender({
      renderId,
      width: 32,
      height: 32,
    });
    assert.equal(result.status, "succeeded");
    if (result.status !== "succeeded")
      throw new Error("Native admission render did not succeed.");
    await assert.rejects(
      client.startRender({ renderId, width: 32, height: 32 }),
      (error: unknown): boolean =>
        error instanceof BlenderError &&
        error.code === "DUPLICATE_ID" &&
        error.effects === "none",
    );
    assert.deepEqual(await client.getRender(handle), result);
    const header: IBlenderArtifactChunk = await client.readArtifact({
      artifact: result.artifact.handle,
      offset: 0,
      maxBytes: 24,
    });
    const bytes: Buffer = Buffer.from(header.dataBase64, "base64");
    assert.deepEqual(
      bytes.subarray(0, 8),
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    assert.equal(bytes.readUInt32BE(16), 32);
    assert.equal(bytes.readUInt32BE(20), 32);
    await client.saveArtifact({
      artifact: result.artifact.handle,
      path: destination,
    });
    await client.releaseArtifact(result.artifact.handle);
  } finally {
    await client.disconnect();
  }
}

renderAdmission().catch((error: unknown): void => {
  console.error(error);
  process.exitCode = 1;
});
