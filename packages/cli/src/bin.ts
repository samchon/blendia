#!/usr/bin/env node
import { type IProjectScriptResult, runProjectScript } from "@blendia/runtime";
import process from "node:process";

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
        "       blendia --help",
        "",
        "Run existing project TypeScript through ttsx using the current Node executable.",
        "Options belong before the entry; all later arguments belong to the script.",
        "One -- immediately after the entry is removed as the CLI separator.",
        "BLENDIA_PORT and BLENDIA_TOKEN are inherited by the script's SDK client.",
        "Start Blender's Blendia extension and set its credentials before a Blender script.",
        "",
      ].join("\n"),
    );
    return;
  }

  const result: IProjectScriptResult = await runProjectScript(command.options);
  if (result.signal !== null) {
    process.stderr.write(
      `blendia: script launcher terminated by ${result.signal}.\n`,
    );
    process.exitCode = 1;
  } else process.exitCode = result.code ?? 1;
}

void main().catch((error: unknown): void => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
