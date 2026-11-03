import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import type { IProjectScriptOptions } from "./IProjectScriptOptions";
import type { IProjectScriptResult } from "./IProjectScriptResult";

/**
 * Launch the installed ttsx CLI with the current Node executable and inherit the terminal streams.
 *
 * ttsx owns project checking, plugins, source maps, private emit, and its program child. This promise waits for the direct launcher to close; it provides no process-tree cancellation or Blender transaction guarantee.
 * The direct launcher's error is retained until close so failed startup does not settle before process handles do. The two listeners are removed at that boundary, and inherited stdio avoids retaining script output in this process.
 *
 * @evidence contracts/common.md#principled-implementation Resolve ttsx through its package's exported metadata and spawn process.execPath with an argument array, real cwd, and inherited environment; ttsx receives the original source entry.
 * @evidence contracts/common.md#clear-and-simple-design The real CLI consumes this single launch operation; SDK connection credentials are environment handoff data and do not create a second connection owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No shell command, global node lookup, temporary source copy, custom compiler, or replacement package resolver is used.
 * @evidence contracts/common.md#meaningful-documentation The contract distinguishes direct-child closure, inherited diagnostics, spawn rejection, and unsupported cancellation or rollback.
 */
export async function runProjectScript(
  options: IProjectScriptOptions,
): Promise<IProjectScriptResult> {
  if (options.entry.length === 0)
    throw new Error("blendia: a project entry is required.");

  const cwd: string = path.resolve(options.cwd ?? process.cwd());
  const packagePath: string = require.resolve("ttsc/package.json");
  const metadata: unknown = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    !("bin" in metadata) ||
    typeof metadata.bin !== "object" ||
    metadata.bin === null ||
    !("ttsx" in metadata.bin) ||
    typeof metadata.bin.ttsx !== "string"
  )
    throw new Error(
      "blendia: the installed ttsc package has no ttsx executable.",
    );

  const launcher: string = path.resolve(
    path.dirname(packagePath),
    metadata.bin.ttsx,
  );
  const args: string[] = [launcher];
  if (options.project !== undefined) args.push("--project", options.project);
  args.push(path.resolve(cwd, options.entry), ...(options.args ?? []));

  const env: NodeJS.ProcessEnv = { ...process.env };
  if (options.connection?.port !== undefined)
    env.BLENDIA_PORT = String(options.connection.port);
  if (options.connection?.token !== undefined)
    env.BLENDIA_TOKEN = options.connection.token;

  const child: ChildProcess = spawn(process.execPath, args, {
    cwd,
    env,
    shell: false,
    stdio: "inherit",
    windowsHide: true,
  });

  return new Promise<IProjectScriptResult>(
    (
      resolve: (result: IProjectScriptResult) => void,
      reject: (error: Error) => void,
    ): void => {
      let failure: Error | undefined;

      /**
       * Remember spawn failure until close has settled the process handles.
       */
      const onError: (error: Error) => void = (error: Error): void => {
        failure = error;
      };

      /**
       * Release launcher listeners and preserve its actual termination outcome.
       */
      const onClose: (
        code: number | null,
        signal: NodeJS.Signals | null,
      ) => void = (
        code: number | null,
        signal: NodeJS.Signals | null,
      ): void => {
        child.removeListener("error", onError);
        child.removeListener("close", onClose);
        if (failure !== undefined) reject(failure);
        else resolve({ code, signal });
      };

      child.once("error", onError);
      child.once("close", onClose);
    },
  );
}
