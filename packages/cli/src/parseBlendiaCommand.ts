import type { IProjectScriptOptions } from "@blendia/runtime";

import type { IBlendiaCommand } from "./IBlendiaCommand";
import type { IBlendiaTextCommand } from "./IBlendiaTextCommand";

/**
 * Parse saved-file and Text commands without consuming their script arguments.
 *
 * For run, one immediate post-entry -- is removed. For run-text, the first -- ends option parsing and all later tokens are arguments. Text requires cwd, source-path, and input-file pairs; origin is optional. Repeated, unknown, empty, and missing launcher operands are refused.
 */
export function parseBlendiaCommand(argv: readonly string[]): IBlendiaCommand {
  if (
    argv.length === 0 ||
    (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) ||
    (argv.length === 2 &&
      (argv[0] === "run" || argv[0] === "run-text") &&
      (argv[1] === "--help" || argv[1] === "-h"))
  )
    return { kind: "help" };
  if (argv[0] === "run-text") return parseTextCommand(argv);
  if (argv[0] !== "run")
    throw new Error("blendia: expected run, run-text, or --help.");

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

/** Admit Text path pairs before its separator without inspecting the script tail. */
function parseTextCommand(argv: readonly string[]): IBlendiaTextCommand {
  const values: Map<string, string> = new Map();
  let args: readonly string[] = [];
  for (let index: number = 1; index < argv.length; index++) {
    const argument: string = argv[index];
    if (argument === "--") {
      args = argv.slice(index + 1);
      break;
    }
    if (
      ![
        "--cwd",
        "--project",
        "--source-path",
        "--input-file",
        "--origin",
      ].includes(argument)
    )
      throw new Error(`blendia: unsupported run-text option ${argument}.`);
    if (values.has(argument))
      throw new Error(`blendia: ${argument} may appear once.`);

    const value: string | undefined = argv[index + 1];
    if (
      value === undefined ||
      value.trim().length === 0 ||
      value === "--" ||
      (argument !== "--origin" && value.startsWith("-"))
    )
      throw new Error(`blendia: ${argument} requires an operand.`);
    values.set(argument, value);
    index++;
  }

  const cwd: string | undefined = values.get("--cwd");
  const sourcePath: string | undefined = values.get("--source-path");
  const inputFile: string | undefined = values.get("--input-file");
  if (cwd === undefined || sourcePath === undefined || inputFile === undefined)
    throw new Error(
      "blendia: run-text requires --cwd, --source-path, and --input-file.",
    );
  return {
    kind: "run-text",
    inputFile,
    options: {
      cwd,
      sourcePath,
      project: values.get("--project"),
      origin: values.get("--origin"),
      args,
    },
  };
}
