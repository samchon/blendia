import assert from "node:assert/strict";

import type { IBlenderCubeOptions } from "../../../../../packages/sdk/src/IBlenderCubeOptions";
import type { IBlenderTransform } from "../../../../../packages/sdk/src/IBlenderTransform";
import { BlenderProtocol } from "../../../../../packages/sdk/src/internal/BlenderProtocol";

/**
 * Admit explicit cube and partial-transform inputs without coercion or vector aliasing.
 *
 * Scenarios:
 * 1. Omitted cube defaults remain omitted; positive endpoints and Unicode names survive unchanged.
 * 2. Partial transforms preserve local Euler radians, zero/negative scales, and detached coordinate triples.
 * 3. Empty or malformed updates and sparse/nonfinite/out-of-range coordinates fail before transmission.
 *
 * @evidence contracts/testing.md#behavioral-verification Call the production cube and transform admission methods used before BlenderClient sends mutations, checking literal requests, omission semantics, detached vectors, and invalid-input errors without observing private branches.
 * @evidence contracts/testing.md#independent-expectations Cube size is finite positive and at most 1e20; a transform supplies at least one supported triple of finite coordinates within absolute 1e20, with no conversion of local units or XYZ radians and no truthiness defaults.
 * @evidence contracts/testing.md#distinguishing-cases Cover omitted cube options, endpoint and tiny positive sizes, empty/NUL names, zero/nonfinite/over-limit sizes, one/all transform fields, independent copies, unknown-only and null updates, malformed/sparse vectors, and all three coordinate fields; live geometry is engine-owned.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this named case against existing first-party admission logic; malformed JavaScript values are passed to the actual boundary without a socket or test-only implementation.
 */
export function test_object_mutation_inputs(): void {
  assert.deepEqual(BlenderProtocol.cube({}), {});
  assert.deepEqual(BlenderProtocol.cube({ name: "장면 Cube", size: 1e20 }), {
    name: "장면 Cube",
    size: 1e20,
  });
  assert.equal(
    BlenderProtocol.cube({ size: Number.MIN_VALUE }).size,
    Number.MIN_VALUE,
  );
  const invalidCubes: readonly unknown[] = [
    null,
    [],
    { name: "" },
    { name: "bad\0name" },
    { name: 4 },
    { size: 0 },
    { size: -1 },
    { size: 1e20 * 2 },
    { size: NaN },
    { size: Infinity },
    { size: "2" },
    { size: null },
  ];
  for (const value of invalidCubes)
    assert.throws(
      (): IBlenderCubeOptions =>
        BlenderProtocol.cube(value as IBlenderCubeOptions),
      { code: "INVALID_ARGUMENT", effects: "none" },
    );

  const input: IBlenderTransform = {
    location: [-1e20, 0, 1e20],
    rotationEuler: [-7, 0, 8],
    scale: [0, -1, 2],
  };
  const update: IBlenderTransform = BlenderProtocol.transform(input);
  assert.deepEqual(update, {
    location: [-1e20, 0, 1e20],
    rotationEuler: [-7, 0, 8],
    scale: [0, -1, 2],
  });
  assert.ok(
    update.location !== undefined &&
      update.rotationEuler !== undefined &&
      update.scale !== undefined,
  );
  update.location[0] = 9;
  update.rotationEuler[0] = 9;
  update.scale[0] = 9;
  assert.deepEqual(input.location, [-1e20, 0, 1e20]);
  assert.deepEqual(input.rotationEuler, [-7, 0, 8]);
  assert.deepEqual(input.scale, [0, -1, 2]);
  assert.deepEqual(BlenderProtocol.transform({ scale: [0, -1, 1] }), {
    scale: [0, -1, 1],
  });

  const sparseRotation: number[] = new Array<number>(3);
  sparseRotation[0] = 0;
  sparseRotation[2] = 0;
  const invalidUpdates: readonly unknown[] = [
    null,
    [],
    {},
    { unrelated: [1, 2, 3] },
    { location: null },
    { location: [1, 2] },
    { location: [1, 2, 3, 4] },
    { location: [0, "1", 0] },
    { location: [0, NaN, 0] },
    { rotationEuler: [0, Infinity, 0] },
    { scale: [0, -Infinity, 0] },
    { location: [0, 1e20 * 2, 0] },
    { rotationEuler: [0, -1e20 * 2, 0] },
    { scale: [0, 1e20 * 2, 0] },
    { location: new Array<number>(3) },
    { rotationEuler: sparseRotation },
  ];
  for (const value of invalidUpdates)
    assert.throws(
      (): IBlenderTransform =>
        BlenderProtocol.transform(value as IBlenderTransform),
      { code: "INVALID_ARGUMENT", effects: "none" },
    );
}
