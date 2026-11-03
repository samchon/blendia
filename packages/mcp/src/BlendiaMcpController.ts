import {
  type IBlenderDiscoveryOptions,
  type IBlenderDiscoveryResult,
  type IProjectDoctorOptions,
  type IProjectDoctorReport,
  type IScriptJobSnapshot,
  type IScriptLogPage,
  discoverBlenderSessions,
  doctorProject,
} from "@blendia/runtime";
import type {
  BlenderRenderJob,
  IBlenderArtifactChunk,
  IBlenderArtifactHandle,
  IBlenderArtifactReadOptions,
  IBlenderArtifactSaveOptions,
  IBlenderCubeOptions,
  IBlenderMaterialAssignment,
  IBlenderObjectHandle,
  IBlenderRenderHandle,
  IBlenderRenderOptions,
  IBlenderSaveOptions,
  IBlenderSavedFile,
  IBlenderSceneQuery,
  IBlenderSession,
} from "@blendia/sdk";

import { BlendiaMcpContext } from "./BlendiaMcpContext";
import { BlendiaMcpSceneMapping } from "./BlendiaMcpSceneMapping";
import type { IBlendiaMcpAreaLightOptions } from "./IBlendiaMcpAreaLightOptions";
import type { IBlendiaMcpAreaLightSnapshot } from "./IBlendiaMcpAreaLightSnapshot";
import type { IBlendiaMcpCameraOptions } from "./IBlendiaMcpCameraOptions";
import type { IBlendiaMcpCameraSnapshot } from "./IBlendiaMcpCameraSnapshot";
import type { IBlendiaMcpHeadlessOptions } from "./IBlendiaMcpHeadlessOptions";
import type { IBlendiaMcpHeadlessResult } from "./IBlendiaMcpHeadlessResult";
import type { IBlendiaMcpImageResult } from "./IBlendiaMcpImageResult";
import type { IBlendiaMcpJobReference } from "./IBlendiaMcpJobReference";
import type { IBlendiaMcpLogQuery } from "./IBlendiaMcpLogQuery";
import type { IBlendiaMcpMaterialOptions } from "./IBlendiaMcpMaterialOptions";
import type { IBlendiaMcpMaterialSnapshot } from "./IBlendiaMcpMaterialSnapshot";
import type { IBlendiaMcpMeshOptions } from "./IBlendiaMcpMeshOptions";
import type { IBlendiaMcpMeshSnapshot } from "./IBlendiaMcpMeshSnapshot";
import type { IBlendiaMcpObjectSnapshot } from "./IBlendiaMcpObjectSnapshot";
import type { IBlendiaMcpObjectTransform } from "./IBlendiaMcpObjectTransform";
import type { IBlendiaMcpResult } from "./IBlendiaMcpResult";
import type { IBlendiaMcpSceneSnapshot } from "./IBlendiaMcpSceneSnapshot";
import type { IBlendiaMcpScriptOptions } from "./IBlendiaMcpScriptOptions";

/** Generated model-tool application over the existing SDK and captured runtime, with no public credentials or private configuration.
 *
 * @evidence contracts/common.md#principled-implementation Explicit connect uses private factory options; SDK methods preserve validated identities and effects, jobs hand off the writer lease, and image metadata is observed only from real succeeded renders.
 * @evidence contracts/common.md#clear-and-simple-design Each declared method delegates to the same SDK/runtime producers as CLI and TypeScript; native rendering, captured script jobs, and owned headless execution keep their original lifetimes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No arbitrary Python/filesystem read, hidden reconnect, automatic replay, fake process cancel, or durable URI for an exited headless bridge is introduced.
 * @evidence contracts/common.md#meaningful-documentation Typed success/error envelopes retain code/effects, caller render UUID survives unknown outcomes, and model-facing arguments omit connection credentials and headless infrastructure settings.
 */
export class BlendiaMcpController {
  /** Private server-owned resource and credential lifetime; not part of tool schemas. */
  private readonly context: BlendiaMcpContext;

  /** Share the actual lifetime owner with server close without exposing cleanup as a model tool. */
  public constructor(context: BlendiaMcpContext) {
    this.context = context;
  }

  /** Explicitly connect or reconnect to the privately configured live bridge; never replays scene work. */
  public async connect(): Promise<IBlendiaMcpResult<IBlenderSession>> {
    return this.context.execute((): Promise<IBlenderSession> =>
      this.context.connect(),
    );
  }

  /** Observe an existing authenticated connection; call connect explicitly when absent or failed. */
  public async getSession(): Promise<IBlendiaMcpResult<IBlenderSession>> {
    return this.context.execute(
      (): IBlenderSession => this.context.current().session,
    );
  }

  /** Release only the SDK writer lease; native renders and artifacts are not cancelled or retired. */
  public async disconnect(): Promise<IBlendiaMcpResult<null>> {
    return this.context.execute((): Promise<null> => this.context.disconnect());
  }

  /** Create a cube through the actual SDK; invalid or oversized requests are rejected. */
  public async createCube(
    options: IBlenderCubeOptions,
  ): Promise<IBlendiaMcpResult<IBlendiaMcpObjectSnapshot>> {
    return this.context.execute(
      async (): Promise<IBlendiaMcpObjectSnapshot> =>
        BlendiaMcpSceneMapping.object(
          await this.context.current().createCube(options),
        ),
      true,
    );
  }

  /** Read fresh local properties for a current-generation object handle. */
  public async getObject(
    object: IBlenderObjectHandle,
  ): Promise<IBlendiaMcpResult<IBlendiaMcpObjectSnapshot>> {
    return this.context.execute(
      async (): Promise<IBlendiaMcpObjectSnapshot> =>
        BlendiaMcpSceneMapping.object(
          await this.context.current().getObject(object),
        ),
      false,
    );
  }

  /** Apply a nonempty local transform using XYZ Euler radians and existing SDK bounds. */
  public async setTransform(
    update: IBlendiaMcpObjectTransform,
  ): Promise<IBlendiaMcpResult<IBlendiaMcpObjectSnapshot>> {
    return this.context.execute(
      async (): Promise<IBlendiaMcpObjectSnapshot> =>
        BlendiaMcpSceneMapping.object(
          await this.context
            .current()
            .setTransform(BlendiaMcpSceneMapping.transform(update)),
        ),
      true,
    );
  }

  /** Read one fresh bounded UID-ordered scene page; pass nextCursor explicitly for continuation. */
  public async inspectScene(
    query: IBlenderSceneQuery,
  ): Promise<IBlendiaMcpResult<IBlendiaMcpSceneSnapshot>> {
    return this.context.execute(
      async (): Promise<IBlendiaMcpSceneSnapshot> =>
        BlendiaMcpSceneMapping.scene(
          await this.context.current().inspectScene(query),
        ),
      false,
    );
  }

  /** Create bounded bulk geometry without silent topology repair. */
  public async createMesh(
    options: IBlendiaMcpMeshOptions,
  ): Promise<IBlendiaMcpResult<IBlendiaMcpMeshSnapshot>> {
    return this.context.execute(
      async (): Promise<IBlendiaMcpMeshSnapshot> =>
        BlendiaMcpSceneMapping.mesh(
          await this.context
            .current()
            .createMesh(BlendiaMcpSceneMapping.meshOptions(options)),
        ),
      true,
    );
  }

  /** Create an opaque Principled material using scene-linear RGB. */
  public async createMaterial(
    options: IBlendiaMcpMaterialOptions,
  ): Promise<IBlendiaMcpResult<IBlendiaMcpMaterialSnapshot>> {
    return this.context.execute(
      async (): Promise<IBlendiaMcpMaterialSnapshot> =>
        BlendiaMcpSceneMapping.material(
          await this.context
            .current()
            .createMaterial(BlendiaMcpSceneMapping.materialOptions(options)),
        ),
      true,
    );
  }

  /** Assign one material to a whole local single-user mesh; shared/linked data is refused. */
  public async assignMaterial(
    assignment: IBlenderMaterialAssignment,
  ): Promise<IBlendiaMcpResult<IBlendiaMcpObjectSnapshot>> {
    return this.context.execute(
      async (): Promise<IBlendiaMcpObjectSnapshot> =>
        BlendiaMcpSceneMapping.object(
          await this.context.current().assignMaterial(assignment),
        ),
      true,
    );
  }

  /** Create an aimed unparented camera; setActive permanently changes scene.camera. */
  public async createCamera(
    options: IBlendiaMcpCameraOptions,
  ): Promise<IBlendiaMcpResult<IBlendiaMcpCameraSnapshot>> {
    return this.context.execute(
      async (): Promise<IBlendiaMcpCameraSnapshot> =>
        BlendiaMcpSceneMapping.camera(
          await this.context
            .current()
            .createCamera(BlendiaMcpSceneMapping.cameraOptions(options)),
        ),
      true,
    );
  }

  /** Create an aimed area light with explicit finite placement and illumination. */
  public async createAreaLight(
    options: IBlendiaMcpAreaLightOptions,
  ): Promise<IBlendiaMcpResult<IBlendiaMcpAreaLightSnapshot>> {
    return this.context.execute(
      async (): Promise<IBlendiaMcpAreaLightSnapshot> =>
        BlendiaMcpSceneMapping.areaLight(
          await this.context
            .current()
            .createAreaLight(BlendiaMcpSceneMapping.areaLightOptions(options)),
        ),
      true,
    );
  }

  /** Read one bounded owned PNG chunk with exact offsets and canonical base64, never a file path. */
  public async readArtifact(
    options: IBlenderArtifactReadOptions,
  ): Promise<IBlendiaMcpResult<IBlenderArtifactChunk>> {
    return this.context.execute(
      (): Promise<IBlenderArtifactChunk> =>
        this.context.current().readArtifact(options),
      false,
    );
  }

  /** Publish owned PNG to an explicit absolute destination; overwrite defaults false. */
  public async saveArtifact(
    options: IBlenderArtifactSaveOptions,
  ): Promise<IBlendiaMcpResult<IBlenderSavedFile>> {
    return this.context.execute(
      (): Promise<IBlenderSavedFile> =>
        this.context.current().saveArtifact(options),
      true,
    );
  }

  /** Save an explicit native .blend copy; working filepath remains unchanged and IO is outside undo. */
  public async saveBlendCopy(
    options: IBlenderSaveOptions,
  ): Promise<IBlendiaMcpResult<IBlenderSavedFile>> {
    return this.context.execute(
      (): Promise<IBlenderSavedFile> =>
        this.context.current().saveBlendCopy(options),
      true,
    );
  }

  /** Start with a caller-known UUID; a lost reply is not permission to resend. GUI starts are async, owned headless starts block natively. */
  public async startRender(
    options: IBlenderRenderOptions,
  ): Promise<IBlendiaMcpResult<BlenderRenderJob>> {
    return this.context.execute(
      async (): Promise<BlenderRenderJob> =>
        this.observeRender(await this.context.current().startRender(options)),
      true,
    );
  }

  /** Inspect the retained caller UUID after explicit reconnect; never creates another render. */
  public async getRender(
    render: IBlenderRenderHandle,
  ): Promise<IBlendiaMcpResult<BlenderRenderJob>> {
    return this.context.execute(async (): Promise<BlenderRenderJob> =>
      this.observeRender(await this.context.current().getRender(render)),
    );
  }

  /** Return observed PNG metadata and a one-use delivery ticket; native image bytes are delivered privately once, up to one MiB. */
  public async readImage(
    artifact: IBlenderArtifactHandle,
  ): Promise<IBlendiaMcpResult<IBlendiaMcpImageResult>> {
    return this.context.execute(async (): Promise<IBlendiaMcpImageResult> =>
      this.context.delivery.stage(
        await this.context.images.read(this.context.current(), artifact),
      ),
    );
  }

  /** Release an owned bridge artifact and its local observation without deleting exported user files. */
  public async releaseArtifact(
    artifact: IBlenderArtifactHandle,
  ): Promise<IBlendiaMcpResult<null>> {
    return this.context.execute(async (): Promise<null> => {
      await this.context.current().releaseArtifact(artifact);
      this.context.images.forget(artifact);
      return null;
    }, true);
  }

  /** Discover sanitized descriptors in an explicit directory; default makes no socket probe and BUSY remains honest. */
  public async discoverSessions(
    options: IBlenderDiscoveryOptions,
  ): Promise<IBlendiaMcpResult<IBlenderDiscoveryResult>> {
    return this.context.execute((): Promise<IBlenderDiscoveryResult> =>
      discoverBlenderSessions(options),
    );
  }

  /** Observe project/launcher metadata only; execution, Go, network and plugin readiness remain not-tested. */
  public async doctor(
    options: IProjectDoctorOptions,
  ): Promise<IBlendiaMcpResult<IProjectDoctorReport>> {
    return this.context.execute((): Promise<IProjectDoctorReport> =>
      doctorProject(options),
    );
  }

  /** Release the MCP writer before starting captured project TS; observe completion and explicitly connect again afterward. */
  public async startScript(
    options: IBlendiaMcpScriptOptions,
  ): Promise<IBlendiaMcpResult<IScriptJobSnapshot>> {
    return this.context.execute(
      (): Promise<IScriptJobSnapshot> => this.context.startScript(options),
      true,
    );
  }

  /** Observe only a job admitted by this server lifetime; native rendering is a different job family. */
  public async getScript(
    reference: IBlendiaMcpJobReference,
  ): Promise<IBlendiaMcpResult<IScriptJobSnapshot>> {
    return this.context.execute((): IScriptJobSnapshot =>
      this.context.job(reference.jobId).inspect(),
    );
  }

  /** Read bounded captured logs with existing cursor and retention-gap semantics; never forwards child stdout to JSON-RPC stdout. */
  public async readScriptLogs(
    query: IBlendiaMcpLogQuery,
  ): Promise<IBlendiaMcpResult<IScriptLogPage>> {
    return this.context.execute((): IScriptLogPage =>
      this.context.job(query.jobId).readLog(query.cursor, query.byteLimit),
    );
  }

  /** Release a terminal captured record; BUSY on active jobs is not process cancellation. */
  public async closeScript(
    reference: IBlendiaMcpJobReference,
  ): Promise<IBlendiaMcpResult<null>> {
    return this.context.execute((): null =>
      this.context.closeJob(reference.jobId),
    );
  }

  /** Execute one saved script in a separately owned Blender; private prerequisite paths are not model parameters or results. */
  public async runHeadless(
    options: IBlendiaMcpHeadlessOptions,
  ): Promise<IBlendiaMcpResult<IBlendiaMcpHeadlessResult>> {
    return this.context.execute(
      (): Promise<IBlendiaMcpHeadlessResult> =>
        this.context.runHeadless(options),
      true,
    );
  }

  /** Only real succeeded native metadata enters the image/resource observation cache. */
  private observeRender(job: BlenderRenderJob): BlenderRenderJob {
    if (job.status === "succeeded") this.context.images.observe(job.artifact);
    return job;
  }
}
