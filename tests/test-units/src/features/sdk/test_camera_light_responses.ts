import assert from "node:assert/strict";

import type { IBlenderAreaLightSnapshot } from "../../../../../packages/sdk/src/IBlenderAreaLightSnapshot";
import type { IBlenderCameraSnapshot } from "../../../../../packages/sdk/src/IBlenderCameraSnapshot";
import type { IBlenderSession } from "../../../../../packages/sdk/src/IBlenderSession";
import { BlenderCameraProtocol } from "../../../../../packages/sdk/src/internal/BlenderCameraProtocol";

/**
 * Accept finite native camera/light precision while refusing foreign types and malformed readback.
 *
 * Scenarios:
 * 1. Camera readback preserves positive native values slightly outside input thresholds and ordered clipping.
 * 2. Area-light readback preserves finite native power/size and detached linear color and object vectors.
 * 3. Wrong object type, invalid optical/illumination values, and nonboolean camera activity fail.
 *
 * @evidence contracts/testing.md#behavioral-verification Call the production camera/light snapshot decoders used by BlenderClient; observe actual field preservation, copy ownership, and invalid-response failures without simulating bpy or calculating Blender quaternions.
 * @evidence contracts/testing.md#independent-expectations Native camera lens and clipping must be positive and ordered, light power nonnegative and size positive, and all readback numbers finite; native float rounding is not grounds to reapply narrower request thresholds, while linear RGB remains within zero through one.
 * @evidence contracts/testing.md#distinguishing-cases Cover rounded endpoint readback, active true/false, zero light power, detached vectors and handles, wrong native types, zero/nonfinite lens or size, equal/reversed clipping, nonboolean activity, negative power, and malformed colors; native aim and actual scene-camera selection remain engine observations.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this named first-party result-decoder case using explicit native-shaped values; no Blender process, SDK transport replacement, test-only helper, or upstream numerical test is added.
 */
export function test_camera_light_responses(): void {
  const session: IBlenderSession = {
    protocolVersion: 1,
    sessionId: "bridge",
    generation: 3,
    blenderVersion: "5.2.0",
    capabilities: [],
  };
  const camera: IBlenderCameraSnapshot = {
    handle: { sessionId: "bridge", generation: 3, objectId: "11" },
    name: "Camera",
    type: "CAMERA",
    location: [3, -4, 2],
    rotationEuler: [0.5, 0, 0.75],
    scale: [1, 1, 1],
    lensMm: 500.0000305175781,
    clipStart: 9.999999974752427e-7,
    clipEnd: 1000000061440,
    isActive: false,
  };
  const view: IBlenderCameraSnapshot = BlenderCameraProtocol.cameraSnapshot(
    camera,
    session,
  );
  assert.equal(view.lensMm, 500.0000305175781);
  assert.equal(view.clipStart, 9.999999974752427e-7);
  assert.equal(view.clipEnd, 1000000061440);
  assert.equal(view.isActive, false);
  assert.equal(
    BlenderCameraProtocol.cameraSnapshot({ ...camera, isActive: true }, session)
      .isActive,
    true,
  );
  view.location[0] = 99;
  view.rotationEuler[0] = 99;
  view.scale[0] = 99;
  view.handle.objectId = "9";
  assert.deepEqual(camera.location, [3, -4, 2]);
  assert.deepEqual(camera.rotationEuler, [0.5, 0, 0.75]);
  assert.deepEqual(camera.scale, [1, 1, 1]);
  assert.equal(camera.handle.objectId, "11");
  const invalidCameras: readonly unknown[] = [
    { ...camera, type: "MESH" },
    { ...camera, lensMm: 0 },
    { ...camera, lensMm: NaN },
    { ...camera, lensMm: Infinity },
    { ...camera, clipStart: 0 },
    { ...camera, clipStart: 2, clipEnd: 2 },
    { ...camera, clipStart: 3, clipEnd: 2 },
    { ...camera, clipEnd: Infinity },
    { ...camera, isActive: 0 },
    { ...camera, isActive: "false" },
    { ...camera, handle: { ...camera.handle, generation: 2 } },
  ];
  for (const value of invalidCameras)
    assert.throws(
      (): IBlenderCameraSnapshot =>
        BlenderCameraProtocol.cameraSnapshot(value, session),
      { code: "INVALID_RESPONSE", effects: "none" },
    );

  const light: IBlenderAreaLightSnapshot = {
    handle: { sessionId: "bridge", generation: 3, objectId: "12" },
    name: "Area",
    type: "LIGHT",
    location: [4, -2, 5],
    rotationEuler: [0.25, 0, 0.5],
    scale: [1, 1, 1],
    colorLinearRGB: [0, 0.25, 1],
    powerWatts: 1000000061440,
    size: 9.999999974752427e-7,
  };
  const illumination: IBlenderAreaLightSnapshot =
    BlenderCameraProtocol.lightSnapshot(light, session);
  assert.equal(illumination.powerWatts, 1000000061440);
  assert.equal(illumination.size, 9.999999974752427e-7);
  assert.equal(
    BlenderCameraProtocol.lightSnapshot({ ...light, powerWatts: 0 }, session)
      .powerWatts,
    0,
  );
  illumination.colorLinearRGB[1] = 1;
  illumination.location[0] = 99;
  illumination.handle.objectId = "9";
  assert.deepEqual(light.colorLinearRGB, [0, 0.25, 1]);
  assert.deepEqual(light.location, [4, -2, 5]);
  assert.equal(light.handle.objectId, "12");
  const invalidLights: readonly unknown[] = [
    { ...light, type: "CAMERA" },
    { ...light, size: 0 },
    { ...light, size: -1 },
    { ...light, size: NaN },
    { ...light, powerWatts: -1 },
    { ...light, powerWatts: Infinity },
    { ...light, colorLinearRGB: [0, 0.5] },
    { ...light, colorLinearRGB: [0, 1.001, 0] },
    { ...light, colorLinearRGB: [0, NaN, 0] },
    { ...light, handle: { ...light.handle, sessionId: "other" } },
  ];
  for (const value of invalidLights)
    assert.throws(
      (): IBlenderAreaLightSnapshot =>
        BlenderCameraProtocol.lightSnapshot(value, session),
      { code: "INVALID_RESPONSE", effects: "none" },
    );
}
