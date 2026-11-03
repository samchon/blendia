import { BlenderError } from "../BlenderError";
import type { IBlenderCubeOptions } from "../IBlenderCubeOptions";
import type { IBlenderObjectHandle } from "../IBlenderObjectHandle";
import type { IBlenderObjectSnapshot } from "../IBlenderObjectSnapshot";
import type { IBlenderSession } from "../IBlenderSession";
import type { IBlenderTransform } from "../IBlenderTransform";
import type { IBlenderWireResponse } from "./IBlenderWireResponse";

/**
 * Validate the narrow bridge contract at the SDK boundary; values remain untrusted after JSON parsing.
 *
 * @evidence contracts/common.md#principled-implementation Methods check records, finite triples, safe generations, decimal identities, and response discriminants before returning typed data; Python independently validates mutation inputs.
 * @evidence contracts/common.md#clear-and-simple-design One codec serves the actual client; protocol details stay internal while public DTOs are shared with real consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No unchecked cast is used as a substitute for field validation; unknown fields are not promoted to capabilities.
 * @evidence contracts/common.md#meaningful-documentation Input failures use INVALID_ARGUMENT and malformed server values use INVALID_RESPONSE; local coordinates and Euler radians are preserved without conversion.
 * @evidence contracts/performance.md#efficient-algorithms Checks visit fixed field sets and identifier strings, with message memory already limited by the frame decoder.
 * @evidence contracts/performance.md#reuse-equivalent-work No validation cache is retained; identity checks depend on the current connection and generation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Methods return fresh small records and arrays; they own no socket, timer, or persistent state.
 */
export class BlenderProtocol {
  /**
   * Validate a complete response before request correlation and identity handling.
   *
   * @evidence contracts/common.md#principled-implementation Only a positive decimal id, boolean ok, optional valid identity, and one complete result or error arm are accepted.
   * @evidence contracts/common.md#clear-and-simple-design This validates the common envelope; method results are checked by session or snapshot.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Server error effects are mandatory and are not inferred from an error code.
   * @evidence contracts/common.md#meaningful-documentation Identity is optional for pre-authentication errors; the client requires it for successful authenticated replies.
   * @evidence contracts/performance.md#efficient-algorithms The envelope uses a fixed number of checks over a frame-bounded object.
   * @evidence contracts/performance.md#reuse-equivalent-work No response or id history is cached.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The returned view belongs to the active request and retains only its bounded parsed frame.
   */
  public static response(value: unknown): IBlenderWireResponse {
    const record: Record<string, unknown> = this.record(
      value,
      "INVALID_RESPONSE",
    );
    if (
      typeof record.id !== "string" ||
      !/^[1-9][0-9]{0,19}$/.test(record.id) ||
      (record.sessionId !== undefined &&
        (typeof record.sessionId !== "string" ||
          record.sessionId.length === 0)) ||
      (record.generation !== undefined && !this.generation(record.generation))
    )
      throw new BlenderError(
        "INVALID_RESPONSE",
        "Bridge response has invalid correlation or identity.",
      );
    if (
      record.ok === true &&
      Object.prototype.hasOwnProperty.call(record, "result")
    ) {
      if (Object.prototype.hasOwnProperty.call(record, "error"))
        throw new BlenderError(
          "INVALID_RESPONSE",
          "Bridge response contains both success and failure.",
        );
      return record as unknown as IBlenderWireResponse;
    }
    if (
      record.ok !== false ||
      Object.prototype.hasOwnProperty.call(record, "result")
    )
      throw new BlenderError(
        "INVALID_RESPONSE",
        "Bridge response must identify success or failure.",
      );
    const error: Record<string, unknown> = this.record(
      record.error,
      "INVALID_RESPONSE",
    );
    if (
      typeof error.code !== "string" ||
      error.code.length === 0 ||
      typeof error.message !== "string" ||
      (error.effects !== "none" && error.effects !== "possible")
    )
      throw new BlenderError(
        "INVALID_RESPONSE",
        "Bridge response has an invalid error.",
      );
    return record as unknown as IBlenderWireResponse;
  }

  /**
   * Validate the handshake's protocol version and copy its session metadata.
   *
   * @evidence contracts/common.md#principled-implementation Protocol version must be exactly one, generation a nonnegative safe integer, and every capability a string.
   * @evidence contracts/common.md#clear-and-simple-design Handshake data becomes the client's one session identity and capability set.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A mismatched protocol is rejected rather than translated or retried on another endpoint.
   * @evidence contracts/common.md#meaningful-documentation The result records the actual server version string without claiming API compatibility beyond advertised methods.
   * @evidence contracts/performance.md#efficient-algorithms Copying is linear in capability count and string storage.
   * @evidence contracts/performance.md#reuse-equivalent-work The resulting metadata is reused within one client, never across bridge sessions.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The copied capability array is owned by its recipient and retains no transport resources.
   */
  public static session(value: unknown): IBlenderSession {
    const record: Record<string, unknown> = this.record(
      value,
      "INVALID_RESPONSE",
    );
    if (record.protocolVersion !== 1)
      throw new BlenderError(
        "PROTOCOL_MISMATCH",
        "Bridge protocol version must be 1.",
      );
    if (
      typeof record.sessionId !== "string" ||
      record.sessionId.length === 0 ||
      !this.generation(record.generation) ||
      typeof record.blenderVersion !== "string" ||
      !Array.isArray(record.capabilities) ||
      !record.capabilities.every(
        (entry: unknown): entry is string => typeof entry === "string",
      )
    )
      throw new BlenderError(
        "INVALID_RESPONSE",
        "Bridge handshake has invalid session metadata.",
      );
    return {
      protocolVersion: 1,
      sessionId: record.sessionId,
      generation: record.generation,
      blenderVersion: record.blenderVersion,
      capabilities: [...record.capabilities],
    };
  }

  /**
   * Validate a fresh object snapshot and its connection-scoped handle.
   *
   * @evidence contracts/common.md#principled-implementation The result must contain a matching session and generation, decimal object identity, string name and type, and three finite local vectors.
   * @evidence contracts/common.md#clear-and-simple-design This is the single snapshot decoder used by create, get, and transform methods.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Malformed or foreign object data is rejected rather than asserted as a public snapshot.
   * @evidence contracts/common.md#meaningful-documentation Vectors remain local Blender properties and Euler radians; they are not transformed to world space.
   * @evidence contracts/performance.md#efficient-algorithms Validation checks a fixed number of fields and copies nine numbers plus bounded identity strings.
   * @evidence contracts/performance.md#reuse-equivalent-work No snapshot cache can become stale across mutations.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The returned arrays are independent of the parsed response; the caller owns them.
   */
  public static snapshot(
    value: unknown,
    session: IBlenderSession,
  ): IBlenderObjectSnapshot {
    const record: Record<string, unknown> = this.record(
      value,
      "INVALID_RESPONSE",
    );
    const handle: IBlenderObjectHandle = this.handle(
      record.handle,
      "INVALID_RESPONSE",
    );
    if (
      handle.sessionId !== session.sessionId ||
      handle.generation !== session.generation ||
      typeof record.name !== "string" ||
      typeof record.type !== "string" ||
      !this.vector(record.location) ||
      !this.vector(record.rotationEuler) ||
      !this.vector(record.scale)
    )
      throw new BlenderError(
        "INVALID_RESPONSE",
        "Bridge object snapshot is malformed or belongs to another data lifetime.",
      );
    return {
      handle,
      name: record.name,
      type: record.type,
      location: [...record.location],
      rotationEuler: [...record.rotationEuler],
      scale: [...record.scale],
    };
  }

  /**
   * Copy an object handle after validating its scalar identity fields.
   *
   * @evidence contracts/common.md#principled-implementation Session identity must be nonempty, generation a nonnegative safe integer, and objectId a positive decimal string of at most twenty digits.
   * @evidence contracts/common.md#clear-and-simple-design The client uses this validator for caller handles and server snapshots with distinct failure categories.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Object identity is never converted to a JavaScript number or replaced by a mutable name.
   * @evidence contracts/common.md#meaningful-documentation Structural validity does not prove the object exists; the live bridge performs fresh lookup and lifetime checks.
   * @evidence contracts/performance.md#efficient-algorithms Work is linear in identifier text length and otherwise constant.
   * @evidence contracts/performance.md#reuse-equivalent-work No lookup or handle cache is retained.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The returned record contains three scalars and acquires no Blender reference.
   */
  public static handle(
    value: unknown,
    code: "INVALID_ARGUMENT" | "INVALID_RESPONSE" = "INVALID_ARGUMENT",
  ): IBlenderObjectHandle {
    const record: Record<string, unknown> = this.record(value, code);
    if (
      typeof record.sessionId !== "string" ||
      record.sessionId.length === 0 ||
      !this.generation(record.generation) ||
      typeof record.objectId !== "string" ||
      !/^[1-9][0-9]{0,19}$/.test(record.objectId)
    )
      throw new BlenderError(
        code,
        "Object handle must contain a session, generation, and decimal object identity.",
      );
    return {
      sessionId: record.sessionId,
      generation: record.generation,
      objectId: record.objectId,
    };
  }

  /**
   * Validate cube creation parameters before any request is written.
   *
   * @evidence contracts/common.md#principled-implementation Only an optional nonempty name without NUL and an optional positive finite edge size up to 1e20 are copied into the request.
   * @evidence contracts/common.md#clear-and-simple-design Creation validation belongs at the client boundary and is repeated independently in Python.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Invalid numeric values cannot become JSON null and names are not rewritten to satisfy fixtures.
   * @evidence contracts/common.md#meaningful-documentation Absent size uses the server default of two Blender units; actual assigned names come from the response.
   * @evidence contracts/performance.md#efficient-algorithms Validation inspects two fields and scans the name once.
   * @evidence contracts/performance.md#reuse-equivalent-work Equal options do not share work because every call creates a distinct object.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The copied parameter record survives only encoding; created scene data belongs to Blender.
   */
  public static cube(value: IBlenderCubeOptions): IBlenderCubeOptions {
    const record: Record<string, unknown> = this.record(
      value,
      "INVALID_ARGUMENT",
    );
    if (
      record.name !== undefined &&
      (typeof record.name !== "string" ||
        record.name.length === 0 ||
        record.name.includes("\0"))
    )
      throw new BlenderError(
        "INVALID_ARGUMENT",
        "Cube name must be a nonempty string without NUL.",
      );
    if (
      record.size !== undefined &&
      (typeof record.size !== "number" ||
        !Number.isFinite(record.size) ||
        record.size <= 0 ||
        record.size > 1e20)
    )
      throw new BlenderError(
        "INVALID_ARGUMENT",
        "Cube size must be a positive finite number up to 1e20.",
      );
    return {
      ...(record.name === undefined ? {} : { name: record.name as string }),
      ...(record.size === undefined ? {} : { size: record.size as number }),
    };
  }

  /**
   * Validate and copy a nonempty partial local transform before transmission.
   *
   * @evidence contracts/common.md#principled-implementation Every provided field must be an array of exactly three finite numbers within absolute 1e20; at least one supported field is required.
   * @evidence contracts/common.md#clear-and-simple-design Validation completes before the client's mutation request is constructed.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unsupported extra fields cannot turn an empty update into an accepted mutation.
   * @evidence contracts/common.md#meaningful-documentation Translation and scale stay in local coordinates, and rotationEuler values stay XYZ radians without normalization.
   * @evidence contracts/performance.md#efficient-algorithms At most three triples are copied, so cost does not depend on scene size.
   * @evidence contracts/performance.md#reuse-equivalent-work No mutation result is cached or reused.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The returned arrays are request-owned and released after their frame is encoded.
   */
  public static transform(value: IBlenderTransform): IBlenderTransform {
    const record: Record<string, unknown> = this.record(
      value,
      "INVALID_ARGUMENT",
    );
    const result: IBlenderTransform = {};
    for (const key of ["location", "rotationEuler", "scale"] as const) {
      if (record[key] === undefined) continue;
      const vector: unknown = record[key];
      if (
        !this.vector(vector) ||
        vector.some((entry: number): boolean => Math.abs(entry) > 1e20)
      )
        throw new BlenderError(
          "INVALID_ARGUMENT",
          "Transform components must be finite triples within absolute 1e20.",
        );
      result[key] = [...vector];
    }
    if (Object.keys(result).length === 0)
      throw new BlenderError(
        "INVALID_ARGUMENT",
        "Transform must change location, rotationEuler, or scale.",
      );
    return result;
  }

  /** Reject arrays and null before inspecting object fields. */
  private static record(value: unknown, code: string): Record<string, unknown> {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new BlenderError(code, "Expected a protocol object.");
    return value as Record<string, unknown>;
  }

  /** A generation must round-trip exactly through JSON and JavaScript. */
  private static generation(value: unknown): value is number {
    return (
      typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    );
  }

  /** Blender transform components are fixed finite triples. */
  private static vector(value: unknown): value is [number, number, number] {
    return (
      Array.isArray(value) &&
      value.length === 3 &&
      value.every(
        (entry: unknown): boolean =>
          typeof entry === "number" && Number.isFinite(entry),
      )
    );
  }
}
