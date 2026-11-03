import assert from "node:assert/strict";

import { BlenderProtocol } from "../../../../../packages/sdk/src/internal/BlenderProtocol";
import type { IBlenderWireResponse } from "../../../../../packages/sdk/src/internal/IBlenderWireResponse";

/**
 * Refuse ambiguous bridge replies before their correlation or result is trusted.
 *
 * Scenarios:
 * 1. Success preserves a literal result and full-width decimal correlation identity.
 * 2. Pre-authentication failures may omit identity but retain explicit effect information.
 * 3. Invalid correlation, identity, discriminants, and incomplete or conflicting arms fail.
 *
 * @evidence contracts/testing.md#behavioral-verification Invoke the actual envelope decoder consumed by BlenderConnection and observe success/failure values and INVALID_RESPONSE refusals before method decoding; no transport is replaced.
 * @evidence contracts/testing.md#independent-expectations The version-one envelope requires a positive decimal correlation string of at most twenty digits, boolean ok, one result or complete error arm, and explicit none/possible effects; authenticated dispatch has additional identity duties outside this codec.
 * @evidence contracts/testing.md#distinguishing-cases Cover null and array envelopes, zero/leading-zero/fractional/numeric/overlong IDs, malformed optional identity, both and missing arms, absent effects, and both supported effect values, allowing null success results and identity-free authentication failures.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this named first-party decoder case using literal wire values; it starts no socket, child, Blender, MCP server, or upstream framework.
 */
export function test_bridge_envelopes(): void {
  const success: IBlenderWireResponse = {
    id: "18446744073709551615",
    sessionId: "bridge",
    generation: 0,
    ok: true,
    result: { label: "한글", value: 7 },
  };
  const decoded: IBlenderWireResponse = BlenderProtocol.response(success);
  assert.equal(decoded.id, "18446744073709551615");
  assert.ok(decoded.ok);
  assert.deepEqual(decoded.result, { label: "한글", value: 7 });
  assert.deepEqual(
    BlenderProtocol.response({ id: "1", ok: true, result: null }),
    { id: "1", ok: true, result: null },
  );

  for (const effects of ["none", "possible"] as const) {
    const failure: IBlenderWireResponse = BlenderProtocol.response({
      id: "2",
      ok: false,
      error: { code: "AUTH_REQUIRED", message: "", effects },
    });
    assert.ok(!failure.ok);
    assert.equal(failure.error.code, "AUTH_REQUIRED");
    assert.equal(failure.error.message, "");
    assert.equal(failure.error.effects, effects);
    assert.equal(failure.sessionId, undefined);
  }

  const invalid: readonly unknown[] = [
    null,
    [],
    "response",
    { ...success, id: 1 },
    { ...success, id: "0" },
    { ...success, id: "01" },
    { ...success, id: "1.5" },
    { ...success, id: "100000000000000000000" },
    { ...success, id: "" },
    { ...success, sessionId: "" },
    { ...success, sessionId: null },
    { ...success, generation: -1 },
    { ...success, generation: 0.5 },
    { ...success, generation: Number.MAX_SAFE_INTEGER + 1 },
    { ...success, generation: "0" },
    { ...success, ok: "true" },
    { id: "1", ok: true },
    {
      ...success,
      error: { code: "FAILED", message: "failure", effects: "none" },
    },
    { id: "1", ok: false },
    {
      id: "1",
      ok: false,
      result: null,
      error: { code: "FAILED", message: "failure", effects: "none" },
    },
    { id: "1", ok: false, error: null },
    {
      id: "1",
      ok: false,
      error: { code: "", message: "failure", effects: "none" },
    },
    {
      id: "1",
      ok: false,
      error: { code: "FAILED", message: 4, effects: "none" },
    },
    { id: "1", ok: false, error: { code: "FAILED", message: "failure" } },
    {
      id: "1",
      ok: false,
      error: { code: "FAILED", message: "failure", effects: "certain" },
    },
  ];
  for (const value of invalid)
    assert.throws((): IBlenderWireResponse => BlenderProtocol.response(value), {
      code: "INVALID_RESPONSE",
      effects: "none",
    });
}
