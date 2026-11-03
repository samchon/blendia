import { BlenderError } from "./BlenderError";
import type { BlenderRenderJob } from "./BlenderRenderJob";
import type { IBlenderAreaLightOptions } from "./IBlenderAreaLightOptions";
import type { IBlenderAreaLightSnapshot } from "./IBlenderAreaLightSnapshot";
import type { IBlenderArtifactChunk } from "./IBlenderArtifactChunk";
import type { IBlenderArtifactHandle } from "./IBlenderArtifactHandle";
import type { IBlenderArtifactReadOptions } from "./IBlenderArtifactReadOptions";
import type { IBlenderArtifactSaveOptions } from "./IBlenderArtifactSaveOptions";
import type { IBlenderCameraOptions } from "./IBlenderCameraOptions";
import type { IBlenderCameraSnapshot } from "./IBlenderCameraSnapshot";
import type { IBlenderConnectionOptions } from "./IBlenderConnectionOptions";
import type { IBlenderCubeOptions } from "./IBlenderCubeOptions";
import type { IBlenderMaterialAssignment } from "./IBlenderMaterialAssignment";
import type { IBlenderMaterialOptions } from "./IBlenderMaterialOptions";
import type { IBlenderMaterialSnapshot } from "./IBlenderMaterialSnapshot";
import type { IBlenderMeshOptions } from "./IBlenderMeshOptions";
import type { IBlenderMeshSnapshot } from "./IBlenderMeshSnapshot";
import type { IBlenderObjectHandle } from "./IBlenderObjectHandle";
import type { IBlenderObjectSnapshot } from "./IBlenderObjectSnapshot";
import type { IBlenderObjectTransform } from "./IBlenderObjectTransform";
import type { IBlenderRenderHandle } from "./IBlenderRenderHandle";
import type { IBlenderRenderOptions } from "./IBlenderRenderOptions";
import type { IBlenderSaveOptions } from "./IBlenderSaveOptions";
import type { IBlenderSavedFile } from "./IBlenderSavedFile";
import type { IBlenderSceneQuery } from "./IBlenderSceneQuery";
import type { IBlenderSceneSnapshot } from "./IBlenderSceneSnapshot";
import type { IBlenderSession } from "./IBlenderSession";
import { BlenderArtifactProtocol } from "./internal/BlenderArtifactProtocol";
import { BlenderCameraProtocol } from "./internal/BlenderCameraProtocol";
import { BlenderConnection } from "./internal/BlenderConnection";
import { BlenderMaterialProtocol } from "./internal/BlenderMaterialProtocol";
import { BlenderProtocol } from "./internal/BlenderProtocol";
import { BlenderRenderProtocol } from "./internal/BlenderRenderProtocol";
import { BlenderSceneProtocol } from "./internal/BlenderSceneProtocol";
import { BlenderValue } from "./internal/BlenderValue";

/**
 * Explicit async scene, native GUI render, and persistent-output operations on one exclusive bridge connection.
 *
 * @evidence contracts/common.md#principled-implementation Feature input codecs validate arguments before transmission and feature result codecs validate detached readback; object/material references require the current lifetime while render/artifact references require the same session.
 * @evidence contracts/common.md#clear-and-simple-design This facade composes feature codecs with one internal connection; the connection exclusively owns sockets, pending work, timeouts, and unknown-outcome handling.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing capabilities reject before transmission, mutations are never replayed, and a lost native start retains the caller's supplied render identity.
 * @evidence contracts/common.md#meaningful-documentation Scene mutation, native rendering, artifact retention, explicit file publication, and disconnect are separate operations with no transaction or cancellation promise.
 */
export class BlenderClient {
  /** The sole transport owner, shared by every feature operation. */
  private readonly connection: BlenderConnection;

  /** Only the authenticated factory can expose a client. */
  private constructor(connection: BlenderConnection) {
    this.connection = connection;
  }

  /** Authenticate loopback using explicit options or BLENDIA_PORT/BLENDIA_TOKEN; old baseline bridges remain supported. */
  public static async connect(
    options: IBlenderConnectionOptions = {},
  ): Promise<BlenderClient> {
    return new BlenderClient(await BlenderConnection.connect(options));
  }

  /** Copy the authenticated identity and advertised methods without exposing mutable transport state. */
  public get session(): IBlenderSession {
    return this.connection.session;
  }

  /** Create a cube with positive size at most 1e20 and return its actual assigned name. */
  public async createCube(
    options: IBlenderCubeOptions = {},
  ): Promise<IBlenderObjectSnapshot> {
    return this.connection.execute(
      "cube.create",
      BlenderProtocol.cube(options),
      true,
      (value: unknown, session: IBlenderSession): IBlenderObjectSnapshot =>
        BlenderProtocol.snapshot(value, session),
    );
  }

  /** Read fresh local properties for the exact object identity, without name fallback. */
  public async getObject(
    object: IBlenderObjectHandle,
  ): Promise<IBlenderObjectSnapshot> {
    const handle: IBlenderObjectHandle = BlenderValue.object(
      object,
      this.session,
    );
    return this.connection.execute(
      "object.get",
      { object: handle },
      false,
      (value: unknown, session: IBlenderSession): IBlenderObjectSnapshot =>
        this.objectResult(value, session, handle),
    );
  }

  /** Apply a nonempty local transform; XYZ Euler radians and finite absolute-1e20 components remain unchanged. */
  public async setTransform(
    update: IBlenderObjectTransform,
  ): Promise<IBlenderObjectSnapshot> {
    const r: Record<string, unknown> = BlenderValue.record(update);
    const object: IBlenderObjectHandle = BlenderValue.object(
      r.object,
      this.session,
    );
    return this.connection.execute(
      "object.setTransform",
      { object, ...BlenderProtocol.transform(update) },
      true,
      (value: unknown, session: IBlenderSession): IBlenderObjectSnapshot =>
        this.objectResult(value, session, object),
    );
  }

  /** Observe a current UID-ordered scene page; later pages may reflect intervening GUI changes. */
  public async inspectScene(
    query: IBlenderSceneQuery = {},
  ): Promise<IBlenderSceneSnapshot> {
    const params: IBlenderSceneQuery = BlenderSceneProtocol.query(query);
    return this.connection.execute(
      "scene.inspect",
      params,
      false,
      (value: unknown, session: IBlenderSession): IBlenderSceneSnapshot =>
        BlenderSceneProtocol.scene(
          value,
          session,
          params.limit === undefined ? 50 : params.limit,
        ),
    );
  }

  /** Create one bounded bulk mesh without silently repairing invalid topology. */
  public async createMesh(
    options: IBlenderMeshOptions,
  ): Promise<IBlenderMeshSnapshot> {
    const params: IBlenderMeshOptions = BlenderSceneProtocol.mesh(options);
    return this.connection.execute(
      "mesh.create",
      params,
      true,
      (value: unknown, session: IBlenderSession): IBlenderMeshSnapshot => {
        const result: IBlenderMeshSnapshot = BlenderSceneProtocol.meshSnapshot(
          value,
          session,
        );
        if (
          result.vertexCount !== params.vertices.length ||
          result.polygonCount !== params.faces.length
        )
          throw new BlenderError(
            "INVALID_RESPONSE",
            "Created topology differs from the requested mesh.",
          );
        return result;
      },
    );
  }

  /** Create an owned opaque Principled material from scene-linear RGB and bounded factors. */
  public async createMaterial(
    options: IBlenderMaterialOptions,
  ): Promise<IBlenderMaterialSnapshot> {
    return this.connection.execute(
      "material.create",
      BlenderMaterialProtocol.material(options),
      true,
      (value: unknown, session: IBlenderSession): IBlenderMaterialSnapshot =>
        BlenderMaterialProtocol.snapshot(value, session),
    );
  }

  /** Replace all material slots/face indices only on a local single-user bounded mesh; shared data is rejected. */
  public async assignMaterial(
    assignment: IBlenderMaterialAssignment,
  ): Promise<IBlenderObjectSnapshot> {
    const params: IBlenderMaterialAssignment =
      BlenderMaterialProtocol.assignment(assignment, this.session);
    return this.connection.execute(
      "object.assignMaterial",
      params,
      true,
      (value: unknown, session: IBlenderSession): IBlenderObjectSnapshot =>
        this.objectResult(value, session, params.object),
    );
  }

  /** Create an aimed unparented camera; setActive:true permanently selects it for subsequent render/save. */
  public async createCamera(
    options: IBlenderCameraOptions,
  ): Promise<IBlenderCameraSnapshot> {
    return this.connection.execute(
      "camera.create",
      BlenderCameraProtocol.camera(options),
      true,
      (value: unknown, session: IBlenderSession): IBlenderCameraSnapshot =>
        BlenderCameraProtocol.cameraSnapshot(value, session),
    );
  }

  /** Create an aimed square area light using scene-linear color and explicit world placement. */
  public async createAreaLight(
    options: IBlenderAreaLightOptions,
  ): Promise<IBlenderAreaLightSnapshot> {
    return this.connection.execute(
      "light.createArea",
      BlenderCameraProtocol.light(options),
      true,
      (value: unknown, session: IBlenderSession): IBlenderAreaLightSnapshot =>
        BlenderCameraProtocol.lightSnapshot(value, session),
    );
  }

  /** Start native GUI rendering with a caller-known UUID; response loss is not permission to repeat the start. */
  public async startRender(
    options: IBlenderRenderOptions,
  ): Promise<BlenderRenderJob> {
    const params: IBlenderRenderOptions =
      BlenderRenderProtocol.options(options);
    const handle: IBlenderRenderHandle = {
      sessionId: this.session.sessionId,
      renderId: params.renderId,
    };
    return this.connection.execute(
      "render.start",
      params,
      true,
      (value: unknown, session: IBlenderSession): BlenderRenderJob => {
        const result: BlenderRenderJob = BlenderRenderProtocol.job(
          value,
          session,
          handle,
        );
        if (
          result.width !== params.width ||
          result.height !== params.height ||
          result.startGeneration !== session.generation
        )
          throw new BlenderError(
            "INVALID_RESPONSE",
            "Render invocation differs from the requested settings.",
          );
        return result;
      },
    );
  }

  /** Observe native state, including after an explicit reconnect; this does not cancel or replay the render. */
  public async getRender(
    render: IBlenderRenderHandle,
  ): Promise<BlenderRenderJob> {
    const handle: IBlenderRenderHandle = BlenderRenderProtocol.handle(
      render,
      this.session,
    );
    return this.connection.execute(
      "render.get",
      { renderId: handle.renderId },
      false,
      (value: unknown, session: IBlenderSession): BlenderRenderJob =>
        BlenderRenderProtocol.job(value, session, handle),
    );
  }

  /** Read at most 192 KiB of canonical-base64 PNG data with validated offsets and EOF. */
  public async readArtifact(
    options: IBlenderArtifactReadOptions,
  ): Promise<IBlenderArtifactChunk> {
    const params: IBlenderArtifactReadOptions = BlenderArtifactProtocol.read(
      options,
      this.session,
    );
    return this.connection.execute(
      "artifact.read",
      {
        artifactId: params.artifact.artifactId,
        offset: params.offset,
        maxBytes: params.maxBytes,
      },
      false,
      (value: unknown): IBlenderArtifactChunk =>
        BlenderArtifactProtocol.chunk(value, params),
    );
  }

  /** Release one owned image; published user files and native rendering remain untouched. */
  public async releaseArtifact(
    artifact: IBlenderArtifactHandle,
  ): Promise<void> {
    const handle: IBlenderArtifactHandle = BlenderRenderProtocol.artifactHandle(
      artifact,
      this.session,
    );
    await this.connection.execute(
      "artifact.release",
      { artifactId: handle.artifactId },
      true,
      (value: unknown): void => BlenderArtifactProtocol.empty(value),
    );
  }

  /** Publish a private PNG at an explicit absolute destination; overwrite is false unless explicitly requested. */
  public async saveArtifact(
    options: IBlenderArtifactSaveOptions,
  ): Promise<IBlenderSavedFile> {
    const r: Record<string, unknown> = BlenderValue.record(options);
    const artifact: IBlenderArtifactHandle =
      BlenderRenderProtocol.artifactHandle(r.artifact, this.session);
    const destination: IBlenderSaveOptions = BlenderArtifactProtocol.save(
      options,
      ".png",
    );
    return this.connection.execute(
      "artifact.save",
      { artifactId: artifact.artifactId, ...destination },
      true,
      (value: unknown, session: IBlenderSession): IBlenderSavedFile =>
        BlenderArtifactProtocol.saved(value, session, destination, false),
    );
  }

  /** Save a native .blend copy with relative-path remapping while preserving the current working filepath; IO is outside undo. */
  public async saveBlendCopy(
    options: IBlenderSaveOptions,
  ): Promise<IBlenderSavedFile> {
    const destination: IBlenderSaveOptions = BlenderArtifactProtocol.save(
      options,
      ".blend",
    );
    return this.connection.execute(
      "scene.saveBlendCopy",
      destination,
      true,
      (value: unknown, session: IBlenderSession): IBlenderSavedFile =>
        BlenderArtifactProtocol.saved(value, session, destination, true),
    );
  }

  /** Release bridge ownership and close the socket without cancelling a native render or rolling back scene/file changes. */
  public async disconnect(): Promise<void> {
    await this.connection.disconnect();
  }

  /** A targeted operation must return that exact object, not another object from the same session. */
  private objectResult(
    value: unknown,
    session: IBlenderSession,
    expected: IBlenderObjectHandle,
  ): IBlenderObjectSnapshot {
    const result: IBlenderObjectSnapshot = BlenderProtocol.snapshot(
      value,
      session,
    );
    if (result.handle.objectId !== expected.objectId)
      throw new BlenderError(
        "INVALID_RESPONSE",
        "Object readback belongs to another target.",
      );
    return result;
  }
}
