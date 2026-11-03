import {
  BlenderClient,
  BlenderError,
  type IBlenderArtifact,
  type IBlenderArtifactChunk,
} from "@blendia/sdk";
import assert from "node:assert/strict";
import fs from "node:fs";

/** Check actual owned PNG bytes, explicit filesystem publication and artifact release. */
export async function verifyArtifact(
  client: BlenderClient,
  artifact: IBlenderArtifact,
  png: string,
): Promise<void> {
  assert.equal(artifact.mimeType, "image/png");
  assert.equal(artifact.width, 128);
  assert.equal(artifact.height, 128);
  const chunks: Buffer[] = [];
  let offset: number = 0;
  while (offset < artifact.bytes) {
    const chunk: IBlenderArtifactChunk = await client.readArtifact({
      artifact: artifact.handle,
      offset,
      maxBytes: 4096,
    });
    const bytes: Buffer = Buffer.from(chunk.dataBase64, "base64");
    assert.equal(chunk.offset, offset);
    assert.equal(chunk.nextOffset, offset + bytes.length);
    assert.equal(chunk.totalBytes, artifact.bytes);
    assert.equal(chunk.eof, chunk.nextOffset === artifact.bytes);
    assert.ok(bytes.length > 0 && bytes.length <= 4096);
    chunks.push(bytes);
    offset = chunk.nextOffset;
  }
  const streamed: Buffer = Buffer.concat(chunks);
  assert.equal(streamed.length, artifact.bytes);
  assert.deepEqual(
    streamed.subarray(0, 8),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  assert.equal(streamed.toString("ascii", 12, 16), "IHDR");
  assert.equal(streamed.readUInt32BE(16), 128);
  assert.equal(streamed.readUInt32BE(20), 128);
  await client.saveArtifact({ artifact: artifact.handle, path: png });
  assert.deepEqual(fs.readFileSync(png), streamed);
  await assert.rejects(
    client.saveArtifact({ artifact: artifact.handle, path: png }),
    (error: unknown): boolean =>
      error instanceof BlenderError && error.code === "FILE_EXISTS",
  );
  assert.deepEqual(fs.readFileSync(png), streamed);
  await client.saveArtifact({
    artifact: artifact.handle,
    path: png,
    overwrite: true,
  });
  assert.deepEqual(fs.readFileSync(png), streamed);
  await client.releaseArtifact(artifact.handle);
  await assert.rejects(
    client.readArtifact({ artifact: artifact.handle, offset: 0, maxBytes: 16 }),
    (error: unknown): boolean =>
      error instanceof BlenderError && error.code === "NOT_FOUND",
  );
  assert.deepEqual(fs.readFileSync(png), streamed);
}
