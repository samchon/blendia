import { BlenderError } from "../BlenderError";
import type { IBlenderMaterialAssignment } from "../IBlenderMaterialAssignment";
import type { IBlenderMaterialHandle } from "../IBlenderMaterialHandle";
import type { IBlenderMaterialOptions } from "../IBlenderMaterialOptions";
import type { IBlenderMaterialSnapshot } from "../IBlenderMaterialSnapshot";
import type { IBlenderSession } from "../IBlenderSession";
import { BlenderValue as V } from "./BlenderValue";

/** Validate opaque material parameters and lifetime-bound assignment targets.
 *
 * @evidence contracts/common.md#principled-implementation Linear RGB and shader factors stay within zero through one; material UID strings and both assignment handles must match the current session and generation.
 * @evidence contracts/common.md#clear-and-simple-design Creation exposes only opaque Principled parameters and assignment exposes two exact handles; Python owns node construction and local single-user mesh eligibility.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Stale material references never fall back to names, and SDK validation never claims that a structural handle proves live ownership or permits editing shared mesh siblings.
 * @evidence contracts/common.md#meaningful-documentation Alpha is fixed to one, roughness defaults to 0.5 and metallic to zero; returned names and factors are native readback and assignment changes the whole eligible mesh.
 */
export class BlenderMaterialProtocol {
  /** Copy bounded opaque Principled inputs without exposing arbitrary node properties. */
  public static material(
    value: IBlenderMaterialOptions,
  ): IBlenderMaterialOptions {
    const r: Record<string, unknown> = V.record(value);
    const name: string | undefined = V.name(r.name);
    return {
      ...(name === undefined ? {} : { name }),
      baseColorLinearRGB: V.vector(r.baseColorLinearRGB, 0, 1),
      roughness: V.number(r.roughness === undefined ? 0.5 : r.roughness, 0, 1),
      metallic: V.number(r.metallic === undefined ? 0 : r.metallic, 0, 1),
    };
  }

  /** Validate material UID and require this exact session and data generation. */
  public static handle(
    value: unknown,
    session: IBlenderSession,
    code: string = "INVALID_ARGUMENT",
  ): IBlenderMaterialHandle {
    const r: Record<string, unknown> = V.record(value, code);
    const sessionId: string = V.text(r.sessionId, code);
    const generation: number = V.integer(
      r.generation,
      0,
      Number.MAX_SAFE_INTEGER,
      code,
    );
    const materialId: string = V.uid(r.materialId, code);
    if (sessionId !== session.sessionId || generation !== session.generation)
      throw new BlenderError(
        code === "INVALID_ARGUMENT" ? "STALE_HANDLE" : code,
        "Material belongs to another session or generation.",
      );
    return { sessionId, generation, materialId };
  }

  /** Validate both references; the producer independently enforces single-user local mesh ownership. */
  public static assignment(
    value: IBlenderMaterialAssignment,
    session: IBlenderSession,
  ): IBlenderMaterialAssignment {
    const r: Record<string, unknown> = V.record(value);
    return {
      object: V.object(r.object, session),
      material: this.handle(r.material, session),
    };
  }

  /** Read actual Blender-assigned name and opaque shader parameters. */
  public static snapshot(
    value: unknown,
    session: IBlenderSession,
  ): IBlenderMaterialSnapshot {
    const r: Record<string, unknown> = V.record(value, "INVALID_RESPONSE");
    return {
      handle: this.handle(r.handle, session, "INVALID_RESPONSE"),
      name: V.text(r.name, "INVALID_RESPONSE"),
      baseColorLinearRGB: V.vector(
        r.baseColorLinearRGB,
        0,
        1,
        "INVALID_RESPONSE",
      ),
      roughness: V.number(r.roughness, 0, 1, "INVALID_RESPONSE"),
      metallic: V.number(r.metallic, 0, 1, "INVALID_RESPONSE"),
    };
  }
}
