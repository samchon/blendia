import { BlenderError } from "../BlenderError";
import type { IBlenderObjectHandle } from "../IBlenderObjectHandle";
import type { IBlenderSession } from "../IBlenderSession";
import { BlenderProtocol } from "./BlenderProtocol";

/** Shared scalar checks used by the actual scene, render, and artifact boundaries. */
export class BlenderValue {
  /** Reject null and arrays before reading protocol fields. */
  public static record(
    value: unknown,
    code: string = "INVALID_ARGUMENT",
  ): Record<string, unknown> {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new BlenderError(code, "Expected an object.");
    return value as Record<string, unknown>;
  }

  /** Require a nonempty string without NUL rather than stringify arbitrary values. */
  public static text(
    value: unknown,
    code: string = "INVALID_ARGUMENT",
  ): string {
    if (typeof value !== "string" || value.length === 0 || value.includes("\0"))
      throw new BlenderError(code, "Expected a nonempty string without NUL.");
    return value;
  }

  /** Preserve omitted optional names without accepting null or empty names. */
  public static name(value: unknown): string | undefined {
    return value === undefined ? undefined : this.text(value);
  }

  /** Require a finite scalar within the declared inclusive range. */
  public static number(
    value: unknown,
    min: number,
    max: number,
    code: string = "INVALID_ARGUMENT",
  ): number {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < min ||
      value > max
    )
      throw new BlenderError(
        code,
        "Numeric field is outside its supported finite range.",
      );
    return value;
  }

  /** Integers must round-trip without JSON precision loss. */
  public static integer(
    value: unknown,
    min: number,
    max: number,
    code: string = "INVALID_ARGUMENT",
  ): number {
    const result: number = this.number(value, min, max, code);
    if (!Number.isSafeInteger(result))
      throw new BlenderError(code, "Expected a safe integer.");
    return result;
  }

  /** Copy exactly three finite coordinates, optionally with a narrower component interval. */
  public static vector(
    value: unknown,
    min: number = -1e20,
    max: number = 1e20,
    code: string = "INVALID_ARGUMENT",
  ): [number, number, number] {
    if (!Array.isArray(value) || value.length !== 3)
      throw new BlenderError(code, "Expected a three-component vector.");
    return [
      this.number(value[0], min, max, code),
      this.number(value[1], min, max, code),
      this.number(value[2], min, max, code),
    ];
  }

  /** Boolean values are never inferred from truthiness. */
  public static boolean(
    value: unknown,
    code: string = "INVALID_ARGUMENT",
  ): boolean {
    if (typeof value !== "boolean")
      throw new BlenderError(code, "Expected a boolean.");
    return value;
  }

  /** Blender UID strings retain their decimal precision. */
  public static uid(value: unknown, code: string = "INVALID_RESPONSE"): string {
    const result: string = this.text(value, code);
    if (!/^[1-9][0-9]{0,19}$/.test(result))
      throw new BlenderError(
        code,
        "Expected a positive decimal Blender identity.",
      );
    return result;
  }

  /** Canonical UUID spelling lets the caller retain one unambiguous start identity. */
  public static uuid(
    value: unknown,
    code: string = "INVALID_ARGUMENT",
  ): string {
    const result: string = this.text(value, code);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        result,
      )
    )
      throw new BlenderError(code, "Expected a canonical lower-case UUID.");
    return result;
  }

  /** A session mismatch never retargets an operation to an identically named object. */
  public static object(
    value: unknown,
    session: IBlenderSession,
    code: "INVALID_ARGUMENT" | "INVALID_RESPONSE" = "INVALID_ARGUMENT",
  ): IBlenderObjectHandle {
    const handle: IBlenderObjectHandle = BlenderProtocol.handle(value, code);
    if (
      handle.sessionId !== session.sessionId ||
      handle.generation !== session.generation
    )
      throw new BlenderError(
        code === "INVALID_ARGUMENT" ? "STALE_HANDLE" : code,
        "Object belongs to another session or generation.",
      );
    return handle;
  }

  /** Require a UTC ISO timestamp instead of accepting arbitrary date coercion. */
  public static timestamp(value: unknown): string {
    const result: string = this.text(value, "INVALID_RESPONSE");
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/.test(
        result,
      ) ||
      !Number.isFinite(Date.parse(result))
    )
      throw new BlenderError(
        "INVALID_RESPONSE",
        "Expected a UTC ISO timestamp.",
      );
    return result;
  }
}
