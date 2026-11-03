import { BlenderError } from "../BlenderError";
import type { IBlenderAreaLightOptions } from "../IBlenderAreaLightOptions";
import type { IBlenderAreaLightSnapshot } from "../IBlenderAreaLightSnapshot";
import type { IBlenderCameraOptions } from "../IBlenderCameraOptions";
import type { IBlenderCameraSnapshot } from "../IBlenderCameraSnapshot";
import type { IBlenderObjectSnapshot } from "../IBlenderObjectSnapshot";
import type { IBlenderSession } from "../IBlenderSession";
import { BlenderProtocol } from "./BlenderProtocol";
import { BlenderValue as V } from "./BlenderValue";

/** Validate explicit camera and area-light creation with no generic property setters.
 *
 * @evidence contracts/common.md#principled-implementation Finite world vectors, distinct targets, ordered clipping planes, explicit numeric limits, and actual boolean active-camera selection are checked before transmission.
 * @evidence contracts/common.md#clear-and-simple-design Camera and area-light creation share scalar placement checks while Blender owns quaternion tracking; local object transforms remain a separate baseline operation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Invalid inputs are not clamped or truthiness-coerced; readback accepts native float precision instead of falsely rejecting rounded values at input thresholds.
 * @evidence contracts/common.md#meaningful-documentation New objects are unparented, camera selection persists only when requested, and readback checks the native CAMERA or LIGHT object type before exposing camera or illumination fields.
 */
export class BlenderCameraProtocol {
  /** Validate world placement and persistent active-camera selection before transmission. */
  public static camera(value: IBlenderCameraOptions): IBlenderCameraOptions {
    const r: Record<string, unknown> = V.record(value);
    const name: string | undefined = V.name(r.name);
    const location: [number, number, number] = V.vector(r.location);
    const target: [number, number, number] = V.vector(r.target);
    this.distinct(location, target);
    const clipStart: number = V.number(
      r.clipStart === undefined ? 0.1 : r.clipStart,
      1e-6,
      1e12,
    );
    const clipEnd: number = V.number(
      r.clipEnd === undefined ? 1000 : r.clipEnd,
      1e-6,
      1e12,
    );
    if (clipStart >= clipEnd)
      throw new BlenderError(
        "INVALID_ARGUMENT",
        "Camera clipping distances must increase.",
      );
    return {
      ...(name === undefined ? {} : { name }),
      location,
      target,
      lensMm: V.number(r.lensMm === undefined ? 50 : r.lensMm, 1, 500),
      clipStart,
      clipEnd,
      setActive: r.setActive === undefined ? false : V.boolean(r.setActive),
    };
  }

  /** Reject zero direction without reimplementing Blender's tracking quaternion. */
  private static distinct(
    location: [number, number, number],
    target: [number, number, number],
  ): void {
    if (
      location.every(
        (component: number, index: number): boolean =>
          component === target[index],
      )
    )
      throw new BlenderError(
        "INVALID_ARGUMENT",
        "Location and target must differ.",
      );
  }

  /** Validate linear illumination parameters and copy the shared placement convention. */
  public static light(
    value: IBlenderAreaLightOptions,
  ): IBlenderAreaLightOptions {
    const r: Record<string, unknown> = V.record(value);
    const name: string | undefined = V.name(r.name);
    const location: [number, number, number] = V.vector(r.location);
    const target: [number, number, number] = V.vector(r.target);
    this.distinct(location, target);
    return {
      ...(name === undefined ? {} : { name }),
      location,
      target,
      colorLinearRGB: V.vector(
        r.colorLinearRGB === undefined ? [1, 1, 1] : r.colorLinearRGB,
        0,
        1,
      ),
      powerWatts: V.number(
        r.powerWatts === undefined ? 1000 : r.powerWatts,
        0,
        1e12,
      ),
      size: V.number(r.size === undefined ? 5 : r.size, 1e-6, 1e6),
    };
  }

  /** Accept finite native float readback rather than reapplying rounded input thresholds. */
  public static cameraSnapshot(
    value: unknown,
    session: IBlenderSession,
  ): IBlenderCameraSnapshot {
    const r: Record<string, unknown> = V.record(value, "INVALID_RESPONSE");
    const object: IBlenderObjectSnapshot = BlenderProtocol.snapshot(
      value,
      session,
    );
    const lensMm: number = V.number(
      r.lensMm,
      0,
      Number.MAX_VALUE,
      "INVALID_RESPONSE",
    );
    const clipStart: number = V.number(
      r.clipStart,
      0,
      Number.MAX_VALUE,
      "INVALID_RESPONSE",
    );
    const clipEnd: number = V.number(
      r.clipEnd,
      0,
      Number.MAX_VALUE,
      "INVALID_RESPONSE",
    );
    if (
      object.type !== "CAMERA" ||
      lensMm <= 0 ||
      clipStart <= 0 ||
      clipStart >= clipEnd
    )
      throw new BlenderError("INVALID_RESPONSE", "Camera readback is invalid.");
    return {
      ...object,
      lensMm,
      clipStart,
      clipEnd,
      isActive: V.boolean(r.isActive, "INVALID_RESPONSE"),
    };
  }

  /** Native float precision is preserved in returned illumination values. */
  public static lightSnapshot(
    value: unknown,
    session: IBlenderSession,
  ): IBlenderAreaLightSnapshot {
    const r: Record<string, unknown> = V.record(value, "INVALID_RESPONSE");
    const object: IBlenderObjectSnapshot = BlenderProtocol.snapshot(
      value,
      session,
    );
    const size: number = V.number(
      r.size,
      0,
      Number.MAX_VALUE,
      "INVALID_RESPONSE",
    );
    if (object.type !== "LIGHT" || size <= 0)
      throw new BlenderError(
        "INVALID_RESPONSE",
        "Area-light readback is invalid.",
      );
    return {
      ...object,
      colorLinearRGB: V.vector(r.colorLinearRGB, 0, 1, "INVALID_RESPONSE"),
      powerWatts: V.number(
        r.powerWatts,
        0,
        Number.MAX_VALUE,
        "INVALID_RESPONSE",
      ),
      size,
    };
  }
}
