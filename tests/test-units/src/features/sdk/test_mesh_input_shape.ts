import assert from "node:assert/strict";

import type { IBlenderMeshOptions } from "../../../../../packages/sdk/src/IBlenderMeshOptions";
import { BlenderSceneProtocol } from "../../../../../packages/sdk/src/internal/BlenderSceneProtocol";

/**
 * Reject malformed JavaScript bulk geometry instead of serializing sparse entries as null.
 *
 * Scenarios:
 * 1. Empty and points-only geometry stay valid without requiring artificial faces.
 * 2. Missing, null, non-array, sparse, and coercible coordinates or indices fail admission.
 * 3. Name validation rejects NUL without rewriting a valid Unicode name.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercise the existing bulk-mesh boundary called by BlenderClient with malformed JavaScript values; observable admission failures prevent an invalid coordinate/index request from reaching Blender.
 * @evidence contracts/testing.md#independent-expectations A bulk mesh has arrays of explicit finite triples and polygon arrays of explicit integer indices; empty geometry is permitted, while JavaScript holes have no numeric coordinate or index and cannot be repaired by JSON conversion.
 * @evidence contracts/testing.md#distinguishing-cases Cover empty and points-only success, null and array records, absent fields, sparse top-level vertices/faces, sparse triples and index arrays, string/undefined coordinates, and empty/NUL names; numeric topology limits remain in test_scene_inputs.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this direct first-party mesh admission case using ordinary arrays, not a fake native producer, helper codec, package metadata test, or upstream serializer test.
 */
export function test_mesh_input_shape(): void {
  assert.deepEqual(
    BlenderSceneProtocol.mesh({
      name: "점 한글",
      vertices: [[1, 2, 3]],
      faces: [],
    }),
    { name: "점 한글", vertices: [[1, 2, 3]], faces: [] },
  );
  assert.deepEqual(BlenderSceneProtocol.mesh({ vertices: [], faces: [] }), {
    vertices: [],
    faces: [],
  });
  const vertices: [number, number, number][] = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
  ];
  const invalid: readonly unknown[] = [
    null,
    [],
    {},
    { vertices: null, faces: [] },
    { vertices, faces: null },
    { vertices: "vertices", faces: [] },
    { vertices, faces: "faces" },
    { vertices: new Array<[number, number, number]>(1), faces: [] },
    { vertices: [new Array<number>(3)], faces: [] },
    { vertices: [[0, undefined, 0]], faces: [] },
    { vertices: [[0, "1", 0]], faces: [] },
    { vertices, faces: new Array<number[]>(1) },
    { vertices, faces: [new Array<number>(3)] },
    { vertices, faces: [[0, "1", 2]] },
    { vertices, faces: [null] },
    { vertices, faces: [], name: "" },
    { vertices, faces: [], name: "bad\0name" },
  ];
  for (const value of invalid)
    assert.throws(
      (): IBlenderMeshOptions =>
        BlenderSceneProtocol.mesh(value as IBlenderMeshOptions),
      { code: "INVALID_ARGUMENT", effects: "none" },
    );
}
