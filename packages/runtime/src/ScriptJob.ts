import { randomUUID } from "node:crypto";
import process from "node:process";

import type { IScriptJobRequest } from "./IScriptJobRequest";
import type { IScriptJobSnapshot } from "./IScriptJobSnapshot";
import type { IScriptLogPage } from "./IScriptLogPage";
import type { IScriptExecutionResult } from "./internal/IScriptExecutionResult";
import { ScriptJobState } from "./internal/ScriptJobState";
import { ScriptLog } from "./internal/ScriptLog";
import { runScriptExecution } from "./internal/runScriptExecution";

/**
 * A captured direct launcher owned by this process; no daemon, cancellation, or durable lookup.
 *
 * Admission retains at most sixteen records, including terminal records until explicit close. The bound limits this registry's memory and never bypasses Blender's exclusive writer/BUSY response. Capture ignores stdin and continuously drains stdout/stderr without writing parent streams.
 */
export class ScriptJob {
  /** Random identity shared only by this process's registry incarnation. */
  private static readonly ownerId: string = randomUUID();
  /** Live and terminal records both consume the explicit admission bound. */
  private static readonly records: Map<string, ScriptJob> = new Map();
  /** Process-local lookup key, unrelated to Blender session identity. */
  private readonly id: string = randomUUID();
  /** Captured UTF-8 payload retention, never a parent-stream forwarder. */
  private readonly log: ScriptLog;
  /** Credential-free lifecycle and bounded public result projection. */
  private readonly state: ScriptJobState;
  /** Single execution promise; repeated wait calls never launch another child. */
  private readonly completion: Promise<void>;
  /** Released handles cannot read or close the record again. */
  private closed: boolean = false;

  /** Snapshot credentials once for capture redaction and begin only after admission. */
  private constructor(request: IScriptJobRequest) {
    const environment: NodeJS.ProcessEnv = { ...process.env };
    const token: string =
      request.options.connection?.token ?? environment.BLENDIA_TOKEN ?? "";
    this.log = new ScriptLog(token);
    this.state = new ScriptJobState(this.id, ScriptJob.ownerId, token);

    // Defer all effects until registry admission is complete and the caller can inspect starting.
    this.completion = Promise.resolve().then(async (): Promise<void> => {
      let execution: IScriptExecutionResult;
      try {
        execution = await runScriptExecution(request, {
          policy: "capture",
          environment,
          log: this.log,
          onPhase: (phase: IScriptJobSnapshot["phase"]): void => {
            if (phase === "running" || phase === "draining")
              this.state.advance(phase);
          },
        });
      } catch {
        execution = {
          result: { code: null, signal: null },
          outcome: "launch-failed",
        };
      }
      this.log.finish("stdout");
      this.log.finish("stderr");
      this.state.complete(execution);
    });
  }

  /** Reserve one record before any staging or process effect; input arrays/options are snapshotted. */
  public static start(request: IScriptJobRequest): ScriptJob {
    if (ScriptJob.records.size >= 16)
      throw new Error(
        "blendia: job registry is full; close a terminal job before starting another.",
      );
    const copied: IScriptJobRequest =
      request.kind === "file"
        ? {
            kind: "file",
            options: {
              ...request.options,
              args: request.options.args?.slice(),
              connection:
                request.options.connection === undefined
                  ? undefined
                  : { ...request.options.connection },
            },
          }
        : {
            kind: "text",
            options: {
              ...request.options,
              args: request.options.args?.slice(),
              connection:
                request.options.connection === undefined
                  ? undefined
                  : { ...request.options.connection },
            },
          };
    const job: ScriptJob = new ScriptJob(copied);
    ScriptJob.records.set(job.id, job);
    return job;
  }

  /** Same-process, same-owner lookup only; unknown and released identifiers return undefined. */
  public static get(id: string): ScriptJob | undefined {
    return ScriptJob.records.get(id);
  }

  /** Observe launcher phase and retention bounds without exposing request credentials. */
  public inspect(): IScriptJobSnapshot {
    this.assertOpen();
    return this.state.inspect(this.log.earliestCursor, this.log.tailCursor);
  }

  /** Read one same-job cursor page; negative, unsafe, future and out-of-budget inputs fail. */
  public readLog(
    cursor: number = 0,
    byteLimit: number = 16384,
  ): IScriptLogPage {
    this.assertOpen();
    return this.log.read(cursor, byteLimit);
  }

  /** Resolve after bounded EOF observation and Text disposition, not after all descendants terminate. */
  public async wait(): Promise<IScriptJobSnapshot> {
    this.assertOpen();
    await this.completion;
    return this.inspect();
  }

  /** Release terminal memory only. Active close is BUSY and never kills any process. */
  public close(): void {
    this.assertOpen();
    if (this.inspect().phase !== "terminal")
      throw new Error("blendia: job is BUSY; close does not cancel execution.");
    ScriptJob.records.delete(this.id);
    this.log.clear();
    this.state.release();
    this.closed = true;
  }

  /** Prevent a released external handle from accessing freed retention. */
  private assertOpen(): void {
    if (this.closed) throw new Error("blendia: job record is closed.");
  }
}
