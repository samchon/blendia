import assert from "node:assert/strict";

import type { IBlenderAreaLightOptions } from "../../../../packages/sdk/src/IBlenderAreaLightOptions";
import type { IBlenderCameraOptions } from "../../../../packages/sdk/src/IBlenderCameraOptions";
import type { IBlenderMaterialHandle } from "../../../../packages/sdk/src/IBlenderMaterialHandle";
import type { IBlenderMaterialOptions } from "../../../../packages/sdk/src/IBlenderMaterialOptions";
import type { IBlenderMeshOptions } from "../../../../packages/sdk/src/IBlenderMeshOptions";
import type { IBlenderSceneQuery } from "../../../../packages/sdk/src/IBlenderSceneQuery";
import type { IBlenderSession } from "../../../../packages/sdk/src/IBlenderSession";
import { BlenderCameraProtocol } from "../../../../packages/sdk/src/internal/BlenderCameraProtocol";
import { BlenderMaterialProtocol } from "../../../../packages/sdk/src/internal/BlenderMaterialProtocol";
import { BlenderSceneProtocol } from "../../../../packages/sdk/src/internal/BlenderSceneProtocol";

/**
 * Admit bounded scene-authoring inputs without silently repairing geometry or retargeting handles.
 *
 * Scenarios:
 * 1. A literal pyramid and empty meshes remain detached, while coordinates and topology obey independent caps.
 * 2. Linear material inputs preserve endpoints and defaults, and material handles keep their lifetime identity.
 * 3. Camera and light placement require distinct finite points and bounded physical parameters.
 * 4. Scene query limits and UTF-8 cursor bytes fail before a request can be sent.
 *
 * @evidence contracts/testing.md#behavioral-verification Invoke the real validators consumed by BlenderClient before scene operations, observing admitted copies, literal defaults, stable input errors, stale identities, and exact accepted/refused bounds without Blender or sockets.
 * @evidence contracts/testing.md#independent-expectations The accepted scene contract supplies 8192 vertices, 8192 faces, 32768 corners, finite absolute 1e20 coordinates, linear RGB and material ranges, clipping order, light bounds, and 1024 cursor bytes independently of validator loops.
 * @evidence contracts/testing.md#distinguishing-cases Cover empty and ordinary geometry, exact and exceeded independent caps, repeated/fractional/out-of-range indices, nonfinite coordinates, endpoint colors, stale material identity, coincident targets, clip ordering, and cursor byte limits; native Blender mesh/render effects remain manual.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this named SDK unit against production internal validators, following the existing framer import convention without fixture files, network replacements, test-only exports, or upstream checks.
 */
export function test_scene_inputs(): void {
  const pyramid: IBlenderMeshOptions = {
    name: "Pyramid",
    vertices: [
      [-1, -1, 0],
      [1, -1, 0],
      [1, 1, 0],
      [-1, 1, 0],
      [0, 0, 2],
    ],
    faces: [
      [0, 3, 2, 1],
      [0, 1, 4],
      [1, 2, 4],
      [2, 3, 4],
      [3, 0, 4],
    ],
  };
  const copied: IBlenderMeshOptions = BlenderSceneProtocol.mesh(pyramid);
  assert.deepEqual(copied, pyramid);
  copied.vertices[0][0] = 50;
  copied.faces[0][0] = 4;
  assert.equal(pyramid.vertices[0][0], -1);
  assert.equal(pyramid.faces[0][0], 0);
  assert.deepEqual(BlenderSceneProtocol.mesh({ vertices: [], faces: [] }), {
    vertices: [],
    faces: [],
  });
  assert.deepEqual(
    BlenderSceneProtocol.mesh({ vertices: [[-1e20, 0, 1e20]], faces: [] })
      .vertices,
    [[-1e20, 0, 1e20]],
  );
  for (const coordinate of [NaN, Infinity, -Infinity, 1e20 * 2, -1e20 * 2])
    assert.throws(
      (): IBlenderMeshOptions =>
        BlenderSceneProtocol.mesh({
          vertices: [[coordinate, 0, 0]],
          faces: [],
        }),
      { code: "INVALID_ARGUMENT", effects: "none" },
    );
  for (const face of [
    [0, 1],
    [0, 1, 1],
    [-1, 1, 2],
    [0, 1, 5],
    [0, 1, 1.5],
  ])
    assert.throws(
      (): IBlenderMeshOptions =>
        BlenderSceneProtocol.mesh({
          vertices: pyramid.vertices,
          faces: [face],
        }),
      { code: "INVALID_ARGUMENT" },
    );

  const points: IBlenderMeshOptions = {
    vertices: Array.from(
      { length: 8192 },
      (_: unknown, index: number): [number, number, number] => [index, 0, 0],
    ),
    faces: [],
  };
  assert.equal(BlenderSceneProtocol.mesh(points).vertices.length, 8192);
  points.vertices.push([8192, 0, 0]);
  assert.throws((): IBlenderMeshOptions => BlenderSceneProtocol.mesh(points), {
    code: "INVALID_ARGUMENT",
  });
  const quads: number[][] = Array.from({ length: 8192 }, (): number[] => [
    0, 1, 2, 3,
  ]);
  assert.equal(
    BlenderSceneProtocol.mesh({ vertices: pyramid.vertices, faces: quads })
      .faces.length,
    8192,
  );
  assert.throws(
    (): IBlenderMeshOptions =>
      BlenderSceneProtocol.mesh({
        vertices: pyramid.vertices,
        faces: [...quads, [0, 1, 2]],
      }),
    { code: "INVALID_ARGUMENT" },
  );
  assert.throws(
    (): IBlenderMeshOptions =>
      BlenderSceneProtocol.mesh({
        vertices: pyramid.vertices,
        faces: [...quads.slice(1), [0, 1, 2, 3, 4]],
      }),
    { code: "INVALID_ARGUMENT" },
  );

  const material: IBlenderMaterialOptions = {
    baseColorLinearRGB: [0, 1, 0.25],
  };
  const normalized: IBlenderMaterialOptions =
    BlenderMaterialProtocol.material(material);
  assert.deepEqual(normalized, {
    baseColorLinearRGB: [0, 1, 0.25],
    roughness: 0.5,
    metallic: 0,
  });
  normalized.baseColorLinearRGB[0] = 0.5;
  assert.equal(material.baseColorLinearRGB[0], 0);
  assert.equal(
    BlenderMaterialProtocol.material({ ...material, roughness: 1, metallic: 1 })
      .metallic,
    1,
  );
  for (const component of [-0.001, 1.001, NaN, Infinity]) {
    assert.throws(
      (): IBlenderMaterialOptions =>
        BlenderMaterialProtocol.material({
          baseColorLinearRGB: [component, 0, 0],
        }),
      { code: "INVALID_ARGUMENT" },
    );
    assert.throws(
      (): IBlenderMaterialOptions =>
        BlenderMaterialProtocol.material({ ...material, roughness: component }),
      { code: "INVALID_ARGUMENT" },
    );
    assert.throws(
      (): IBlenderMaterialOptions =>
        BlenderMaterialProtocol.material({ ...material, metallic: component }),
      { code: "INVALID_ARGUMENT" },
    );
  }
  const session: IBlenderSession = {
    protocolVersion: 1,
    sessionId: "bridge",
    generation: 3,
    blenderVersion: "5.2.0",
    capabilities: [],
  };
  const handle: IBlenderMaterialHandle = {
    sessionId: "bridge",
    generation: 3,
    materialId: "9007199254740993",
  };
  assert.deepEqual(BlenderMaterialProtocol.handle(handle, session), handle);
  assert.throws(
    (): IBlenderMaterialHandle =>
      BlenderMaterialProtocol.handle({ ...handle, generation: 2 }, session),
    { code: "STALE_HANDLE" },
  );
  assert.throws(
    (): IBlenderMaterialHandle =>
      BlenderMaterialProtocol.handle(
        { ...handle, sessionId: "other" },
        session,
      ),
    { code: "STALE_HANDLE" },
  );

  const placement: IBlenderCameraOptions = {
    location: [3, -4, 2],
    target: [0, 0, 1],
  };
  assert.deepEqual(BlenderCameraProtocol.camera(placement), {
    ...placement,
    lensMm: 50,
    clipStart: 0.1,
    clipEnd: 1000,
    setActive: false,
  });
  assert.equal(
    BlenderCameraProtocol.camera({
      ...placement,
      lensMm: 1,
      clipStart: 1e-6,
      clipEnd: 1e12,
      setActive: true,
    }).setActive,
    true,
  );
  assert.equal(
    BlenderCameraProtocol.camera({ ...placement, lensMm: 500 }).lensMm,
    500,
  );
  const invalidCameras: readonly IBlenderCameraOptions[] = [
    { ...placement, target: placement.location },
    { ...placement, location: [NaN, 0, 0] },
    { ...placement, lensMm: 0 },
    { ...placement, lensMm: 501 },
    { ...placement, clipStart: 1, clipEnd: 1 },
    { ...placement, clipStart: 1e-7 },
    { ...placement, clipEnd: 1e12 + 1 },
  ];
  for (const input of invalidCameras)
    assert.throws(
      (): IBlenderCameraOptions => BlenderCameraProtocol.camera(input),
      { code: "INVALID_ARGUMENT" },
    );
  assert.deepEqual(BlenderCameraProtocol.light(placement), {
    ...placement,
    colorLinearRGB: [1, 1, 1],
    powerWatts: 1000,
    size: 5,
  });
  assert.equal(
    BlenderCameraProtocol.light({ ...placement, powerWatts: 0, size: 1e-6 })
      .powerWatts,
    0,
  );
  assert.equal(
    BlenderCameraProtocol.light({ ...placement, powerWatts: 1e12, size: 1e6 })
      .size,
    1e6,
  );
  const invalidLights: readonly IBlenderAreaLightOptions[] = [
    { ...placement, target: placement.location },
    { ...placement, powerWatts: -1 },
    { ...placement, powerWatts: Infinity },
    { ...placement, powerWatts: 1e12 + 1 },
    { ...placement, size: 0 },
    { ...placement, size: 1e6 + 1 },
    { ...placement, colorLinearRGB: [1, 1, 1.01] },
  ];
  for (const input of invalidLights)
    assert.throws(
      (): IBlenderAreaLightOptions => BlenderCameraProtocol.light(input),
      { code: "INVALID_ARGUMENT" },
    );

  assert.deepEqual(BlenderSceneProtocol.query({}), { limit: 50 });
  const cursor: string = "한".repeat(341) + "a";
  assert.deepEqual(BlenderSceneProtocol.query({ limit: 100, cursor }), {
    limit: 100,
    cursor,
  });
  assert.equal(BlenderSceneProtocol.query({ limit: 1 }).limit, 1);
  for (const input of [
    { limit: 0 },
    { limit: 101 },
    { limit: 1.5 },
    { cursor: cursor + "a" },
  ])
    assert.throws((): IBlenderSceneQuery => BlenderSceneProtocol.query(input), {
      code: "INVALID_ARGUMENT",
    });
}
