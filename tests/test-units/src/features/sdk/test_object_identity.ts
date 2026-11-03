import assert from "node:assert/strict";

import type { IBlenderObjectHandle } from "../../../../../packages/sdk/src/IBlenderObjectHandle";
import type { IBlenderObjectSnapshot } from "../../../../../packages/sdk/src/IBlenderObjectSnapshot";
import type { IBlenderSession } from "../../../../../packages/sdk/src/IBlenderSession";
import { BlenderProtocol } from "../../../../../packages/sdk/src/internal/BlenderProtocol";

/**
 * Preserve decimal object identity and reject snapshots from another data lifetime.
 *
 * Scenarios:
 * 1. Adjacent identities beyond number precision remain distinct and handle copies remain independent.
 * 2. Finite native snapshots preserve local vectors without applying mutation magnitude limits.
 * 3. Malformed handles, foreign lifetimes, and malformed snapshot vectors fail before exposure.
 *
 * @evidence contracts/testing.md#behavioral-verification Invoke the actual handle and object snapshot codecs consumed by create/get/transform, observing full-width strings, detached handles and vectors, name-independent identity, and typed refusals.
 * @evidence contracts/testing.md#independent-expectations Decimal IDs remain strings with at most twenty digits; snapshots must match the supplied session/generation and contain three finite local vectors, while valid native readback is not limited to input mutation magnitude.
 * @evidence contracts/testing.md#distinguishing-cases Cover adjacent 9007199254740992/9007199254740993 IDs, a twenty-digit endpoint, invalid numeric spelling and generations, copied metadata, finite large readback, foreign session/generation, malformed names/types, vector lengths and nonfinite components; live object existence and undo remain engine cases.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this case against existing production codecs with literal observations; no new classifier, socket, process, fixture loader, or public test seam is introduced.
 */
export function test_object_identity(): void {
  const handle: IBlenderObjectHandle = {
    sessionId: "bridge",
    generation: 3,
    objectId: "9007199254740992",
  };
  const first: IBlenderObjectHandle = BlenderProtocol.handle(handle);
  const second: IBlenderObjectHandle = BlenderProtocol.handle({
    ...handle,
    objectId: "9007199254740993",
  });
  assert.equal(first.objectId, "9007199254740992");
  assert.equal(second.objectId, "9007199254740993");
  assert.notEqual(first.objectId, second.objectId);
  first.objectId = "7";
  assert.equal(handle.objectId, "9007199254740992");
  assert.equal(
    BlenderProtocol.handle({ ...handle, objectId: "18446744073709551615" })
      .objectId,
    "18446744073709551615",
  );

  const invalidHandles: readonly unknown[] = [
    null,
    [],
    { ...handle, objectId: 9007199254740992 },
    { ...handle, objectId: "0" },
    { ...handle, objectId: "01" },
    { ...handle, objectId: "-1" },
    { ...handle, objectId: "1e3" },
    { ...handle, objectId: "100000000000000000000" },
    { ...handle, sessionId: "" },
    { ...handle, generation: -1 },
    { ...handle, generation: 1.5 },
    { ...handle, generation: Number.MAX_SAFE_INTEGER + 1 },
  ];
  for (const value of invalidHandles) {
    assert.throws((): IBlenderObjectHandle => BlenderProtocol.handle(value), {
      code: "INVALID_ARGUMENT",
    });
    assert.throws(
      (): IBlenderObjectHandle =>
        BlenderProtocol.handle(value, "INVALID_RESPONSE"),
      { code: "INVALID_RESPONSE" },
    );
  }

  const session: IBlenderSession = {
    protocolVersion: 1,
    sessionId: "bridge",
    generation: 3,
    blenderVersion: "5.2.0",
    capabilities: [],
  };
  const wire: IBlenderObjectSnapshot = {
    handle,
    name: "Renamed Cube",
    type: "MESH",
    location: [1e30, -1e30, 0],
    rotationEuler: [0, 1, -2],
    scale: [0, -1, 2],
  };
  const snapshot: IBlenderObjectSnapshot = BlenderProtocol.snapshot(
    wire,
    session,
  );
  assert.equal(snapshot.name, "Renamed Cube");
  assert.equal(snapshot.handle.objectId, "9007199254740992");
  assert.deepEqual(snapshot.location, [1e30, -1e30, 0]);
  assert.deepEqual(snapshot.rotationEuler, [0, 1, -2]);
  assert.deepEqual(snapshot.scale, [0, -1, 2]);
  snapshot.handle.objectId = "8";
  snapshot.location[0] = 5;
  snapshot.rotationEuler[1] = 5;
  snapshot.scale[2] = 5;
  assert.equal(wire.handle.objectId, "9007199254740992");
  assert.deepEqual(wire.location, [1e30, -1e30, 0]);
  assert.deepEqual(wire.rotationEuler, [0, 1, -2]);
  assert.deepEqual(wire.scale, [0, -1, 2]);
  const invalidSnapshots: readonly unknown[] = [
    { ...wire, handle: { ...handle, sessionId: "other" } },
    { ...wire, handle: { ...handle, generation: 2 } },
    { ...wire, name: 7 },
    { ...wire, type: null },
    { ...wire, location: [1, 2] },
    { ...wire, location: [1, 2, 3, 4] },
    { ...wire, rotationEuler: [0, NaN, 0] },
    { ...wire, scale: [1, Infinity, 1] },
    { ...wire, scale: [1, "1", 1] },
  ];
  for (const value of invalidSnapshots)
    assert.throws(
      (): IBlenderObjectSnapshot => BlenderProtocol.snapshot(value, session),
      { code: "INVALID_RESPONSE", effects: "none" },
    );
}
