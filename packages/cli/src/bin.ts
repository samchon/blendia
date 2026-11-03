#!/usr/bin/env node
import {
  type IProjectScriptResult,
  type ITextMacroResult,
  TEXT_MACRO_MAX_BYTES,
  runProjectScript,
  runTextMacro,
} from "@blendia/runtime";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { TextDecoder } from "node:util";

import type { IBlendiaCommand } from "./IBlendiaCommand";
import { parseBlendiaCommand } from "./parseBlendiaCommand";

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
        "Usage: blendia run [--cwd <dir>] [--project <tsconfig>] <entry> [-- <script args...>]",
        "       blendia run-text --cwd <dir> --source-path <logical.ts> --input-file <utf8> [--project <tsconfig>] [--origin <label>] [-- <script args...>]",
        "       blendia --help",
        "",
        "Run existing project TypeScript through ttsx using the current Node executable.",
        "Options belong before the entry; all later arguments belong to the script.",
        "One -- immediately after the entry is removed as the CLI separator.",
        "run-text reads at most 256 KiB of UTF-8 and stages a sibling module; its -- starts script arguments.",
        "BLENDIA_PORT and BLENDIA_TOKEN are inherited by the script's SDK client.",
        "Start Blender's Blendia extension and set its credentials before a Blender script.",
        "",
      ].join("\n"),
    );
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
      `blendia: Text origin ${JSON.stringify(macro.origin)}, source ${JSON.stringify(macro.sourcePath)}, staged ${JSON.stringify(macro.stagedPath)} (${macro.staging}).\n`,
    );
    if (macro.cleanupError !== undefined)
      process.stderr.write(`blendia: ${macro.cleanupError}\n`);
    retained = macro.staging === "retained";
    result = macro;
  } else result = await runProjectScript(command.options);
  if (result.signal !== null) {
    process.stderr.write(
      `blendia: script launcher terminated by ${result.signal}.\n`,
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
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
