import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import type { IHeadlessProjectOptions } from "./IHeadlessProjectOptions";
import type { IHeadlessProjectResult } from "./IHeadlessProjectResult";
import type { IScriptLogPage } from "./IScriptLogPage";
import { ScriptJob } from "./ScriptJob";
import { HeadlessControl } from "./internal/HeadlessControl";
import { HeadlessWorkspace } from "./internal/HeadlessWorkspace";
import type { IHeadlessReady } from "./internal/IHeadlessReady";
import type { IPreparedHeadlessProject } from "./internal/IPreparedHeadlessProject";
import type { IScriptProcessResult } from "./internal/IScriptProcessResult";
import { ScriptLog } from "./internal/ScriptLog";
import { ScriptProcess } from "./internal/ScriptProcess";
import { collectHeadlessLogs } from "./internal/collectHeadlessLogs";
import { prepareConnectionEnvironment } from "./internal/prepareConnectionEnvironment";
import { prepareHeadlessProject } from "./internal/prepareHeadlessProject";

/**
 * Own one fresh background Blender and one captured project script, with no implicit GUI adoption.
 *
 * Startup bounds only readiness/control authentication; the user's TypeScript/native preparation has no such deadline. Known script completion requests cooperative bootstrap return, then separately observes Blender exit and EOF. Unknown observation retains private files and never kills, retries or replays mutations.
 *
 * @evidence contracts/common.md#principled-implementation Explicit installed/source extension and binary paths launch the public --background/--python interface; matching private run identity and authenticated control admit the same bridge credentials to the original-source ScriptJob.
 * @evidence contracts/common.md#clear-and-simple-design ScriptProcess and ScriptLog own both actual spawn/capture paths, ScriptJob owns TypeScript, and one wrapper owns readiness, control and cleanup without becoming a persistent session or daemon.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No repository-path fallback, Python source copy, local prebuild, SDK writer takeover, signal-based cancellation, process-tree kill, retry or mutation replay is used.
 * @evidence contracts/common.md#meaningful-documentation Script status and native Blender exit/EOF are separate; completed is not a zero-code or scene-success claim, and expired bridge artifacts are not durable user outputs.
 */
export async function runHeadlessProject(
  options: IHeadlessProjectOptions,
): Promise<IHeadlessProjectResult> {
  const prepared: IPreparedHeadlessProject = prepareHeadlessProject(options);
  const result: IHeadlessProjectResult = {
    outcome: "launch-failed",
    blenderOutcome: "not-started",
    scriptLogs: [],
    blenderLogs: [],
    cleanup: "not-created",
  };
  const blenderObservation: AbortController = new AbortController();
  const scriptObservation: AbortController = new AbortController();
  let workspace: HeadlessWorkspace | undefined;
  let blenderLog: ScriptLog | undefined;
  let control: HeadlessControl | undefined;
  let job: ScriptJob | undefined;
  let blenderCompletion: Promise<IScriptProcessResult> | undefined;
  let native: IScriptProcessResult | undefined;
  let finishAcknowledged: boolean = false;
  let shutdownDeadline: number | undefined;
  try {
    workspace = new HeadlessWorkspace();
    result.cleanup = "retained";
    result.retainedDirectory = workspace.directory;
    workspace.writeConfig(prepared.startupTimeoutMs);
    blenderLog = new ScriptLog(workspace.token);

    // An existing GUI credential must never select or leak into this new owned bridge.
    const env: NodeJS.ProcessEnv = prepareConnectionEnvironment(
      process.env,
      undefined,
      true,
    );
    const args: string[] = [
      "--background",
      "--factory-startup",
      "--disable-autoexec",
    ];
    if (prepared.blendFile !== undefined) args.push(prepared.blendFile);
    args.push(
      "--python-exit-code",
      "1",
      "--python",
      prepared.bootstrap,
      "--",
      workspace.configPath,
    );
    blenderCompletion = ScriptProcess.run({
      policy: "capture",
      log: blenderLog,
      observationSignal: blenderObservation.signal,
      onSpawn: (pid: number): void => {
        result.blenderPid = pid;
      },
      launch: { executable: prepared.executable, args, cwd: prepared.cwd, env },
    }).then((observed: IScriptProcessResult): IScriptProcessResult => {
      native = observed;
      return observed;
    });
    const startupDeadline: number =
      performance.now() + prepared.startupTimeoutMs;
    let ready: IHeadlessReady | undefined;
    while (ready === undefined) {
      if (native !== undefined)
        throw new Error("Owned Blender closed before readiness.");
      const remaining: number = Math.ceil(startupDeadline - performance.now());
      if (remaining <= 0)
        throw new Error("Owned Blender readiness was not observed.");
      ready = workspace.readReady();
      if (ready === undefined) await delay(Math.min(50, remaining));
    }
    const attachRemaining: number = Math.ceil(
      startupDeadline - performance.now(),
    );
    if (attachRemaining <= 0)
      throw new Error("Owned Blender control attachment deadline elapsed.");
    control = await HeadlessControl.attach(
      ready.controlPort,
      workspace.runId,
      workspace.token,
      attachRemaining,
    );
    job = ScriptJob.startOwned(
      {
        kind: "file",
        options: {
          entry: prepared.options.entry,
          cwd: prepared.cwd,
          project: prepared.options.project,
          args: prepared.options.args,
          connection: { port: ready.port, token: workspace.token },
        },
      },
      scriptObservation.signal,
    );

    // A lost owned Blender makes further script observation uncertain; this never kills its launcher.
    void blenderCompletion.then((): void => scriptObservation.abort());
    result.script = await job.wait();
    const completedJob: ScriptJob = job;
    result.scriptLogs = collectHeadlessLogs((cursor: number): IScriptLogPage =>
      completedJob.readLog(cursor),
    );
    job.close();
    job = undefined;
    if (result.script.outcome === "unknown") control.close();
    else {
      shutdownDeadline = performance.now() + prepared.shutdownTimeoutMs;
      await control.finish(prepared.shutdownTimeoutMs);
      finishAcknowledged = true;
    }
  } catch {
    result.diagnostic =
      "Owned headless startup or lifecycle observation failed. Inspect the separate bounded logs; no mutation replay or process kill was performed.";
  } finally {
    control?.close();
    if (blenderCompletion !== undefined) {
      if (shutdownDeadline === undefined && native === undefined)
        blenderObservation.abort();
      const remaining: number = Math.max(
        0,
        Math.ceil((shutdownDeadline ?? performance.now()) - performance.now()),
      );
      const timer: NodeJS.Timeout = setTimeout(
        (): void => blenderObservation.abort(),
        remaining,
      );
      try {
        native = await blenderCompletion;
      } finally {
        clearTimeout(timer);
      }
    }
    scriptObservation.abort();
    if (job !== undefined) {
      result.script = await job.wait();
      const remainingJob: ScriptJob = job;
      result.scriptLogs = collectHeadlessLogs(
        (cursor: number): IScriptLogPage => remainingJob.readLog(cursor),
      );
      job.close();
    }
    if (native !== undefined) {
      result.blender = native.result;
      result.blenderOutcome = native.outcome;
    }
    if (blenderLog !== undefined) {
      blenderLog.finish("stdout");
      blenderLog.finish("stderr");
      const completedLog: ScriptLog = blenderLog;
      result.blenderLogs = collectHeadlessLogs(
        (cursor: number): IScriptLogPage => completedLog.read(cursor),
      );
      blenderLog.clear();
    }
    if (result.script === undefined)
      result.outcome =
        native?.outcome === "unknown" ? "unknown" : "launch-failed";
    else if (
      result.script.outcome === "unknown" ||
      native?.outcome !== "exited" ||
      native.result.code !== 0 ||
      !finishAcknowledged
    )
      result.outcome = "unknown";
    else
      result.outcome =
        result.script.outcome === "launch-failed"
          ? "launch-failed"
          : "completed";
    if (result.outcome === "unknown" && result.diagnostic === undefined)
      result.diagnostic =
        "Owned process closure or control completion is uncertain; retained files may remain in use and descendants may remain active.";
    if (
      workspace !== undefined &&
      result.outcome !== "unknown" &&
      (blenderCompletion === undefined ||
        native?.outcome === "launch-failed" ||
        (native?.outcome === "exited" &&
          native.result.code === 0 &&
          finishAcknowledged))
    ) {
      try {
        workspace.cleanup();
        result.cleanup = "removed";
        result.retainedDirectory = undefined;
      } catch {
        result.diagnostic =
          "Owned private bootstrap files could not be safely removed; their directory was retained.";
      }
    }
  }
  return result;
}
