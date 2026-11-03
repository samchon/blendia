import { type ChildProcess, spawn } from "node:child_process";
import process from "node:process";

import type { IScriptProcessOptions } from "./IScriptProcessOptions";
import type { IScriptProcessResult } from "./IScriptProcessResult";

/**
 * Own the sole spawn/lifecycle path for real inherited and captured stream policies.
 *
 * Captured exit waits for EOF/close, with a two-second grace when descendants retain pipes. Expiry detaches/destroys only our pipe readers, never kills a process, and reports unknown. Inherited execution preserves its original close boundary without a pipe timeout.
 */
export class ScriptProcess {
  /** Attach listeners once and settle only at close or an explicit captured-observation timeout. */
  public static run(
    options: IScriptProcessOptions,
  ): Promise<IScriptProcessResult> {
    return new Promise<IScriptProcessResult>(
      (resolve: (value: IScriptProcessResult) => void): void => {
        let child: ChildProcess;
        try {
          child = spawn(options.launch.executable, options.launch.args, {
            cwd: options.launch.cwd,
            env: options.launch.env,
            shell: false,
            windowsHide: true,
            stdio:
              options.policy === "inherit"
                ? "inherit"
                : ["ignore", "pipe", "pipe"],
          });
        } catch (error) {
          resolve({
            result: { code: null, signal: null },
            outcome: "launch-failed",
            error:
              error instanceof Error
                ? error
                : new Error("Process creation failed."),
          });
          return;
        }
        let settled: boolean = false;
        let spawned: boolean = false;
        let failure: Error | undefined;
        let timer: NodeJS.Timeout | undefined;
        let code: number | null = null;
        let signal: NodeJS.Signals | null = null;

        /** Release observation listeners and readers without claiming process-tree termination. */
        const finish: (uncertain: boolean) => void = (
          uncertain: boolean,
        ): void => {
          if (settled) return;
          settled = true;
          if (timer !== undefined) clearTimeout(timer);
          child.removeListener("spawn", onSpawn);
          child.removeListener("error", onError);
          child.removeListener("exit", onExit);
          child.removeListener("close", onClose);
          child.stdout?.removeListener("data", onStdout);
          child.stderr?.removeListener("data", onStderr);
          if (!uncertain) {
            child.stdout?.removeListener("error", onStreamError);
            child.stderr?.removeListener("error", onStreamError);
          }
          options.log?.finish("stdout");
          options.log?.finish("stderr");
          if (uncertain) {
            child.stdout?.destroy();
            child.stderr?.destroy();
            child.unref();
          }

          // Windows can expose termination as an unsigned high-bit status without a signal.
          // Preserve that raw code, but never authorize Text cleanup as an ordinary exit.
          resolve({
            result: { code, signal },
            outcome:
              !spawned && failure !== undefined
                ? "launch-failed"
                : uncertain ||
                    failure !== undefined ||
                    signal !== null ||
                    code === null ||
                    (process.platform === "win32" && code >= 0x80000000)
                  ? "unknown"
                  : "exited",
            error: failure,
          });
        };
        /** Distinguish an existing launcher from failed OS process creation. */
        const onSpawn: () => void = (): void => {
          spawned = true;
          options.onPhase?.("running");
        };
        /** Preserve the actual error privately until the process closure boundary. */
        const onError: (error: Error) => void = (error: Error): void => {
          failure = error;
        };
        /** Missing pipe observations force an unknown result rather than successful completion. */
        const onStreamError: (error: Error) => void = (error: Error): void => {
          failure = error;
          if (timer === undefined && options.policy === "capture")
            timer = setTimeout((): void => finish(true), 2000);
        };
        /** Start captured EOF grace after direct exit; inherited streams still wait for close. */
        const onExit: (
          exitCode: number | null,
          exitSignal: NodeJS.Signals | null,
        ) => void = (
          exitCode: number | null,
          exitSignal: NodeJS.Signals | null,
        ): void => {
          code = exitCode;
          signal = exitSignal;
          options.onPhase?.("draining");
          if (options.policy === "capture" && timer === undefined)
            timer = setTimeout((): void => finish(true), 2000);
        };
        /** Observe direct-child and associated pipe closure together. */
        const onClose: (
          exitCode: number | null,
          exitSignal: NodeJS.Signals | null,
        ) => void = (
          exitCode: number | null,
          exitSignal: NodeJS.Signals | null,
        ): void => {
          code = exitCode;
          signal = exitSignal;
          finish(false);
        };
        /** Feed captured stdout only to the bounded journal. */
        const onStdout: (bytes: Buffer) => void = (bytes: Buffer): void => {
          options.log?.append("stdout", bytes);
        };
        /** Feed captured stderr separately without claiming cross-stream OS order. */
        const onStderr: (bytes: Buffer) => void = (bytes: Buffer): void => {
          options.log?.append("stderr", bytes);
        };
        child.once("spawn", onSpawn);
        child.once("error", onError);
        child.once("exit", onExit);
        child.once("close", onClose);
        child.stdout?.on("data", onStdout);
        child.stderr?.on("data", onStderr);
        child.stdout?.on("error", onStreamError);
        child.stderr?.on("error", onStreamError);
      },
    );
  }
}
