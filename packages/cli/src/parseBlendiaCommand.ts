import type { IProjectScriptOptions } from "@blendia/runtime";

import type { IBlendiaCommand } from "./IBlendiaCommand";

/**
 * Parse Blendia options only before the entry; the script owns every later argument.
 *
 * An immediate post-entry -- is the CLI separator and is removed once. Later -- tokens and options remain untouched. Repeated, unknown, empty, and missing launcher operands are refused rather than silently changing the project.
 */
export function parseBlendiaCommand(argv: readonly string[]): IBlendiaCommand {
  if (
    argv.length === 0 ||
    (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) ||
    (argv.length === 2 &&
      argv[0] === "run" &&
      (argv[1] === "--help" || argv[1] === "-h"))
  )
    return { kind: "help" };
  if (argv[0] !== "run") throw new Error("blendia: expected run or --help.");

  let cwd: string | undefined;
  let project: string | undefined;
  for (let index: number = 1; index < argv.length; index++) {
    const argument: string = argv[index];
    if (argument === "--cwd" || argument === "--project") {
      const value: string | undefined = argv[index + 1];
      if (
        value === undefined ||
        value.trim().length === 0 ||
        value.startsWith("-")
      )
        throw new Error(`blendia: ${argument} requires a path operand.`);
      if (argument === "--cwd") {
        if (cwd !== undefined)
          throw new Error("blendia: --cwd may appear once.");
        cwd = value;
      } else {
        if (project !== undefined)
          throw new Error("blendia: --project may appear once.");
        project = value;
      }
      index++;
      continue;
    }
    if (argument.startsWith("-"))
      throw new Error(`blendia: unsupported option ${argument}.`);
    if (argument.trim().length === 0)
      throw new Error("blendia: a nonblank project entry is required.");

    const tailIndex: number = index + (argv[index + 1] === "--" ? 2 : 1);
    const options: IProjectScriptOptions = {
      entry: argument,
      cwd,
      project,
      args: argv.slice(tailIndex),
    };
    return { kind: "run", options };
  }
  throw new Error("blendia: a project entry is required after run.");
}
