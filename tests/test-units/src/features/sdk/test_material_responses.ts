import assert from "node:assert/strict";

import type { IBlenderMaterialAssignment } from "../../../../../packages/sdk/src/IBlenderMaterialAssignment";
import type { IBlenderMaterialSnapshot } from "../../../../../packages/sdk/src/IBlenderMaterialSnapshot";
import type { IBlenderSession } from "../../../../../packages/sdk/src/IBlenderSession";
import { BlenderMaterialProtocol } from "../../../../../packages/sdk/src/internal/BlenderMaterialProtocol";

/**
 * Keep material assignment pairs and returned shader data bound to one exact lifetime.
 *
 * Scenarios:
 * 1. Both full-width object/material identities survive assignment in detached handles.
 * 2. Native names and opaque linear shader factors are copied without vector aliasing.
 * 3. Foreign assignment references and malformed native handle/color/factor fields fail distinctly.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercise the real material assignment and snapshot codecs consumed by assignMaterial/createMaterial, observing copied identity pairs and shader readback or local stale-handle/malformed-response errors.
 * @evidence contracts/testing.md#independent-expectations Both assignment handles share the active session and generation, remain decimal strings, and returned linear RGB, roughness and metallic stay finite within zero through one; the native producer separately decides whether mesh data is editable and single-user.
 * @evidence contracts/testing.md#distinguishing-cases Cover copied full-width identities, both stale session/generation references, malformed IDs, linear endpoint colors and factors, changed readback names, vector ownership, nonfinite/out-of-range colors and factors, and foreign returned material identity without claiming native assignment succeeded.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this named first-party codec case; values enter existing production methods without a mock material graph, fake scene, child, or upstream shader test.
 */
export function test_material_responses(): void {
  const session: IBlenderSession = {
    protocolVersion: 1,
    sessionId: "bridge",
    generation: 3,
    blenderVersion: "5.2.0",
    capabilities: [],
  };
  const assignment: IBlenderMaterialAssignment = {
    object: {
      sessionId: "bridge",
      generation: 3,
      objectId: "9007199254740993",
    },
    material: {
      sessionId: "bridge",
      generation: 3,
      materialId: "18446744073709551615",
    },
  };
  const admitted: IBlenderMaterialAssignment =
    BlenderMaterialProtocol.assignment(assignment, session);
  assert.equal(admitted.object.objectId, "9007199254740993");
  assert.equal(admitted.material.materialId, "18446744073709551615");
  admitted.object.objectId = "7";
  admitted.material.materialId = "8";
  assert.equal(assignment.object.objectId, "9007199254740993");
  assert.equal(assignment.material.materialId, "18446744073709551615");
  for (const value of [
    { ...assignment, object: { ...assignment.object, sessionId: "other" } },
    { ...assignment, object: { ...assignment.object, generation: 2 } },
    { ...assignment, material: { ...assignment.material, sessionId: "other" } },
    { ...assignment, material: { ...assignment.material, generation: 2 } },
  ])
    assert.throws(
      (): IBlenderMaterialAssignment =>
        BlenderMaterialProtocol.assignment(value, session),
      { code: "STALE_HANDLE", effects: "none" },
    );
  const malformed: readonly unknown[] = [
    null,
    { ...assignment, object: null },
    { ...assignment, material: null },
    { ...assignment, object: { ...assignment.object, objectId: "01" } },
    { ...assignment, material: { ...assignment.material, materialId: "0" } },
    { ...assignment, material: { ...assignment.material, materialId: 1 } },
  ];
  for (const value of malformed)
    assert.throws(
      (): IBlenderMaterialAssignment =>
        BlenderMaterialProtocol.assignment(
          value as IBlenderMaterialAssignment,
          session,
        ),
      { code: "INVALID_ARGUMENT", effects: "none" },
    );

  const wire: IBlenderMaterialSnapshot = {
    handle: assignment.material,
    name: "Material.001",
    baseColorLinearRGB: [0, 1, 0.25],
    roughness: 0,
    metallic: 1,
  };
  const snapshot: IBlenderMaterialSnapshot = BlenderMaterialProtocol.snapshot(
    wire,
    session,
  );
  assert.equal(snapshot.name, "Material.001");
  assert.deepEqual(snapshot.baseColorLinearRGB, [0, 1, 0.25]);
  assert.equal(snapshot.roughness, 0);
  assert.equal(snapshot.metallic, 1);
  snapshot.baseColorLinearRGB[1] = 0;
  snapshot.handle.materialId = "9";
  assert.deepEqual(wire.baseColorLinearRGB, [0, 1, 0.25]);
  assert.equal(wire.handle.materialId, "18446744073709551615");
  const invalid: readonly unknown[] = [
    { ...wire, name: "" },
    { ...wire, handle: { ...wire.handle, sessionId: "other" } },
    { ...wire, handle: { ...wire.handle, generation: 2 } },
    { ...wire, handle: { ...wire.handle, materialId: "01" } },
    { ...wire, baseColorLinearRGB: [0, 1] },
    { ...wire, baseColorLinearRGB: [0, 1.001, 0] },
    { ...wire, baseColorLinearRGB: [0, NaN, 0] },
    { ...wire, roughness: -0.001 },
    { ...wire, roughness: Infinity },
    { ...wire, metallic: 1.001 },
    { ...wire, metallic: "0" },
  ];
  for (const value of invalid)
    assert.throws(
      (): IBlenderMaterialSnapshot =>
        BlenderMaterialProtocol.snapshot(value, session),
      { code: "INVALID_RESPONSE", effects: "none" },
    );
}
