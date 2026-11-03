import assert from "node:assert/strict";

import type { IBlenderMeshSnapshot } from "../../../../../packages/sdk/src/IBlenderMeshSnapshot";
import type { IBlenderObjectSnapshot } from "../../../../../packages/sdk/src/IBlenderObjectSnapshot";
import type { IBlenderSceneSnapshot } from "../../../../../packages/sdk/src/IBlenderSceneSnapshot";
import type { IBlenderSession } from "../../../../../packages/sdk/src/IBlenderSession";
import { BlenderSceneProtocol } from "../../../../../packages/sdk/src/internal/BlenderSceneProtocol";

/**
 * Expose only lifetime-bound, numerically UID-ordered scene pages and bounded mesh readback.
 *
 * Scenarios:
 * 1. Decimal ordering works across digit lengths and beyond JavaScript number precision.
 * 2. Scene objects, vectors, active-camera handles, and mesh snapshots are detached copies.
 * 3. Foreign identity, duplicate/decreasing UIDs, invalid continuation, count, and native type fail.
 *
 * @evidence contracts/testing.md#behavioral-verification Invoke the actual scene and mesh result decoders consumed by BlenderClient, observing ordered fresh pages, independent returned storage, and INVALID_RESPONSE refusals before exposing native metadata.
 * @evidence contracts/testing.md#independent-expectations Decimal UID order places 9 before 10 and keeps adjacent 9007199254740992/9007199254740993 distinct; page size obeys the requested limit, counts are safe integers, cursor bytes are at most 1024, and mesh populations have independent 8192/32768/8192 bounds.
 * @evidence contracts/testing.md#distinguishing-cases Cover empty and full pages, numeric versus lexical ordering, duplicate/decreasing IDs, current and foreign page/object/camera lifetime, deep copies, exact/overlong multibyte cursors, continuation without objects, invalid counts, wrong mesh type, and each mesh bound; cross-page consistency and native cursor invalidation remain engine-owned.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this first-party response case from literal native-shaped data without an artificial server or process; the codec observations do not certify Blender scene evaluation or pagination atomicity.
 */
export function test_scene_responses(): void {
  const session: IBlenderSession = {
    protocolVersion: 1,
    sessionId: "bridge",
    generation: 3,
    blenderVersion: "5.2.0",
    capabilities: [],
  };
  const objects: IBlenderObjectSnapshot[] = [
    "9",
    "10",
    "9007199254740992",
    "9007199254740993",
  ].map((objectId: string): IBlenderObjectSnapshot => ({
    handle: { sessionId: "bridge", generation: 3, objectId },
    name: "Shared Name",
    type: "MESH",
    location: [1, 2, 3],
    rotationEuler: [0, 0, 0],
    scale: [1, 1, 1],
  }));
  const cursor: string = "한".repeat(341) + "a";
  const wire: IBlenderSceneSnapshot = {
    sessionId: "bridge",
    generation: 3,
    sceneId: "18446744073709551615",
    sceneName: "장면",
    frame: -2,
    activeCamera: { sessionId: "bridge", generation: 3, objectId: "100" },
    objectCount: 7,
    objects,
    nextCursor: cursor,
  };
  const page: IBlenderSceneSnapshot = BlenderSceneProtocol.scene(
    wire,
    session,
    4,
  );
  assert.deepEqual(
    page.objects.map(
      (object: IBlenderObjectSnapshot): string => object.handle.objectId,
    ),
    ["9", "10", "9007199254740992", "9007199254740993"],
  );
  assert.equal(page.sceneId, "18446744073709551615");
  assert.equal(page.objectCount, 7);
  assert.equal(page.nextCursor, cursor);
  assert.equal(page.frame, -2);
  page.objects[0].location[0] = 99;
  page.objects[0].rotationEuler[1] = 99;
  page.objects[0].scale[2] = 99;
  page.objects[0].handle.objectId = "1";
  assert.ok(page.activeCamera !== null);
  page.activeCamera.objectId = "1";
  page.objects.pop();
  assert.equal(objects.length, 4);
  assert.equal(objects[0].handle.objectId, "9");
  assert.deepEqual(objects[0].location, [1, 2, 3]);
  assert.deepEqual(objects[0].rotationEuler, [0, 0, 0]);
  assert.deepEqual(objects[0].scale, [1, 1, 1]);
  assert.equal(wire.activeCamera?.objectId, "100");
  const empty: IBlenderSceneSnapshot = BlenderSceneProtocol.scene(
    {
      ...wire,
      objects: [],
      objectCount: 0,
      activeCamera: null,
      nextCursor: null,
    },
    session,
    1,
  );
  assert.deepEqual(empty.objects, []);
  assert.equal(empty.activeCamera, null);
  assert.equal(empty.nextCursor, null);

  const invalidPages: readonly unknown[] = [
    { ...wire, sessionId: "other" },
    { ...wire, generation: 2 },
    { ...wire, sceneId: "01" },
    { ...wire, sceneName: "" },
    { ...wire, frame: 0.5 },
    { ...wire, frame: Number.MAX_SAFE_INTEGER + 1 },
    { ...wire, objects: null },
    { ...wire, objects: [objects[1], objects[0]] },
    { ...wire, objects: [objects[2], objects[2]] },
    {
      ...wire,
      objects: [
        { ...objects[0], handle: { ...objects[0].handle, generation: 2 } },
      ],
    },
    {
      ...wire,
      objects: [
        { ...objects[0], handle: { ...objects[0].handle, sessionId: "other" } },
      ],
    },
    { ...wire, objectCount: 3 },
    { ...wire, objectCount: 4.5 },
    { ...wire, objectCount: Number.MAX_SAFE_INTEGER + 1 },
    { ...wire, nextCursor: "" },
    { ...wire, nextCursor: "bad\0cursor" },
    { ...wire, nextCursor: cursor + "a" },
    { ...wire, objects: [], nextCursor: "continuation" },
    { ...wire, activeCamera: { ...wire.activeCamera, generation: 2 } },
    { ...wire, activeCamera: { ...wire.activeCamera, sessionId: "other" } },
  ];
  for (const value of invalidPages)
    assert.throws(
      (): IBlenderSceneSnapshot =>
        BlenderSceneProtocol.scene(value, session, 4),
      { code: "INVALID_RESPONSE", effects: "none" },
    );
  assert.throws(
    (): IBlenderSceneSnapshot => BlenderSceneProtocol.scene(wire, session, 3),
    { code: "INVALID_RESPONSE" },
  );

  const mesh: IBlenderMeshSnapshot = {
    ...objects[0],
    vertexCount: 8192,
    edgeCount: 32768,
    polygonCount: 8192,
  };
  const decoded: IBlenderMeshSnapshot = BlenderSceneProtocol.meshSnapshot(
    mesh,
    session,
  );
  assert.equal(decoded.vertexCount, 8192);
  assert.equal(decoded.edgeCount, 32768);
  assert.equal(decoded.polygonCount, 8192);
  decoded.location[0] = 25;
  assert.equal(mesh.location[0], 1);
  assert.equal(
    BlenderSceneProtocol.meshSnapshot(
      { ...mesh, vertexCount: 0, edgeCount: 0, polygonCount: 0 },
      session,
    ).vertexCount,
    0,
  );
  const invalidMeshes: readonly unknown[] = [
    { ...mesh, type: "CURVE" },
    { ...mesh, vertexCount: -1 },
    { ...mesh, vertexCount: 8193 },
    { ...mesh, edgeCount: 32769 },
    { ...mesh, edgeCount: 1.5 },
    { ...mesh, polygonCount: 8193 },
    { ...mesh, polygonCount: "0" },
  ];
  for (const value of invalidMeshes)
    assert.throws(
      (): IBlenderMeshSnapshot =>
        BlenderSceneProtocol.meshSnapshot(value, session),
      { code: "INVALID_RESPONSE", effects: "none" },
    );
}
