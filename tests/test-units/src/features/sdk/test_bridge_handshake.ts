import assert from "node:assert/strict";

import type { IBlenderSession } from "../../../../../packages/sdk/src/IBlenderSession";
import { BlenderProtocol } from "../../../../../packages/sdk/src/internal/BlenderProtocol";

/**
 * Bind handshake metadata to protocol one without sharing mutable capabilities.
 *
 * Scenarios:
 * 1. Generation endpoints and literal capability names survive decoding without promoting extras.
 * 2. Mutating either capability array cannot change the other session value.
 * 3. Unsupported protocol versions and malformed identity, generation, version, or capabilities fail distinctly.
 *
 * @evidence contracts/testing.md#behavioral-verification Invoke the production handshake decoder used by connection setup and generation refresh, observing detached capability arrays, preserved scalar metadata, protocol mismatch, and malformed-response errors.
 * @evidence contracts/testing.md#independent-expectations Protocol exactly one, a nonempty session identity, nonnegative safe generation, string Blender version, and an array of string capability names determine literal expectations without consulting decoder internals.
 * @evidence contracts/testing.md#distinguishing-cases Cover generation zero and MAX_SAFE_INTEGER, an empty capability set, unknown named capabilities, caller mutations in both directions, wrong protocol spelling, nonfinite/fractional/unsafe generations, and malformed capability members; live capability availability is engine-owned.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this named first-party handshake case against ordinary decoded values; it neither contacts Blender nor treats metadata as proof of executable readiness.
 */
export function test_bridge_handshake(): void {
  const wire: IBlenderSession = {
    protocolVersion: 1,
    sessionId: "bridge",
    generation: 0,
    blenderVersion: "5.2.0",
    capabilities: ["scene.inspect", "future.method"],
  };
  const session: IBlenderSession = BlenderProtocol.session({
    ...wire,
    unexpectedCapability: "object.delete",
  });
  assert.deepEqual(session, {
    protocolVersion: 1,
    sessionId: "bridge",
    generation: 0,
    blenderVersion: "5.2.0",
    capabilities: ["scene.inspect", "future.method"],
  });
  assert.notEqual(session.capabilities, wire.capabilities);
  session.capabilities.push("caller-only");
  assert.deepEqual(wire.capabilities, ["scene.inspect", "future.method"]);
  wire.capabilities[0] = "wire-only";
  assert.equal(session.capabilities[0], "scene.inspect");
  assert.deepEqual(
    BlenderProtocol.session({
      ...wire,
      generation: Number.MAX_SAFE_INTEGER,
      capabilities: [],
    }).capabilities,
    [],
  );
  assert.equal(
    BlenderProtocol.session({ ...wire, generation: Number.MAX_SAFE_INTEGER })
      .generation,
    Number.MAX_SAFE_INTEGER,
  );

  for (const version of [0, 2, "1", null, undefined])
    assert.throws(
      (): IBlenderSession =>
        BlenderProtocol.session({ ...wire, protocolVersion: version }),
      { code: "PROTOCOL_MISMATCH", effects: "none" },
    );
  const invalid: readonly unknown[] = [
    null,
    [],
    { ...wire, sessionId: "" },
    { ...wire, sessionId: 7 },
    { ...wire, generation: -1 },
    { ...wire, generation: 0.5 },
    { ...wire, generation: NaN },
    { ...wire, generation: Infinity },
    { ...wire, generation: Number.MAX_SAFE_INTEGER + 1 },
    { ...wire, blenderVersion: null },
    { ...wire, capabilities: "scene.inspect" },
    { ...wire, capabilities: ["scene.inspect", 1] },
    { ...wire, capabilities: [null] },
  ];
  for (const value of invalid)
    assert.throws((): IBlenderSession => BlenderProtocol.session(value), {
      code: "INVALID_RESPONSE",
      effects: "none",
    });
}
