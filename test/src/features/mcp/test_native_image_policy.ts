import assert from "node:assert/strict";

import { BlendiaMcpImageDelivery } from "../../../../packages/mcp/src/BlendiaMcpImageDelivery";
import type { IBlendiaMcpImagePayload } from "../../../../packages/mcp/src/IBlendiaMcpImagePayload";
import type { IBlendiaMcpImageResult } from "../../../../packages/mcp/src/IBlendiaMcpImageResult";
import type { IBlendiaMcpSuccess } from "../../../../packages/mcp/src/IBlendiaMcpSuccess";
import { addMcpNativeImage } from "../../../../packages/mcp/src/addMcpNativeImage";

/**
 * Deliver private bounded image bytes once to their original metadata response.
 *
 * Scenarios:
 * 1. Public JSON contains metadata only while one native block receives the private bytes.
 * 2. Wrong response identities and altered metadata cannot consume a pending delivery.
 * 3. Errors, malformed envelopes, and replayed tickets add no native content.
 * 4. Canonical byte admission, exact caps, capacity refusal, and explicit cleanup preserve ownership.
 *
 * @evidence contracts/testing.md#behavioral-verification Invoke the actual private delivery owner and outbound converter consumed by the controller and Transport.send; observe metadata-only output, correlated one-time consumption, refusal without eviction, and explicit release without constructing a server or transport.
 * @evidence contracts/testing.md#independent-expectations Literal one/two/three-byte base64, the declared one-MiB raw cap and four-delivery capacity determine admission independently; exact response identity and unchanged artifact fields determine delivery ownership, not a snapshot or generated schema.
 * @evidence contracts/testing.md#distinguishing-cases Cover matching versus altered metadata and numeric/string request IDs, success/error/malformed messages, one-time replay, canonical and noncanonical encodings, exact/exceeded caps, full capacity, artifact/session cleanup, and closed admission; PNG decoding, expiry timing, host presentation, and registration remain outside this unit.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this named first-party payload-policy unit; it consumes production functions directly without fake handlers, SDK clients, transports, sockets, filesystem fixtures, typia tests, schema reflection, or an MCP E2E harness.
 */
export function test_native_image_policy(): void {
  const delivery: BlendiaMcpImageDelivery = new BlendiaMcpImageDelivery();
  const payload: IBlendiaMcpImagePayload = {
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
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    },
  };

  try {
    assert.throws(
      (): IBlendiaMcpImageResult => delivery.stage(payload),
      /No active image delivery request/,
    );
    const staged: IBlendiaMcpImageResult[] = [];
    delivery.runRequest(17, (): void => {
      staged.push(delivery.stage(payload));
    });
    const metadata: IBlendiaMcpImageResult | undefined = staged[0];
    assert.ok(metadata);
    const envelope: IBlendiaMcpSuccess<IBlendiaMcpImageResult> = {
      ok: true,
      result: metadata,
      error: null,
    };
    const publicJson: string = JSON.stringify(envelope);
    assert.equal("dataBase64" in metadata, false);
    assert.equal(publicJson.includes("dataBase64"), false);
    assert.equal(publicJson.includes("AQID"), false);
    assert.notEqual(metadata.artifact, payload.artifact);
    assert.notEqual(metadata.artifact.handle, payload.artifact.handle);

    const message: Parameters<typeof addMcpNativeImage>[0] = Object.freeze({
      jsonrpc: "2.0",
      id: 17,
      result: Object.freeze({
        content: Object.freeze([{ type: "text", text: publicJson }]),
        structuredContent: envelope,
        _meta: { observation: "keep metadata" },
      }),
    });
    const wrongResponse: Parameters<typeof addMcpNativeImage>[0] = {
      ...message,
      id: "17",
    };
    assert.equal(addMcpNativeImage(wrongResponse, delivery), wrongResponse);
    const altered: readonly unknown[] = [
      { ...metadata, kind: "render" },
      { ...metadata, mimeType: "image/jpeg" },
      { ...metadata, deliveryId: "unknown-ticket" },
      { ...metadata, artifact: { ...metadata.artifact, bytes: 2 } },
      { ...metadata, artifact: { ...metadata.artifact, width: 2 } },
      {
        ...metadata,
        artifact: {
          ...metadata.artifact,
          handle: { ...metadata.artifact.handle, sessionId: "another-bridge" },
        },
      },
    ];
    for (const candidate of altered) {
      const refused: Parameters<typeof addMcpNativeImage>[0] = {
        jsonrpc: "2.0",
        id: 17,
        result: {
          structuredContent: { ok: true, result: candidate, error: null },
        },
      };
      assert.equal(addMcpNativeImage(refused, delivery), refused);
    }

    const ordinary: readonly Parameters<typeof addMcpNativeImage>[0][] = [
      {
        jsonrpc: "2.0",
        id: 17,
        result: { isError: true, structuredContent: envelope },
      },
      {
        jsonrpc: "2.0",
        id: 17,
        result: { content: [{ type: "text", text: "ordinary" }] },
      },
      { jsonrpc: "2.0", id: 17, result: { structuredContent: null } },
      {
        jsonrpc: "2.0",
        id: 17,
        result: { structuredContent: { ok: true, result: null, error: null } },
      },
      {
        jsonrpc: "2.0",
        id: 17,
        result: {
          structuredContent: {
            ok: false,
            result: null,
            error: { code: "BUSY", message: "No image acquired." },
          },
        },
      },
    ];
    for (const input of ordinary)
      assert.equal(addMcpNativeImage(input, delivery), input);

    const promoted: ReturnType<typeof addMcpNativeImage> = addMcpNativeImage(
      message,
      delivery,
    );
    assert.ok("result" in promoted && "result" in message);
    assert.equal(promoted.id, 17);
    assert.equal(promoted.result.structuredContent, envelope);
    assert.equal(JSON.stringify(envelope), publicJson);
    assert.deepEqual(promoted.result._meta, { observation: "keep metadata" });
    assert.deepEqual(promoted.result.content, [
      { type: "text", text: publicJson },
      { type: "image", data: "AQID", mimeType: "image/png" },
    ]);
    assert.deepEqual(message.result.content, [
      { type: "text", text: publicJson },
    ]);
    assert.notEqual(promoted.result.content, message.result.content);
    assert.equal(addMcpNativeImage(message, delivery), message);
    assert.equal(addMcpNativeImage(promoted, delivery), promoted);
    assert.equal(delivery.take(metadata.deliveryId, metadata, 17), undefined);

    const oversized: string = Buffer.alloc(1048577).toString("base64");
    const invalid: readonly IBlendiaMcpImagePayload[] = [
      { ...payload, dataBase64: "AQID\n" },
      { ...payload, artifact: { ...payload.artifact, bytes: 2 } },
      {
        ...payload,
        dataBase64: "AR==",
        artifact: { ...payload.artifact, bytes: 1 },
      },
      {
        ...payload,
        dataBase64: "-_8=",
        artifact: { ...payload.artifact, bytes: 2 },
      },
      {
        ...payload,
        dataBase64: "",
        artifact: { ...payload.artifact, bytes: 0 },
      },
      {
        ...payload,
        dataBase64: oversized,
        artifact: { ...payload.artifact, bytes: 1048577 },
      },
      {
        ...payload,
        dataBase64: oversized,
        artifact: { ...payload.artifact, bytes: 1048576 },
      },
      {
        ...payload,
        artifact: {
          ...payload.artifact,
          expiresAt: "2000-01-01T00:00:00.000Z",
        },
      },
    ];
    delivery.runRequest("bounds", (): void => {
      for (const candidate of invalid)
        assert.throws(
          (): IBlendiaMcpImageResult => delivery.stage(candidate),
          /Image admission bounds failed|Image encoding is not canonical/,
        );

      for (const [dataBase64, bytes] of [
        ["AQ==", 1],
        ["AQI=", 2],
      ] as const) {
        const small: IBlendiaMcpImageResult = delivery.stage({
          ...payload,
          dataBase64,
          artifact: { ...payload.artifact, bytes },
        });
        assert.deepEqual(delivery.take(small.deliveryId, small, "bounds"), {
          type: "image",
          data: dataBase64,
          mimeType: "image/png",
        });
      }

      const maximum: IBlendiaMcpImagePayload = {
        ...payload,
        dataBase64: Buffer.alloc(1048576).toString("base64"),
        artifact: { ...payload.artifact, bytes: 1048576 },
      };
      const pending: IBlendiaMcpImageResult[] = [];
      for (let index: number = 0; index < 4; index++)
        pending.push(delivery.stage(maximum));
      assert.throws(
        (): IBlendiaMcpImageResult => delivery.stage(payload),
        /Pending image delivery capacity is full/,
      );
      for (const record of pending) {
        const block: ReturnType<BlendiaMcpImageDelivery["take"]> =
          delivery.take(record.deliveryId, record, "bounds");
        assert.ok(block);
        assert.equal(block.data, maximum.dataBase64);
        assert.equal(
          delivery.take(record.deliveryId, record, "bounds"),
          undefined,
        );
      }

      const forgotten: IBlendiaMcpImageResult = delivery.stage(payload);
      delivery.forget(payload.artifact.handle);
      assert.equal(
        delivery.take(forgotten.deliveryId, forgotten, "bounds"),
        undefined,
      );
      const replaced: IBlendiaMcpImageResult = delivery.stage(payload);
      delivery.retainSession("different-session");
      assert.equal(
        delivery.take(replaced.deliveryId, replaced, "bounds"),
        undefined,
      );
      const closed: IBlendiaMcpImageResult = delivery.stage(payload);
      delivery.close();
      assert.equal(
        delivery.take(closed.deliveryId, closed, "bounds"),
        undefined,
      );
      assert.throws(
        (): IBlendiaMcpImageResult => delivery.stage(payload),
        /No active image delivery request/,
      );
    });
  } finally {
    delivery.close();
  }
}
