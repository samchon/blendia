import assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { INativeBlenderObservation } from "../INativeBlenderObservation";
import { BlenderEngineAdmission } from "./BlenderEngineAdmission";

/**
 * Observe one actual native preparation/readback command for at most ten minutes, without killing or substituting its process.
 *
 * User TypeScript uses the separate public runtime and receives no deadline from this helper. Expired or uncertain native observation closes admission, preserves all paths, and unrefs only Node's child handle; it does not certify native or descendant termination.
 */
export async function runNativeBlender(
  executable: string,
  args: readonly string[],
  stage: string,
  outputDirectory: string,
): Promise<void> {
  BlenderEngineAdmission.assertOpen();
  const observationBudgetMs: number = 600000;
  const directory: string = path.join(outputDirectory, "native-observations");
  fs.mkdirSync(directory, { recursive: true });
  const journal: string = path.join(
    directory,
    `${stage}-${randomUUID()}.jsonl`,
  );
  const child: ChildProcess = spawn(executable, [...args], {
    stdio: "inherit",
    windowsHide: true,
  });
  await new Promise<void>(
    (resolve: () => void, reject: (error: Error) => void): void => {
      let settled: boolean = false;

      /** Persist only fixed stage and direct process facts, never argv, environment, or private bodies. */
      const record: (
        event: INativeBlenderObservation["event"],
        outcome: INativeBlenderObservation["outcome"],
        code: number | null,
        signal: NodeJS.Signals | null,
      ) => void = (
        event: INativeBlenderObservation["event"],
        outcome: INativeBlenderObservation["outcome"],
        code: number | null,
        signal: NodeJS.Signals | null,
      ): void => {
        const observation: INativeBlenderObservation = {
          stage,
          observedAt: new Date().toISOString(),
          event,
          pid: child.pid ?? null,
          outcome,
          code,
          signal,
          observationBudgetMs,
        };
        fs.appendFileSync(journal, `${JSON.stringify(observation)}\n`);
      };

      /** Fail closed if observation storage itself fails after native admission. */
      const unknown: (
        event: "close" | "error" | "observation-expired",
      ) => void = (event: "close" | "error" | "observation-expired"): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        BlenderEngineAdmission.stop(stage);
        child.unref();
        try {
          record(event, "unknown", child.exitCode, child.signalCode);
        } catch {
          console.error(
            `Native observation could not be persisted for ${stage}; retained output root: ${outputDirectory}`,
          );
        }
        reject(
          new Error(
            `Native ${stage} observation is unknown. No process was killed or replayed; retained output root: ${outputDirectory}`,
          ),
        );
      };
      const timer: NodeJS.Timeout = setTimeout(
        (): void => unknown("observation-expired"),
        observationBudgetMs,
      );
      child.once("spawn", (): void => {
        try {
          record("spawn", "running", null, null);
        } catch {
          unknown("error");
        }
      });
      child.once("error", (error: Error): void => {
        if (settled) return;
        if (child.pid !== undefined) {
          unknown("error");
          return;
        }
        settled = true;
        clearTimeout(timer);
        try {
          record("error", "launch-failed", null, null);
        } catch {
          console.error(
            `Native launch evidence could not be persisted for ${stage}.`,
          );
        }
        reject(error);
      });
      child.once(
        "close",
        (code: number | null, signal: NodeJS.Signals | null): void => {
          if (settled) return;
          if (
            signal !== null ||
            code === null ||
            code < 0 ||
            code > 2147483647
          ) {
            unknown("close");
            return;
          }
          settled = true;
          clearTimeout(timer);
          try {
            record("close", "exited", code, signal);
            assert.equal(
              signal,
              null,
              "Native fixture work must end normally.",
            );
            assert.equal(
              code,
              0,
              "Native scene/image assertions failed; inspect inherited diagnostics.",
            );
            resolve();
          } catch (error: unknown) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        },
      );
    },
  );
}
