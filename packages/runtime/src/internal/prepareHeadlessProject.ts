import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import type { IHeadlessProjectOptions } from "../IHeadlessProjectOptions";
import type { IPreparedHeadlessProject } from "./IPreparedHeadlessProject";

/** Refuse invalid options and missing explicit prerequisites before creating files or processes. */
export function prepareHeadlessProject(
  options: IHeadlessProjectOptions,
): IPreparedHeadlessProject {
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options) ||
    "connection" in options
  )
    throw new Error(
      "blendia: headless requires explicit options without an existing connection.",
    );
  for (const value of [
    options.entry,
    options.blenderExecutable,
    options.extensionDirectory,
  ])
    if (
      typeof value !== "string" ||
      value.trim().length === 0 ||
      value.includes("\0")
    )
      throw new Error(
        "blendia: headless requires nonblank entry, Blender executable, and extension directory paths.",
      );
  for (const value of [options.cwd, options.project, options.blendFile])
    if (
      value !== undefined &&
      (typeof value !== "string" ||
        value.trim().length === 0 ||
        value.includes("\0"))
    )
      throw new Error(
        "blendia: headless optional paths must be nonblank strings.",
      );
  if (
    options.args !== undefined &&
    (!Array.isArray(options.args) ||
      options.args.some(
        (value: unknown): boolean =>
          typeof value !== "string" || value.includes("\0"),
      ))
  )
    throw new Error(
      "blendia: headless script arguments must be strings without NUL.",
    );
  const startupTimeoutMs: number =
    options.startupTimeoutMs === undefined ? 120000 : options.startupTimeoutMs;
  const shutdownTimeoutMs: number =
    options.shutdownTimeoutMs === undefined ? 10000 : options.shutdownTimeoutMs;
  for (const value of [startupTimeoutMs, shutdownTimeoutMs])
    if (!Number.isSafeInteger(value) || value < 100 || value > 3600000)
      throw new Error(
        "blendia: headless observation deadlines must be integers from 100 through 3600000 ms.",
      );
  try {
    const cwd: string = fs.realpathSync(
      path.resolve(options.cwd ?? process.cwd()),
    );
    const executable: string = fs.realpathSync(
      path.resolve(cwd, options.blenderExecutable),
    );
    const extensionDirectory: string = fs.realpathSync(
      path.resolve(cwd, options.extensionDirectory),
    );
    const bootstrap: string = path.join(
      extensionDirectory,
      "headless_bootstrap.py",
    );
    const blendFile: string | undefined =
      options.blendFile === undefined
        ? undefined
        : fs.realpathSync(path.resolve(cwd, options.blendFile));
    if (
      !fs.statSync(cwd).isDirectory() ||
      !fs.statSync(extensionDirectory).isDirectory() ||
      !fs.statSync(executable).isFile() ||
      !fs.lstatSync(bootstrap).isFile() ||
      (blendFile !== undefined &&
        (!blendFile.toLowerCase().endsWith(".blend") ||
          !fs.statSync(blendFile).isFile()))
    )
      throw new Error("Invalid explicit headless path.");
    fs.accessSync(bootstrap, fs.constants.R_OK);
    return {
      options: { ...options, args: options.args?.slice() },
      cwd,
      executable,
      bootstrap,
      blendFile,
      startupTimeoutMs,
      shutdownTimeoutMs,
    };
  } catch {
    throw new Error(
      "blendia: explicit headless Blender, extension bootstrap, project directory, or input .blend is unavailable.",
    );
  }
}
