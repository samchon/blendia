import type {
  IBlenderAreaLightSnapshot,
  IBlenderCameraSnapshot,
  IBlenderMaterialSnapshot,
  IBlenderMeshSnapshot,
  IBlenderObjectSnapshot,
  IBlenderSceneSnapshot,
} from "@blendia/sdk";
import assert from "node:assert/strict";

import { BlendiaMcpSceneMapping } from "../../../../../packages/mcp/src/BlendiaMcpSceneMapping";
import type { BlendiaMcpVector3 } from "../../../../../packages/mcp/src/BlendiaMcpVector3";

/**
 * Convert public three-component arrays without repairing input or sharing SDK snapshot storage.
 *
 * Scenarios:
 * 1. Exactly three finite indexed components become a fresh SDK tuple with their order and precision intact.
 * 2. Missing indices, extra coordinates and nonfinite or nonnumeric components fail rather than being sliced or coerced.
 * 3. Transform, geometry, material, camera and light inputs detach their supplied vectors and retain omitted defaults.
 * 4. Nested scene and inherited mesh/camera/light snapshots retain identities and scalars while detaching arrays and handles.
 *
 * @evidence contracts/testing.md#behavioral-verification Invoke the actual mapper consumed by controller input and output paths, observing strict vector admission, detached SDK inputs and public snapshot copies without running a server or Blender.
 * @evidence contracts/testing.md#independent-expectations Literal ordered coordinates, unchanged optional fields and decimal identities define representation preservation independently of the mapper; reference inequality and mutation observations establish storage ownership rather than schema or generated-code snapshots.
 * @evidence contracts/testing.md#distinguishing-cases Cover zero and signed coordinates, wrong lengths, sparse indexed arrays, NaN and both infinities, all five input shapes, nested scene objects and nullable camera handles, inherited snapshot vectors and specialized scalar fields; SDK topology/world bounds and native geometry remain separate consumers.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this named first-party conversion unit through production methods; no typia/schema/reflection check, transport, fake SDK, handler, filesystem fixture or additional test-only API participates.
 */
export function test_scene_mapping(): void {
  const vector: BlendiaMcpVector3 = [-0, 1e20, -1e20];
  const tuple: ReturnType<typeof BlendiaMcpSceneMapping.vector> =
    BlendiaMcpSceneMapping.vector(vector);
  assert.deepEqual(tuple, [-0, 1e20, -1e20]);
  assert.notEqual(tuple, vector);
  tuple[1] = 7;
  assert.equal(vector[1], 1e20);

  const hole: BlendiaMcpVector3 = [0, 0, 0];
  delete hole[1];
  const nonnumeric: unknown = [0, "1", 0];
  const invalid: readonly BlendiaMcpVector3[] = [
    [],
    [0],
    [0, 0],
    [0, 0, 0, 0],
    new Array<number>(3),
    hole,
    [NaN, 0, 0],
    [0, Infinity, 0],
    [0, 0, -Infinity],
    nonnumeric as BlendiaMcpVector3,
  ];
  for (const input of invalid)
    assert.throws(
      (): ReturnType<typeof BlendiaMcpSceneMapping.vector> =>
        BlendiaMcpSceneMapping.vector(input),
      { code: "INVALID_ARGUMENT", effects: "none" },
    );

  const transform: Parameters<typeof BlendiaMcpSceneMapping.transform>[0] = {
    object: {
      sessionId: "bridge",
      generation: 4,
      objectId: "9007199254740993",
    },
    location: [1, -2, 3],
    rotationEuler: [0.1, 0.2, -0.3],
    scale: [0, -1, 2],
  };
  const sdkTransform: ReturnType<typeof BlendiaMcpSceneMapping.transform> =
    BlendiaMcpSceneMapping.transform(transform);
  assert.deepEqual(sdkTransform, transform);
  assert.notEqual(sdkTransform.object, transform.object);
  assert.notEqual(sdkTransform.location, transform.location);
  assert.notEqual(sdkTransform.rotationEuler, transform.rotationEuler);
  assert.notEqual(sdkTransform.scale, transform.scale);
  assert.ok(sdkTransform.location);
  sdkTransform.location[0] = 99;
  assert.deepEqual(transform.location, [1, -2, 3]);
  const omitted: ReturnType<typeof BlendiaMcpSceneMapping.transform> =
    BlendiaMcpSceneMapping.transform({ object: transform.object });
  assert.equal(omitted.location, undefined);
  assert.equal(omitted.rotationEuler, undefined);
  assert.equal(omitted.scale, undefined);

  const mesh: Parameters<typeof BlendiaMcpSceneMapping.meshOptions>[0] = {
    name: "Triangle",
    vertices: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ],
    faces: [[0, 1, 2]],
  };
  const sdkMesh: ReturnType<typeof BlendiaMcpSceneMapping.meshOptions> =
    BlendiaMcpSceneMapping.meshOptions(mesh);
  assert.deepEqual(sdkMesh, mesh);
  assert.notEqual(sdkMesh.vertices, mesh.vertices);
  assert.notEqual(sdkMesh.faces, mesh.faces);
  sdkMesh.vertices[1][0] = 10;
  sdkMesh.faces[0][0] = 2;
  assert.deepEqual(mesh.vertices[1], [1, 0, 0]);
  assert.deepEqual(mesh.faces[0], [0, 1, 2]);
  const sparseVertices: BlendiaMcpVector3[] = new Array<BlendiaMcpVector3>(1);
  assert.throws(
    (): ReturnType<typeof BlendiaMcpSceneMapping.meshOptions> =>
      BlendiaMcpSceneMapping.meshOptions({
        vertices: sparseVertices,
        faces: [],
      }),
    { code: "INVALID_ARGUMENT" },
  );

  const material: Parameters<typeof BlendiaMcpSceneMapping.materialOptions>[0] =
    {
      baseColorLinearRGB: [0, 0.25, 1],
    };
  const sdkMaterial: ReturnType<typeof BlendiaMcpSceneMapping.materialOptions> =
    BlendiaMcpSceneMapping.materialOptions(material);
  assert.deepEqual(sdkMaterial.baseColorLinearRGB, [0, 0.25, 1]);
  assert.notEqual(sdkMaterial.baseColorLinearRGB, material.baseColorLinearRGB);
  assert.equal(sdkMaterial.roughness, undefined);
  assert.equal(sdkMaterial.metallic, undefined);
  const camera: Parameters<typeof BlendiaMcpSceneMapping.cameraOptions>[0] = {
    location: [3, -4, 2],
    target: [0, 0, 1],
    setActive: true,
  };
  const sdkCamera: ReturnType<typeof BlendiaMcpSceneMapping.cameraOptions> =
    BlendiaMcpSceneMapping.cameraOptions(camera);
  assert.deepEqual(sdkCamera.location, [3, -4, 2]);
  assert.deepEqual(sdkCamera.target, [0, 0, 1]);
  assert.notEqual(sdkCamera.location, camera.location);
  assert.notEqual(sdkCamera.target, camera.target);
  assert.equal(sdkCamera.setActive, true);
  assert.equal(sdkCamera.lensMm, undefined);
  const light: Parameters<typeof BlendiaMcpSceneMapping.areaLightOptions>[0] = {
    location: [2, 3, 4],
    target: [0, 0, 0],
    colorLinearRGB: [0.5, 0.75, 1],
    powerWatts: 200,
  };
  const sdkLight: ReturnType<typeof BlendiaMcpSceneMapping.areaLightOptions> =
    BlendiaMcpSceneMapping.areaLightOptions(light);
  assert.deepEqual(sdkLight.colorLinearRGB, [0.5, 0.75, 1]);
  assert.notEqual(sdkLight.location, light.location);
  assert.notEqual(sdkLight.target, light.target);
  assert.notEqual(sdkLight.colorLinearRGB, light.colorLinearRGB);
  assert.equal(sdkLight.powerWatts, 200);
  assert.equal(sdkLight.size, undefined);
  assert.equal(
    BlendiaMcpSceneMapping.areaLightOptions(camera).colorLinearRGB,
    undefined,
  );

  const object: IBlenderObjectSnapshot = {
    handle: {
      sessionId: "bridge",
      generation: 4,
      objectId: "9007199254740993",
    },
    name: "Observed",
    type: "MESH",
    location: [1, -2, 3],
    rotationEuler: [0.1, 0.2, 0.3],
    scale: [1, 2, -1],
  };
  const meshSnapshot: IBlenderMeshSnapshot = {
    ...object,
    vertexCount: 3,
    edgeCount: 3,
    polygonCount: 1,
  };
  const cameraSnapshot: IBlenderCameraSnapshot = {
    ...object,
    type: "CAMERA",
    lensMm: 45,
    clipStart: 0.2,
    clipEnd: 500,
    isActive: true,
  };
  const lightSnapshot: IBlenderAreaLightSnapshot = {
    ...object,
    type: "LIGHT",
    colorLinearRGB: [0.125, 0.5, 1],
    powerWatts: 250,
    size: 3,
  };
  const mappedMesh: ReturnType<typeof BlendiaMcpSceneMapping.mesh> =
    BlendiaMcpSceneMapping.mesh(meshSnapshot);
  const mappedCamera: ReturnType<typeof BlendiaMcpSceneMapping.camera> =
    BlendiaMcpSceneMapping.camera(cameraSnapshot);
  const mappedLight: ReturnType<typeof BlendiaMcpSceneMapping.areaLight> =
    BlendiaMcpSceneMapping.areaLight(lightSnapshot);
  assert.deepEqual(mappedMesh, meshSnapshot);
  assert.deepEqual(mappedCamera, cameraSnapshot);
  assert.deepEqual(mappedLight, lightSnapshot);
  for (const mapped of [mappedMesh, mappedCamera, mappedLight]) {
    assert.notEqual(mapped.handle, object.handle);
    assert.notEqual(mapped.location, object.location);
    assert.notEqual(mapped.rotationEuler, object.rotationEuler);
    assert.notEqual(mapped.scale, object.scale);
    mapped.location[0] = 70;
    mapped.rotationEuler[1] = 80;
    mapped.scale[2] = 90;
    mapped.handle.objectId = "99";
  }
  assert.deepEqual(object.location, [1, -2, 3]);
  assert.deepEqual(object.rotationEuler, [0.1, 0.2, 0.3]);
  assert.deepEqual(object.scale, [1, 2, -1]);
  assert.equal(object.handle.objectId, "9007199254740993");
  mappedLight.colorLinearRGB[0] = 1;
  assert.deepEqual(lightSnapshot.colorLinearRGB, [0.125, 0.5, 1]);

  const materialSnapshot: IBlenderMaterialSnapshot = {
    handle: {
      sessionId: "bridge",
      generation: 4,
      materialId: "9007199254740995",
    },
    name: "ObservedMaterial",
    baseColorLinearRGB: [0.125, 0.25, 0.75],
    roughness: 0.4,
    metallic: 0.8,
  };
  const mappedMaterial: ReturnType<typeof BlendiaMcpSceneMapping.material> =
    BlendiaMcpSceneMapping.material(materialSnapshot);
  assert.deepEqual(mappedMaterial, materialSnapshot);
  mappedMaterial.baseColorLinearRGB[0] = 1;
  mappedMaterial.handle.materialId = "100";
  assert.deepEqual(materialSnapshot.baseColorLinearRGB, [0.125, 0.25, 0.75]);
  assert.equal(materialSnapshot.handle.materialId, "9007199254740995");

  const sceneCamera: IBlenderObjectSnapshot = {
    ...object,
    type: "CAMERA",
    handle: { ...object.handle, objectId: "9007199254740997" },
  };
  const scene: IBlenderSceneSnapshot = {
    sessionId: "bridge",
    generation: 4,
    sceneId: "17",
    sceneName: "Scene",
    frame: 9,
    activeCamera: sceneCamera.handle,
    objectCount: 2,
    objects: [object, sceneCamera],
    nextCursor: "continue-here",
  };
  const mappedScene: ReturnType<typeof BlendiaMcpSceneMapping.scene> =
    BlendiaMcpSceneMapping.scene(scene);
  assert.deepEqual(mappedScene, scene);
  assert.notEqual(mappedScene.objects, scene.objects);
  assert.notEqual(mappedScene.activeCamera, scene.activeCamera);
  assert.notEqual(mappedScene.objects[0], scene.objects[0]);
  assert.notEqual(mappedScene.objects[1].location, scene.objects[1].location);
  mappedScene.objects[0].location[0] = 12;
  mappedScene.objects[1].scale[0] = 13;
  assert.ok(mappedScene.activeCamera);
  mappedScene.activeCamera.objectId = "101";
  assert.deepEqual(scene.objects[0].location, [1, -2, 3]);
  assert.deepEqual(scene.objects[1].scale, [1, 2, -1]);
  assert.equal(scene.activeCamera?.objectId, "9007199254740997");
  const empty: ReturnType<typeof BlendiaMcpSceneMapping.scene> =
    BlendiaMcpSceneMapping.scene({
      ...scene,
      activeCamera: null,
      objects: [],
      nextCursor: null,
    });
  assert.equal(empty.activeCamera, null);
  assert.deepEqual(empty.objects, []);
  assert.equal(empty.nextCursor, null);
}
