import assert from "node:assert/strict";

import type { IBlendiaMcpImageResult } from "../../../../packages/mcp/src/IBlendiaMcpImageResult";
import type { IBlendiaMcpSuccess } from "../../../../packages/mcp/src/IBlendiaMcpSuccess";
import { addMcpNativeImage } from "../../../../packages/mcp/src/addMcpNativeImage";

/**
 * Add bounded native image content only to the dedicated successful image result without rewriting its data.
 *
 * Scenarios:
 * 1. A successful image keeps the original content, result identity, and canonical base64 while adding one image block.
 * 2. Ordinary results, failed envelopes, and non-result messages remain unchanged.
 * 3. Mismatched byte counts, noncanonical encodings, and payloads over the raw-byte cap are not promoted.
 * 4. The exact one-MiB boundary succeeds without changing the declared structured result.
 *
 * @evidence contracts/testing.md#behavioral-verification Invoke the real outbound conversion consumed by Transport.send and observe native-content addition, source-envelope preservation, pass-through decisions, and byte refusals without constructing a transport or server.
 * @evidence contracts/testing.md#independent-expectations Literal one/two/three-byte base64 and the declared one-MiB raw image cap determine admission independently of the conversion's checks; these byte fixtures exercise presentation policy rather than PNG decoding or upstream validation.
 * @evidence contracts/testing.md#distinguishing-cases Cover dedicated success versus ordinary/failed messages, existing and absent content, detached content arrays, canonical and noncanonical bytes, metadata mismatch, and exact/exceeded size bounds; real image acquisition, URI ownership, host rendering, and registration are separate actual consumers.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this named first-party policy unit through the actual converter; there is no MCP E2E harness, fake handler, transport, socket, SDK client, installation check, or typia/schema test.
 */
export function test_native_image_policy(): void {
  const image: IBlendiaMcpImageResult = {
    kind: "image",
    mimeType: "image/png",
    dataBase64: "AQID",
    artifact: {
      handle: { sessionId: "bridge", artifactId: "owned-png" },
      renderId: "12345678-1234-4234-8234-123456789abc",
      startGeneration: 2,
      mimeType: "image/png",
      bytes: 3,
      width: 1,
      height: 1,
      expiresAt: "2026-11-04T00:10:00.000Z",
    },
  };
  const envelope: IBlendiaMcpSuccess<IBlendiaMcpImageResult> = {
    ok: true,
    result: image,
  };
  const message: Parameters<typeof addMcpNativeImage>[0] = Object.freeze({
    jsonrpc: "2.0",
    id: 17,
    result: Object.freeze({
      content: Object.freeze([{ type: "text", text: "keep this result" }]),
      structuredContent: envelope,
      _meta: { observation: "keep metadata" },
    }),
  });
  const promoted: ReturnType<typeof addMcpNativeImage> =
    addMcpNativeImage(message);
  assert.ok("result" in promoted && "result" in message);
  assert.equal(promoted.id, 17);
  assert.equal(promoted.result.structuredContent, envelope);
  assert.equal(envelope.result.dataBase64, "AQID");
  assert.deepEqual(promoted.result._meta, { observation: "keep metadata" });
  assert.deepEqual(promoted.result.content, [
    { type: "text", text: "keep this result" },
    { type: "image", data: "AQID", mimeType: "image/png" },
  ]);
  assert.deepEqual(message.result.content, [
    { type: "text", text: "keep this result" },
  ]);
  assert.notEqual(promoted.result.content, message.result.content);
  for (const [dataBase64, bytes] of [
    ["AQ==", 1],
    ["AQI=", 2],
  ] as const) {
    const candidate: Parameters<typeof addMcpNativeImage>[0] = {
      jsonrpc: "2.0",
      id: "small",
      result: {
        structuredContent: {
          ok: true,
          result: {
            ...image,
            dataBase64,
            artifact: { ...image.artifact, bytes },
          },
        },
      },
    };
    const output: ReturnType<typeof addMcpNativeImage> =
      addMcpNativeImage(candidate);
    assert.ok("result" in output);
    assert.deepEqual(output.result.content, [
      { type: "image", data: dataBase64, mimeType: "image/png" },
    ]);
  }

  const ordinary: readonly Parameters<typeof addMcpNativeImage>[0][] = [
    { jsonrpc: "2.0", id: "request", method: "tools/list" },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 1, error: { code: -32603, message: "failure" } },
    {
      jsonrpc: "2.0",
      id: 1,
      result: { isError: true, structuredContent: envelope },
    },
    {
      jsonrpc: "2.0",
      id: 1,
      result: { content: [{ type: "text", text: "ordinary" }] },
    },
    {
      jsonrpc: "2.0",
      id: 1,
      result: {
        structuredContent: {
          ok: false,
          error: { code: "BUSY", message: "No image acquired." },
        },
      },
    },
    {
      jsonrpc: "2.0",
      id: 1,
      result: {
        structuredContent: {
          ok: true,
          result: { kind: "render", status: "running" },
        },
      },
    },
  ];
  for (const input of ordinary)
    assert.deepEqual(addMcpNativeImage(input), input);

  const oversizedData: string = Buffer.alloc(1048577).toString("base64");
  const invalidImages: readonly unknown[] = [
    { ...image, kind: "render" },
    { ...image, mimeType: "image/jpeg" },
    { ...image, artifact: { ...image.artifact, bytes: 2 } },
    { ...image, dataBase64: "AQID\n" },
    { ...image, dataBase64: "AR==", artifact: { ...image.artifact, bytes: 1 } },
    { ...image, dataBase64: "-_8=", artifact: { ...image.artifact, bytes: 2 } },
    {
      ...image,
      dataBase64: oversizedData,
      artifact: { ...image.artifact, bytes: 1048577 },
    },
    {
      ...image,
      dataBase64: oversizedData,
      artifact: { ...image.artifact, bytes: 1048576 },
    },
  ];
  for (const invalid of invalidImages) {
    const candidate: Parameters<typeof addMcpNativeImage>[0] = {
      jsonrpc: "2.0",
      id: "refused",
      result: { structuredContent: { ok: true, result: invalid } },
    };
    assert.deepEqual(addMcpNativeImage(candidate), candidate);
  }
  const maximum: IBlendiaMcpImageResult = {
    ...image,
    dataBase64: Buffer.alloc(1048576).toString("base64"),
    artifact: { ...image.artifact, bytes: 1048576 },
  };
  const boundary: Parameters<typeof addMcpNativeImage>[0] = {
    jsonrpc: "2.0",
    id: "boundary",
    result: { structuredContent: { ok: true, result: maximum } },
  };
  const accepted: ReturnType<typeof addMcpNativeImage> =
    addMcpNativeImage(boundary);
  assert.ok("result" in accepted && "result" in boundary);
  assert.equal(
    accepted.result.structuredContent,
    boundary.result.structuredContent,
  );
  assert.deepEqual(accepted.result.content, [
    { type: "image", data: maximum.dataBase64, mimeType: "image/png" },
  ]);
}
