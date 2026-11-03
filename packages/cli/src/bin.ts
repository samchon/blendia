#!/usr/bin/env node
import {
  type IHeadlessProjectResult,
  type IProjectScriptResult,
  type IScriptJobSnapshot,
  type ITextMacroResult,
  TEXT_MACRO_MAX_BYTES,
  discoverBlenderSessions,
  doctorProject,
  redactKnownToken,
  runHeadlessProject,
  runProjectScript,
  runTextMacro,
} from "@blendia/runtime";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { TextDecoder } from "node:util";

import type { IBlendiaCommand } from "./IBlendiaCommand";
import { parseBlendiaCommand } from "./parseBlendiaCommand";
import { runMachineJob } from "./runMachineJob";

/**
 * Run the actual terminal request and preserve script diagnostics on inherited streams.
 *
 * Only the runtime launches a child. Help lists implemented options, normal exit codes are preserved, and a reported termination signal remains a failure. Waiting for completion before assigning exitCode avoids truncating inherited output; this command offers no cancellation or rollback guarantee.
 */
async function main(): Promise<void> {
  const command: IBlendiaCommand = parseBlendiaCommand(process.argv.slice(2));
  if (command.kind === "help") {
    process.stdout.write(
      [
        "Usage: blendia run [--jsonl] [--cwd <dir>] [--project <tsconfig>] <entry> [-- <script args...>]",
        "       blendia run-text [--jsonl] --cwd <dir> --source-path <logical.ts> --input-file <utf8> [--project <tsconfig>] [--origin <label>] [-- <script args...>]",
        "       blendia sessions --directory <dir> [--probe] [--probe-timeout-ms <100..5000>]",
        "       blendia doctor [--cwd <dir>] [--project <tsconfig>]",
        "       blendia headless --blender <executable> --extension-directory <dir> [--blend-file <input.blend>] [--cwd <dir>] [--project <tsconfig>] [--startup-timeout-ms <100..3600000>] [--shutdown-timeout-ms <100..3600000>] <entry> [-- <script args...>]",
        "       blendia --help",
        "",
        "Run existing project TypeScript through ttsx using the current Node executable.",
        "Options belong before the entry; all later arguments belong to the script.",
        "One -- immediately after the entry is removed as the CLI separator.",
        "run-text reads at most 256 KiB of UTF-8 and stages a sibling module; its -- starts script arguments.",
        "BLENDIA_PORT and BLENDIA_TOKEN are inherited by the script's SDK client.",
        "--jsonl captures bounded logs and terminal observations; stdin is ignored in this mode.",
        "sessions/doctor output JSON metadata; discovery probes require --probe and briefly acquire an idle lease.",
        "doctor does not execute the compiler or verify Go/network/native first-use preparation.",
        "headless owns a fresh background Blender, captures both processes and emits one bounded result JSON.",
        "Headless startup/shutdown deadlines do not bound user TypeScript or native plugin preparation.",
        "Start Blender's Blendia extension and set its credentials before a Blender script.",
        "",
      ].join("\n"),
    );
    return;
  }

  if (command.kind === "sessions") {
    process.stdout.write(
      JSON.stringify(await discoverBlenderSessions(command.options)) + "\n",
    );
    return;
  }
  if (command.kind === "doctor") {
    process.stdout.write(
      JSON.stringify(await doctorProject(command.options)) + "\n",
    );
    return;
  }
  if (command.kind === "headless") {
    const result: IHeadlessProjectResult = await runHeadlessProject(
      command.options,
    );
    process.stdout.write(JSON.stringify(result) + "\n");
    process.exitCode =
      result.outcome === "completed" &&
      result.blenderOutcome === "exited" &&
      result.blender?.code === 0 &&
      result.blender.signal === null &&
      result.script?.outcome === "exited" &&
      result.script.result?.code === 0 &&
      result.script.result.signal === null &&
      result.cleanup === "removed"
        ? 0
        : 1;
    return;
  }
  if (command.jsonl === true) {
    const snapshot: IScriptJobSnapshot = await runMachineJob(
      command.kind === "run"
        ? { kind: "file", options: command.options }
        : {
            kind: "text",
            options: {
              ...command.options,
              text: readTextInput(command.inputFile, command.options.cwd),
            },
          },
    );
    const result: IProjectScriptResult | undefined = snapshot.result;
    const retained: boolean =
      result !== undefined &&
      "staging" in result &&
      result.staging === "retained";
    process.exitCode =
      snapshot.outcome === "exited" && !retained ? (result?.code ?? 1) : 1;
    return;
  }

  let result: IProjectScriptResult;
  let retained: boolean = false;
  if (command.kind === "run-text") {
    const text: string = readTextInput(command.inputFile, command.options.cwd);
    const macro: ITextMacroResult = await runTextMacro({
      ...command.options,
      text,
    });
    process.stderr.write(
      redactKnownToken(
        `blendia: Text origin ${JSON.stringify(macro.origin)}, source ${JSON.stringify(macro.sourcePath)}, staged ${JSON.stringify(macro.stagedPath)} (${macro.staging}).\n`,
        process.env.BLENDIA_TOKEN ?? "",
      ),
    );
    if (macro.cleanupError !== undefined)
      process.stderr.write(
        redactKnownToken(
          `blendia: ${macro.cleanupError}\n`,
          process.env.BLENDIA_TOKEN ?? "",
        ),
      );
    retained = macro.staging === "retained";
    result = macro;
  } else result = await runProjectScript(command.options);
  if (result.signal !== null) {
    process.stderr.write(
      redactKnownToken(
        `blendia: script launcher terminated by ${result.signal}.\n`,
        process.env.BLENDIA_TOKEN ?? "",
      ),
    );
    process.exitCode = 1;
  } else process.exitCode = retained ? 1 : (result.code ?? 1);
}

/** Read one regular UTF-8 input with a fixed cap even if the file grows during reading. */
function readTextInput(inputFile: string, cwd: string): string {
  const descriptor: number = fs.openSync(path.resolve(cwd, inputFile), "r");
  try {
    const info: fs.Stats = fs.fstatSync(descriptor);
    if (!info.isFile() || info.size > TEXT_MACRO_MAX_BYTES)
      throw new Error(
        `blendia: Text input must be a regular file of at most ${TEXT_MACRO_MAX_BYTES} UTF-8 bytes.`,
      );

    const bytes: Buffer = Buffer.alloc(TEXT_MACRO_MAX_BYTES + 1);
    let length: number = 0;
    while (length < bytes.length) {
      const count: number = fs.readSync(
        descriptor,
        bytes,
        length,
        bytes.length - length,
        null,
      );
      if (count === 0) break;
      length += count;
    }
    if (length > TEXT_MACRO_MAX_BYTES)
      throw new Error(
        `blendia: Text input exceeds ${TEXT_MACRO_MAX_BYTES} UTF-8 bytes.`,
      );
    return new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.subarray(0, length),
    );
  } finally {
    fs.closeSync(descriptor);
  }
}

void main().catch((error: unknown): void => {
  const message: string =
    error instanceof Error ? error.message : String(error);
  const token: string = process.env.BLENDIA_TOKEN ?? "";
  process.stderr.write(redactKnownToken(`${message}\n`, token));
  process.exitCode = 1;
});
