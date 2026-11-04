import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { prepareNativeEnvironment } from "../../native/prepareNativeEnvironment.cjs";
import type { IProjectScriptOptions } from "../IProjectScriptOptions";
import type { IPreparedProjectLaunch } from "./IPreparedProjectLaunch";

/** Resolve the installed public ttsx bin and preserve the caller's source/cwd/arguments. */
export function prepareProjectLaunch(
  options: IProjectScriptOptions,
  environment: NodeJS.ProcessEnv = process.env,
): IPreparedProjectLaunch {
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
  const args: string[] = [
    path.resolve(path.dirname(packagePath), metadata.bin.ttsx),
  ];
  if (options.project !== undefined) args.push("--project", options.project);
  args.push(path.resolve(cwd, options.entry), ...(options.args ?? []));
  const env: NodeJS.ProcessEnv =
    prepareNativeEnvironment(environment).environment;
  if (options.connection?.port !== undefined)
    env.BLENDIA_PORT = String(options.connection.port);
  if (options.connection?.token !== undefined)
    env.BLENDIA_TOKEN = options.connection.token;
  return { executable: process.execPath, args, cwd, env };
}
