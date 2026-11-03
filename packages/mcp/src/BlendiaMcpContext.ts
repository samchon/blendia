import {
  type IScriptJobSnapshot,
  ScriptJob,
  redactKnownToken,
  runHeadlessProject,
  startScriptJob,
} from "@blendia/runtime";
import {
  BlenderClient,
  BlenderError,
  type IBlenderConnectionOptions,
  type IBlenderSession,
} from "@blendia/sdk";

import { BlendiaMcpError } from "./BlendiaMcpError";
import { BlendiaMcpImageDelivery } from "./BlendiaMcpImageDelivery";
import { BlendiaMcpImages } from "./BlendiaMcpImages";
import type { IBlendiaMcpHeadlessConfiguration } from "./IBlendiaMcpHeadlessConfiguration";
import type { IBlendiaMcpHeadlessOptions } from "./IBlendiaMcpHeadlessOptions";
import type { IBlendiaMcpHeadlessResult } from "./IBlendiaMcpHeadlessResult";
import type { IBlendiaMcpOptions } from "./IBlendiaMcpOptions";
import type { IBlendiaMcpResult } from "./IBlendiaMcpResult";
import type { IBlendiaMcpScriptOptions } from "./IBlendiaMcpScriptOptions";

/** Private factory-owned session, job, privacy, and retirement boundary; excluded from model-tool reflection.
 *
 * @evidence contracts/common.md#principled-implementation Credentials are snapshotted privately, model project inputs cannot override connections or headless prerequisites, and successful projections are suppressed if they contain a known connection credential.
 * @evidence contracts/common.md#clear-and-simple-design One context is shared by the controller and server closure; the real SDK/runtime retain wire, native execution, captured logs, and process semantics.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Starting a captured script releases the MCP writer first, does not reconnect implicitly afterward, and never kills active jobs or retries effects during shutdown.
 * @evidence contracts/common.md#meaningful-documentation Native render IDs, process-local script jobs, and private headless lifetimes remain distinct; retained bootstrap-directory metadata is omitted from model results.
 * @evidence contracts/performance.md#efficient-algorithms Tool projections are visited once for known-credential detection; captured jobs use the runtime's existing bounded registry and log pages rather than duplicate process capture.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The context owns one SDK client and at most sixteen runtime-backed jobs; close releases terminal records, defers active release until their actual completion, and retires image observations without cancelling native work.
 */
export class BlendiaMcpContext {
  /** Bounded owned-image observations shared with controller and resource reads. */
  public readonly images: BlendiaMcpImages;
  /** Private one-time media delivery shared only with the server's response adapter. */
  public readonly delivery: BlendiaMcpImageDelivery;
  /** Immutable private connection snapshot, never returned as metadata. */
  private readonly connection: IBlenderConnectionOptions;
  /** Known token is used only for output suppression and diagnostic redaction. */
  private readonly token: string;
  /** Explicit private executable/extension prerequisites for one-shot execution. */
  private readonly headless: IBlendiaMcpHeadlessConfiguration | undefined;
  /** Exclusive live SDK owner, or null after explicit handoff/disconnect. */
  private client: BlenderClient | null = null;
  /** Only jobs admitted by this context can be inspected through its tools. */
  private readonly jobs: Map<string, ScriptJob> = new Map();
  /** A closed factory cannot admit new work. */
  private closing: boolean = false;
  /** Tracks facade operations so socket cleanup cannot pretend to cancel an in-flight call. */
  private active: number = 0;

  /** Snapshot private options once without publishing environment or configuration values. */
  public constructor(
    options: IBlendiaMcpOptions,
    delivery: BlendiaMcpImageDelivery,
  ) {
    this.delivery = delivery;
    this.images = new BlendiaMcpImages(delivery);
    this.token = options.connection?.token ?? process.env.BLENDIA_TOKEN ?? "";
    const port: number | undefined =
      options.connection?.port ??
      (process.env.BLENDIA_PORT === undefined
        ? undefined
        : Number(process.env.BLENDIA_PORT));
    this.connection = {
      port,
      token: this.token,
      timeoutMs: options.connection?.timeoutMs,
    };
    this.headless =
      options.headless === undefined ? undefined : { ...options.headless };
  }

  /** Require an explicit successful connect; no scene operation reconnects or retries implicitly. */
  public current(): BlenderClient {
    if (this.closing)
      throw new BlendiaMcpError(
        "CLOSED",
        "The MCP service lifetime has ended.",
      );
    if (this.client === null)
      throw new BlendiaMcpError(
        "NOT_CONNECTED",
        "Call connect before using live Blender tools.",
      );
    return this.client;
  }

  /** Explicitly replace a previous connection and retain only same-session image observations. */
  public async connect(): Promise<IBlenderSession> {
    await this.disconnect();
    this.client = await BlenderClient.connect(this.connection);
    const session: IBlenderSession = this.client.session;
    this.images.retainSession(session.sessionId);
    return session;
  }

  /** Hand off the SDK lease without cancelling native rendering or deleting retained native artifacts. */
  public async disconnect(): Promise<null> {
    if (this.client !== null) {
      await this.client.disconnect();
      this.client = null;
    }
    return null;
  }

  /** Launch saved TS through captured runtime after explicit MCP writer handoff; callers reconnect after observing completion. */
  public async startScript(
    options: IBlendiaMcpScriptOptions,
  ): Promise<IScriptJobSnapshot> {
    if (this.jobs.size >= 16)
      throw new BlendiaMcpError(
        "LIMIT_EXCEEDED",
        "Close a terminal script job before starting another.",
      );
    await this.disconnect();
    const job: ScriptJob = startScriptJob({
      kind: "file",
      options: {
        entry: options.entry,
        cwd: options.cwd,
        project: options.project,
        args: options.args?.slice(),
        connection: { port: this.connection.port, token: this.token },
      },
    });
    const snapshot: IScriptJobSnapshot = job.inspect();
    this.jobs.set(snapshot.id, job);
    return snapshot;
  }

  /** Reject foreign process-local registry IDs instead of reading another controller's records. */
  public job(id: string): ScriptJob {
    const job: ScriptJob | undefined = this.jobs.get(id);
    if (job === undefined)
      throw new BlendiaMcpError(
        "NOT_FOUND",
        "The script job is not owned by this MCP lifetime.",
      );
    return job;
  }

  /** Release only a terminal captured record; active close is not process cancellation. */
  public closeJob(id: string): null {
    const job: ScriptJob = this.job(id);
    if (job.inspect().phase !== "terminal")
      throw new BlendiaMcpError(
        "BUSY",
        "Wait for terminal observation before releasing a script job.",
      );
    job.close();
    this.jobs.delete(id);
    return null;
  }

  /** Run a separately owned Blender with private prerequisites and suppress retained credential-directory metadata. */
  public async runHeadless(
    options: IBlendiaMcpHeadlessOptions,
  ): Promise<IBlendiaMcpHeadlessResult> {
    const configuration: IBlendiaMcpHeadlessConfiguration | undefined =
      this.headless;
    if (configuration === undefined)
      throw new BlendiaMcpError(
        "NOT_CONFIGURED",
        "Owned headless execution is not configured for this server.",
      );
    const result: IBlendiaMcpHeadlessResult = await runHeadlessProject({
      entry: options.entry,
      cwd: options.cwd,
      project: options.project,
      args: options.args?.slice(),
      blendFile: options.blendFile,
      blenderExecutable: configuration.blenderExecutable,
      extensionDirectory: configuration.extensionDirectory,
      startupTimeoutMs: configuration.startupTimeoutMs,
      shutdownTimeoutMs: configuration.shutdownTimeoutMs,
    });
    return {
      outcome: result.outcome,
      script: result.script,
      blender: result.blender,
      blenderOutcome: result.blenderOutcome,
      blenderPid: result.blenderPid,
      scriptLogs: result.scriptLogs,
      blenderLogs: result.blenderLogs,
      cleanup: result.cleanup,
      diagnostic: result.diagnostic,
    };
  }

  /** Return all three envelope fields: success has a null error; failure has a null result and sanitized effect information. */
  public async execute<T>(
    operation: () => T | Promise<T>,
    mutation: boolean = false,
  ): Promise<IBlendiaMcpResult<T>> {
    if (this.closing)
      return {
        ok: false,
        result: null,
        error: {
          code: "CLOSED",
          message: "The MCP service lifetime has ended.",
          effects: "none",
        },
      };
    this.active++;
    try {
      const result: T = await operation();
      if (this.containsCredential(result, new Set<object>()))
        throw new BlendiaMcpError(
          "PRIVATE_DATA",
          "The result contained private credential metadata and was suppressed.",
          mutation ? "possible" : "none",
        );
      return { ok: true, result, error: null };
    } catch (error) {
      if (error instanceof BlenderError || error instanceof BlendiaMcpError) {
        const code: string = /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)
          ? error.code
          : "EXECUTION_ERROR";
        return {
          ok: false,
          result: null,
          error: {
            code: redactKnownToken(code, this.token),
            message: redactKnownToken(error.message, this.token).slice(0, 1024),
            effects: error.effects,
          },
        };
      }
      return {
        ok: false,
        result: null,
        error: {
          code: redactKnownToken("EXECUTION_ERROR", this.token),
          message: redactKnownToken(
            "The operation failed; inspect project prerequisites or captured diagnostics. No retry or rollback was performed.",
            this.token,
          ),
          effects: mutation ? "possible" : "none",
        },
      };
    } finally {
      this.active--;
      if (this.closing && this.active === 0) await this.close();
    }
  }

  /** Server closure releases owned observations and records without terminating user execution. */
  public async close(): Promise<void> {
    this.closing = true;
    this.images.clear();
    for (const [id, job] of this.jobs) {
      if (job.inspect().phase === "terminal") {
        job.close();
        this.jobs.delete(id);
      } else
        void job
          .wait()
          .then((): void => {
            job.close();
            this.jobs.delete(id);
          })
          .catch((): void => {
            this.jobs.delete(id);
          });
    }
    if (this.active === 0) await this.retireConnection();
  }

  /** Drain a settled SDK owner; transport failure already closes its socket and never authorizes replay. */
  private async retireConnection(): Promise<void> {
    try {
      await this.disconnect();
    } catch {
      /* Connection cleanup never rewrites the completed tool result or emits private diagnostics. */
    }
  }

  /** Suppress a whole typed projection rather than redacting enum/identity fields into a schema-invalid result. */
  private containsCredential(value: unknown, visited: Set<object>): boolean {
    if (typeof value === "string")
      return this.token.length !== 0 && value.includes(this.token);
    if (value === null || typeof value !== "object") return false;
    if (visited.has(value)) return true;
    visited.add(value);
    const found: boolean = Object.values(value).some(
      (entry: unknown): boolean => this.containsCredential(entry, visited),
    );
    visited.delete(value);
    return found;
  }
}
