import assert from "node:assert/strict";

import { BlenderFrameDecoder } from "../../../../packages/sdk/src/internal/BlenderFrameDecoder";

/**
 * Decode stream fragments and enforce the bridge's strict byte-level message boundary.
 *
 * Scenarios:
 * 1. Every header, JSON, and multibyte UTF-8 split yields only complete messages.
 * 2. Coalesced frames preserve order across a trailing partial message.
 * 3. Malformed length, UTF-8, and JSON fail; the exact payload cap succeeds.
 * 4. Encoding uses UTF-8 byte lengths and refuses unsupported or oversized values.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercise the decoder and encoder used by BlenderClient, observing completed JSON values, wire lengths, and stable error codes rather than private offsets or buffer layout.
 * @evidence contracts/testing.md#independent-expectations Literal big-endian prefixes and UTF-8 JSON fixtures establish decoding expectations without calling encode; the stated 1048576-byte cap independently determines boundary values.
 * @evidence contracts/testing.md#distinguishing-cases Cover all two-chunk splits, empty pushes, coalescing, zero and oversized prefixes, invalid UTF-8 inside quoted JSON, malformed JSON, exact cap, and byte-count overflow; CLI grammar belongs to its separate unit.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this named unit against the actual production framer, without network, Blender, package smoke checks, synthetic product seams, or recovery assumptions after terminal malformed input.
 */
export function test_blender_frames(): void {
  const first: Buffer = Buffer.concat([
    Buffer.from([0, 0, 0, 24]),
    Buffer.from('{"id":1,"method":"ping"}', "utf8"),
  ]);
  const unicode: Buffer = Buffer.concat([
    Buffer.from([0, 0, 0, 23]),
    Buffer.from('{"id":2,"result":"한"}', "utf8"),
  ]);
  for (let cut: number = 1; cut < unicode.byteLength; cut++) {
    const decoder: BlenderFrameDecoder = new BlenderFrameDecoder();
    assert.deepEqual(decoder.push(unicode.subarray(0, cut)), []);
    assert.deepEqual(decoder.push(new Uint8Array()), []);
    assert.deepEqual(decoder.push(unicode.subarray(cut)), [
      { id: 2, result: "한" },
    ]);
  }

  const stream: BlenderFrameDecoder = new BlenderFrameDecoder();
  assert.deepEqual(
    stream.push(Buffer.concat([first, unicode.subarray(0, 7)])),
    [{ id: 1, method: "ping" }],
  );
  assert.deepEqual(stream.push(Buffer.concat([unicode.subarray(7), first])), [
    { id: 2, result: "한" },
    { id: 1, method: "ping" },
  ]);

  for (const bytes of [
    [0, 0, 0, 0],
    [0, 0x10, 0, 1],
    [0, 0, 0, 1, 0x7b],
    [0, 0, 0, 4, 0x22, 0xc3, 0x28, 0x22],
  ])
    assert.throws(
      (): unknown[] => new BlenderFrameDecoder().push(Buffer.from(bytes)),
      {
        code: "INVALID_FRAME",
      },
    );

  const encoded: Buffer = BlenderFrameDecoder.encode({ id: 7, result: "한" });
  assert.equal(encoded.readUInt32BE(0), encoded.byteLength - 4);
  assert.deepEqual(JSON.parse(encoded.subarray(4).toString("utf8")), {
    id: 7,
    result: "한",
  });

  const limitValue: string = "a".repeat(1048574);
  const limitFrame: Buffer = Buffer.concat([
    Buffer.from([0, 0x10, 0, 0]),
    Buffer.from(`"${limitValue}"`, "utf8"),
  ]);
  assert.deepEqual(new BlenderFrameDecoder().push(limitFrame), [limitValue]);
  const encodedLimit: Buffer = BlenderFrameDecoder.encode(limitValue);
  assert.equal(encodedLimit.readUInt32BE(0), 1048576);
  assert.equal(encodedLimit.byteLength, 1048580);

  for (const value of [undefined, "a".repeat(1048575), "한".repeat(400000)])
    assert.throws((): Buffer => BlenderFrameDecoder.encode(value), {
      code: "INVALID_ARGUMENT",
    });
}
