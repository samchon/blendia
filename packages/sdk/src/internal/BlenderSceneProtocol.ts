import { BlenderError } from "../BlenderError";
import type { IBlenderMeshOptions } from "../IBlenderMeshOptions";
import type { IBlenderMeshSnapshot } from "../IBlenderMeshSnapshot";
import type { IBlenderObjectSnapshot } from "../IBlenderObjectSnapshot";
import type { IBlenderSceneQuery } from "../IBlenderSceneQuery";
import type { IBlenderSceneSnapshot } from "../IBlenderSceneSnapshot";
import type { IBlenderSession } from "../IBlenderSession";
import { BlenderProtocol } from "./BlenderProtocol";
import { BlenderValue as V } from "./BlenderValue";

/** Validate bounded scene pages and bulk mesh data before real client requests.
 *
 * @evidence contracts/common.md#principled-implementation Vertex, polygon, and corner limits are checked before copying; every face index is a distinct safe integer in range, and readback binds UID-ordered pages to the current session and generation.
 * @evidence contracts/common.md#clear-and-simple-design One bulk mesh request replaces per-vertex RPC; an opaque cursor remains the producer's continuation while this codec validates only bounded query and page data.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Sparse or invalid coordinates and indices are rejected instead of becoming JSON null; topology counts are checked and no repair or manifoldness is inferred.
 * @evidence contracts/performance.md#efficient-algorithms Bulk validation visits each supplied vertex and corner once, using a per-face Set for duplicate indices instead of pairwise scans; scene readback validates at most the requested 100 snapshots.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Each invocation owns detached copies bounded by 8192 vertices, 8192 polygons, and 32768 corners; face sets and page copies are not retained in a client cache.
 * @evidence contracts/common.md#meaningful-documentation Empty and points-only meshes are allowed; page observations are fresh rather than a consistent cross-page snapshot, and input magnitude limits are distinct from finite native readback.
 */
export class BlenderSceneProtocol {
  /** Normalize only the bounded query fields understood by the live producer. */
  public static query(value: IBlenderSceneQuery): IBlenderSceneQuery {
    const r: Record<string, unknown> = V.record(value);
    const limit: number = V.integer(
      r.limit === undefined ? 50 : r.limit,
      1,
      100,
    );
    if (r.cursor === undefined) return { limit };
    const cursor: string = V.text(r.cursor);
    if (Buffer.byteLength(cursor, "utf8") > 1024)
      throw new BlenderError(
        "INVALID_ARGUMENT",
        "Scene cursor exceeds 1024 bytes.",
      );
    return { limit, cursor };
  }

  /** Bound topology work and copy every coordinate/index before any mutation is sent. */
  public static mesh(value: IBlenderMeshOptions): IBlenderMeshOptions {
    const r: Record<string, unknown> = V.record(value);
    const name: string | undefined = V.name(r.name);
    if (
      !Array.isArray(r.vertices) ||
      r.vertices.length > 8192 ||
      !Array.isArray(r.faces) ||
      r.faces.length > 8192
    )
      throw new BlenderError(
        "INVALID_ARGUMENT",
        "Mesh exceeds its vertex or polygon bound.",
      );
    const vertices: [number, number, number][] = Array.from(
      r.vertices,
      (vertex: unknown): [number, number, number] => V.vector(vertex),
    );
    const faces: number[][] = [];
    let corners: number = 0;
    for (const polygon of r.faces) {
      if (
        !Array.isArray(polygon) ||
        polygon.length < 3 ||
        polygon.length > 32768 - corners
      )
        throw new BlenderError(
          "INVALID_ARGUMENT",
          "Mesh faces require at least three indices within the total corner bound.",
        );
      corners += polygon.length;
      const indices: number[] = Array.from(polygon, (index: unknown): number =>
        V.integer(index, 0, vertices.length - 1),
      );
      if (new Set(indices).size !== indices.length)
        throw new BlenderError(
          "INVALID_ARGUMENT",
          "A face cannot repeat a vertex index.",
        );
      faces.push(indices);
    }
    return { ...(name === undefined ? {} : { name }), vertices, faces };
  }

  /** Read counts independently of the finite transform snapshot. */
  public static meshSnapshot(
    value: unknown,
    session: IBlenderSession,
  ): IBlenderMeshSnapshot {
    const r: Record<string, unknown> = V.record(value, "INVALID_RESPONSE");
    const object: IBlenderObjectSnapshot = BlenderProtocol.snapshot(
      value,
      session,
    );
    if (object.type !== "MESH")
      throw new BlenderError(
        "INVALID_RESPONSE",
        "Created mesh snapshot is not a mesh.",
      );
    return {
      ...object,
      vertexCount: V.integer(r.vertexCount, 0, 8192, "INVALID_RESPONSE"),
      edgeCount: V.integer(r.edgeCount, 0, 32768, "INVALID_RESPONSE"),
      polygonCount: V.integer(r.polygonCount, 0, 8192, "INVALID_RESPONSE"),
    };
  }

  /** Verify page identity, UID ordering, page size, and continuation before exposing observations. */
  public static scene(
    value: unknown,
    session: IBlenderSession,
    limit: number,
  ): IBlenderSceneSnapshot {
    const r: Record<string, unknown> = V.record(value, "INVALID_RESPONSE");
    if (
      r.sessionId !== session.sessionId ||
      r.generation !== session.generation ||
      !Array.isArray(r.objects) ||
      r.objects.length > limit
    )
      throw new BlenderError(
        "INVALID_RESPONSE",
        "Scene page has invalid identity or size.",
      );
    const objects: IBlenderObjectSnapshot[] = Array.from(
      r.objects,
      (object: unknown): IBlenderObjectSnapshot =>
        BlenderProtocol.snapshot(object, session),
    );
    let previous: bigint = 0n;
    for (const object of objects) {
      const current: bigint = BigInt(object.handle.objectId);
      if (current <= previous)
        throw new BlenderError(
          "INVALID_RESPONSE",
          "Scene page is not strictly UID ordered.",
        );
      previous = current;
    }
    const objectCount: number = V.integer(
      r.objectCount,
      objects.length,
      Number.MAX_SAFE_INTEGER,
      "INVALID_RESPONSE",
    );
    const nextCursor: string | null =
      r.nextCursor === null ? null : V.text(r.nextCursor, "INVALID_RESPONSE");
    if (
      nextCursor !== null &&
      (Buffer.byteLength(nextCursor, "utf8") > 1024 || objects.length === 0)
    )
      throw new BlenderError(
        "INVALID_RESPONSE",
        "Scene continuation is invalid.",
      );
    return {
      sessionId: session.sessionId,
      generation: session.generation,
      sceneId: V.uid(r.sceneId),
      sceneName: V.text(r.sceneName, "INVALID_RESPONSE"),
      frame: V.integer(
        r.frame,
        -Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
        "INVALID_RESPONSE",
      ),
      activeCamera:
        r.activeCamera === null
          ? null
          : V.object(r.activeCamera, session, "INVALID_RESPONSE"),
      objectCount,
      objects,
      nextCursor,
    };
  }
}
