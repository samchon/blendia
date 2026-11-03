import type {
  IBlenderAreaLightOptions,
  IBlenderAreaLightSnapshot,
  IBlenderCameraOptions,
  IBlenderCameraSnapshot,
  IBlenderMaterialOptions,
  IBlenderMaterialSnapshot,
  IBlenderMeshOptions,
  IBlenderMeshSnapshot,
  IBlenderObjectSnapshot,
  IBlenderObjectTransform,
  IBlenderSceneSnapshot,
} from "@blendia/sdk";

import { BlendiaMcpError } from "./BlendiaMcpError";
import type { BlendiaMcpVector3 } from "./BlendiaMcpVector3";
import type { IBlendiaMcpAreaLightOptions } from "./IBlendiaMcpAreaLightOptions";
import type { IBlendiaMcpAreaLightSnapshot } from "./IBlendiaMcpAreaLightSnapshot";
import type { IBlendiaMcpCameraOptions } from "./IBlendiaMcpCameraOptions";
import type { IBlendiaMcpCameraSnapshot } from "./IBlendiaMcpCameraSnapshot";
import type { IBlendiaMcpMaterialOptions } from "./IBlendiaMcpMaterialOptions";
import type { IBlendiaMcpMaterialSnapshot } from "./IBlendiaMcpMaterialSnapshot";
import type { IBlendiaMcpMeshOptions } from "./IBlendiaMcpMeshOptions";
import type { IBlendiaMcpMeshSnapshot } from "./IBlendiaMcpMeshSnapshot";
import type { IBlendiaMcpObjectSnapshot } from "./IBlendiaMcpObjectSnapshot";
import type { IBlendiaMcpObjectTransform } from "./IBlendiaMcpObjectTransform";
import type { IBlendiaMcpSceneSnapshot } from "./IBlendiaMcpSceneSnapshot";

/** Explicit scene representation boundary between LLM arrays and strict SDK tuples.
 *
 * @evidence contracts/common.md#principled-implementation Every input vector is checked by indexed length and finite-number admission before a fresh exact-three SDK tuple is constructed; SDK bounds, identity and topology checks still run before transmission.
 * @evidence contracts/common.md#clear-and-simple-design The controller consumes these named conversions on all five tuple-bearing input paths and all nine tuple-bearing outputs, including inherited snapshots and every scene-page object.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No schema registry replacement, unknown type erasure, tuple assertion, truncation, coercion or SDK contract relaxation substitutes for the explicit representation conversion.
 * @evidence contracts/common.md#meaningful-documentation Public array tags describe three-component order; actual admission enforces it independently of whether a model follows that description, and snapshots retain native precision and identities.
 * @evidence contracts/performance.md#efficient-algorithms Conversion visits each admitted mesh coordinate and corner once and each returned page object once; mesh population and corner bounds are checked before copying their arrays.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The mapper retains no cache; fresh arrays and handles belong to a single call, with at most 8192 vertices, 8192 faces and 32768 corners admitted for mesh copying and SDK-bounded scene pages on output.
 */
export class BlendiaMcpSceneMapping {
  /** Reject missing indices, extra coordinates and nonfinite values without slicing or coercion. */
  public static vector(value: BlendiaMcpVector3): [number, number, number] {
    if (!Array.isArray(value) || value.length !== 3)
      throw new BlendiaMcpError(
        "INVALID_ARGUMENT",
        "Expected exactly three finite vector components.",
      );
    const x: number | undefined = value[0];
    const y: number | undefined = value[1];
    const z: number | undefined = value[2];
    if (
      typeof x !== "number" ||
      !Number.isFinite(x) ||
      typeof y !== "number" ||
      !Number.isFinite(y) ||
      typeof z !== "number" ||
      !Number.isFinite(z)
    )
      throw new BlendiaMcpError(
        "INVALID_ARGUMENT",
        "Expected exactly three finite vector components.",
      );
    return [x, y, z];
  }

  /** Preserve omitted components and identity while detaching every supplied vector. */
  public static transform(
    value: IBlendiaMcpObjectTransform,
  ): IBlenderObjectTransform {
    return {
      object: { ...value.object },
      location:
        value.location === undefined ? undefined : this.vector(value.location),
      rotationEuler:
        value.rotationEuler === undefined
          ? undefined
          : this.vector(value.rotationEuler),
      scale: value.scale === undefined ? undefined : this.vector(value.scale),
    };
  }

  /** Bound copying before constructing geometry; the SDK remains the topology validator. */
  public static meshOptions(
    value: IBlendiaMcpMeshOptions,
  ): IBlenderMeshOptions {
    if (
      !Array.isArray(value.vertices) ||
      value.vertices.length > 8192 ||
      !Array.isArray(value.faces) ||
      value.faces.length > 8192
    )
      throw new BlendiaMcpError(
        "INVALID_ARGUMENT",
        "Mesh exceeds its vertex or polygon bound.",
      );
    let corners: number = 0;
    for (const face of value.faces) {
      if (!Array.isArray(face) || face.length > 32768 - corners)
        throw new BlendiaMcpError(
          "INVALID_ARGUMENT",
          "Mesh exceeds its corner bound.",
        );
      corners += face.length;
    }
    return {
      name: value.name,
      vertices: Array.from(
        value.vertices,
        (vertex: BlendiaMcpVector3): [number, number, number] =>
          this.vector(vertex),
      ),
      faces: Array.from(value.faces, (face: number[]): number[] =>
        Array.from(face),
      ),
    };
  }

  /** Keep opaque RGB order; the SDK checks color and Principled intervals. */
  public static materialOptions(
    value: IBlendiaMcpMaterialOptions,
  ): IBlenderMaterialOptions {
    return {
      name: value.name,
      baseColorLinearRGB: this.vector(value.baseColorLinearRGB),
      roughness: value.roughness,
      metallic: value.metallic,
    };
  }

  /** Preserve camera defaults and active-camera intent for SDK validation. */
  public static cameraOptions(
    value: IBlendiaMcpCameraOptions,
  ): IBlenderCameraOptions {
    return {
      name: value.name,
      location: this.vector(value.location),
      target: this.vector(value.target),
      lensMm: value.lensMm,
      clipStart: value.clipStart,
      clipEnd: value.clipEnd,
      setActive: value.setActive,
    };
  }

  /** Preserve omitted white RGB and the native power/size contract. */
  public static areaLightOptions(
    value: IBlendiaMcpAreaLightOptions,
  ): IBlenderAreaLightOptions {
    return {
      name: value.name,
      location: this.vector(value.location),
      target: this.vector(value.target),
      colorLinearRGB:
        value.colorLinearRGB === undefined
          ? undefined
          : this.vector(value.colorLinearRGB),
      powerWatts: value.powerWatts,
      size: value.size,
    };
  }

  /** Detach local arrays without changing SDK-validated numbers or object identity. */
  public static object(
    value: IBlenderObjectSnapshot,
  ): IBlendiaMcpObjectSnapshot {
    return {
      handle: { ...value.handle },
      name: value.name,
      type: value.type,
      location: this.array(value.location),
      rotationEuler: this.array(value.rotationEuler),
      scale: this.array(value.scale),
    };
  }

  /** Retain actual mesh counts while converting inherited local properties. */
  public static mesh(value: IBlenderMeshSnapshot): IBlendiaMcpMeshSnapshot {
    return {
      ...this.object(value),
      vertexCount: value.vertexCount,
      edgeCount: value.edgeCount,
      polygonCount: value.polygonCount,
    };
  }

  /** Detach scene-linear RGB readback without rounding native precision. */
  public static material(
    value: IBlenderMaterialSnapshot,
  ): IBlendiaMcpMaterialSnapshot {
    return {
      handle: { ...value.handle },
      name: value.name,
      baseColorLinearRGB: this.array(value.baseColorLinearRGB),
      roughness: value.roughness,
      metallic: value.metallic,
    };
  }

  /** Retain actual camera parameters while converting inherited local properties. */
  public static camera(
    value: IBlenderCameraSnapshot,
  ): IBlendiaMcpCameraSnapshot {
    return {
      ...this.object(value),
      lensMm: value.lensMm,
      clipStart: value.clipStart,
      clipEnd: value.clipEnd,
      isActive: value.isActive,
    };
  }

  /** Convert both inherited local vectors and the light-specific RGB vector. */
  public static areaLight(
    value: IBlenderAreaLightSnapshot,
  ): IBlendiaMcpAreaLightSnapshot {
    return {
      ...this.object(value),
      colorLinearRGB: this.array(value.colorLinearRGB),
      powerWatts: value.powerWatts,
      size: value.size,
    };
  }

  /** Detach every page object and active-camera handle; cursor and generation semantics remain SDK-owned. */
  public static scene(value: IBlenderSceneSnapshot): IBlendiaMcpSceneSnapshot {
    return {
      sessionId: value.sessionId,
      generation: value.generation,
      sceneId: value.sceneId,
      sceneName: value.sceneName,
      frame: value.frame,
      activeCamera:
        value.activeCamera === null ? null : { ...value.activeCamera },
      objectCount: value.objectCount,
      objects: value.objects.map(
        (object: IBlenderObjectSnapshot): IBlendiaMcpObjectSnapshot =>
          this.object(object),
      ),
      nextCursor: value.nextCursor,
    };
  }

  /** SDK outputs are already validated; expose their coordinates as fresh LLM-supported arrays. */
  private static array(value: [number, number, number]): BlendiaMcpVector3 {
    return [value[0], value[1], value[2]];
  }
}
