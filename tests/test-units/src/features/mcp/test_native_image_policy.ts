import assert from "node:assert/strict";

import { BlendiaMcpImageDelivery } from "../../../../../packages/mcp/src/BlendiaMcpImageDelivery";
import type { IBlendiaMcpFailure } from "../../../../../packages/mcp/src/IBlendiaMcpFailure";
import type { IBlendiaMcpImagePayload } from "../../../../../packages/mcp/src/IBlendiaMcpImagePayload";
import type { IBlendiaMcpImageResult } from "../../../../../packages/mcp/src/IBlendiaMcpImageResult";
import type { IBlendiaMcpSuccess } from "../../../../../packages/mcp/src/IBlendiaMcpSuccess";
import { addMcpNativeImage } from "../../../../../packages/mcp/src/addMcpNativeImage";

/**
 * Deliver private bounded image bytes once to their original metadata response.
 *
 * Scenarios:
 * 1. Public JSON contains metadata only while one native block receives the private bytes.
 * 2. Wrong response identities and altered metadata cannot consume a pending delivery.
 * 3. Errors and malformed envelopes remain unchanged; replayed image tickets report unavailable delivery.
 * 4. Canonical byte admission, exact caps, capacity refusal, and explicit cleanup preserve ownership.
 * 5. Artifact release, session replacement, and close report failure instead of successful metadata without an image.
 *
 * @evidence contracts/testing.md#behavioral-verification Invoke the actual private delivery owner and outbound converter consumed by the controller and Transport.send; observe metadata-only output, correlated one-time consumption, refusal without eviction, and explicit unavailable failures after release, replacement, close, and replay without constructing a server or transport.
 * @evidence contracts/testing.md#independent-expectations Literal one/two/three-byte base64, the declared one-MiB raw cap and four-delivery capacity determine admission independently; exact response identity and unchanged artifact fields determine delivery ownership. A successful image result requires native bytes, while unavailable delivery must publish a typed failure with no private bytes or partial successful metadata.
 * @evidence contracts/testing.md#distinguishing-cases Cover matching versus altered metadata and numeric/string request IDs, unchanged nonimage/error/malformed messages, one-time replay, canonical and noncanonical encodings, exact/exceeded caps, full capacity, artifact/session cleanup, closed admission, failure correlation and input immutability; PNG decoding, expiry timing, host presentation, and registration remain outside this unit.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this named first-party payload-policy unit; it consumes production functions directly without fake handlers, SDK clients, transports, sockets, filesystem fixtures, typia tests, schema reflection, or an MCP E2E harness.
 */
export function test_native_image_policy(): void {
  const delivery: BlendiaMcpImageDelivery = new BlendiaMcpImageDelivery();
  const failure: IBlendiaMcpFailure = {
    ok: false,
    result: null,
    error: {
      code: "IMAGE_DELIVERY_UNAVAILABLE",
      message: "Native image delivery is unavailable.",
      effects: "none",
    },
  };
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
    const refusedMessages: Parameters<typeof addMcpNativeImage>[0][] = [
      wrongResponse,
    ];
    const altered: readonly unknown[] = [
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
      refusedMessages.push(refused);
    }
    for (const input of refusedMessages) {
      const before: string = JSON.stringify(input);
      const refused: ReturnType<typeof addMcpNativeImage> = addMcpNativeImage(
        input,
        delivery,
      );
      assert.ok("result" in refused && "result" in input);
      assert.equal(refused.id, input.id);
      assert.equal(refused.result.isError, true);
      assert.deepEqual(refused.result.structuredContent, failure);
      assert.deepEqual(refused.result.content, [
        { type: "text", text: failure.error.message },
      ]);
      assert.deepEqual(refused.result._meta, input.result._meta);
      assert.equal(JSON.stringify(refused).includes(payload.dataBase64), false);
      assert.equal(JSON.stringify(input), before);
    }

    const ordinary: readonly Parameters<typeof addMcpNativeImage>[0][] = [
      {
        jsonrpc: "2.0",
        id: 17,
        result: {
          structuredContent: {
            ok: true,
            result: { ...metadata, kind: "render" },
            error: null,
          },
        },
      },
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
    for (const replay of [message, promoted]) {
      const before: string = JSON.stringify(replay);
      const refused: ReturnType<typeof addMcpNativeImage> = addMcpNativeImage(
        replay,
        delivery,
      );
      assert.ok("result" in refused);
      assert.equal(refused.id, 17);
      assert.equal(refused.result.isError, true);
      assert.deepEqual(refused.result.structuredContent, failure);
      assert.deepEqual(refused.result.content, [
        { type: "text", text: failure.error.message },
      ]);
      assert.deepEqual(refused.result._meta, { observation: "keep metadata" });
      assert.equal(JSON.stringify(refused).includes(payload.dataBase64), false);
      assert.equal(JSON.stringify(replay), before);
    }
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

      for (const action of ["forget", "replace", "close"] as const) {
        const retired: IBlendiaMcpImageResult = delivery.stage(payload);
        if (action === "forget") delivery.forget(payload.artifact.handle);
        else if (action === "replace")
          delivery.retainSession("different-session");
        else delivery.close();
        assert.equal(
          delivery.take(retired.deliveryId, retired, "bounds"),
          undefined,
        );
        const retiredEnvelope: IBlendiaMcpSuccess<IBlendiaMcpImageResult> = {
          ok: true,
          result: retired,
          error: null,
        };
        const retiredMessage: Parameters<typeof addMcpNativeImage>[0] =
          Object.freeze({
            jsonrpc: "2.0",
            id: "bounds",
            result: Object.freeze({
              content: [
                { type: "text", text: JSON.stringify(retiredEnvelope) },
              ],
              structuredContent: retiredEnvelope,
              _meta: { observation: "retired metadata" },
            }),
          });
        const before: string = JSON.stringify(retiredMessage);
        const refused: ReturnType<typeof addMcpNativeImage> = addMcpNativeImage(
          retiredMessage,
          delivery,
        );
        assert.ok("result" in refused);
        assert.equal(refused.id, "bounds");
        assert.equal(refused.result.isError, true);
        assert.deepEqual(refused.result.structuredContent, failure);
        assert.deepEqual(refused.result.content, [
          { type: "text", text: failure.error.message },
        ]);
        assert.deepEqual(refused.result._meta, {
          observation: "retired metadata",
        });
        assert.equal(
          JSON.stringify(refused).includes(payload.dataBase64),
          false,
        );
        assert.equal(JSON.stringify(retiredMessage), before);
      }
      assert.throws(
        (): IBlendiaMcpImageResult => delivery.stage(payload),
        /No active image delivery request/,
      );
    });
  } finally {
    delivery.close();
  }
}
