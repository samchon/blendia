import type { IBlendiaHeadlessCommand } from "./IBlendiaHeadlessCommand";

/** Admit only launcher options before the first entry; preserve the script-owned tail verbatim. */
export function parseHeadlessCommand(
  argv: readonly string[],
): IBlendiaHeadlessCommand {
  const values: Map<string, string> = new Map();
  let entry: string | undefined;
  let args: string[] = [];
  for (let index: number = 1; index < argv.length; index++) {
    const flag: string = argv[index];
    if (!flag.startsWith("-")) {
      if (flag.trim().length === 0)
        throw new Error("blendia: headless requires a nonblank project entry.");
      entry = flag;
      args = argv.slice(index + (argv[index + 1] === "--" ? 2 : 1));
      break;
    }
    if (
      ![
        "--blender",
        "--extension-directory",
        "--blend-file",
        "--cwd",
        "--project",
        "--startup-timeout-ms",
        "--shutdown-timeout-ms",
      ].includes(flag)
    )
      throw new Error(`blendia: unsupported headless option ${flag}.`);
    if (values.has(flag)) throw new Error(`blendia: ${flag} may appear once.`);
    const value: string | undefined = argv[index + 1];
    if (
      value === undefined ||
      value.trim().length === 0 ||
      value.startsWith("-")
    )
      throw new Error(`blendia: ${flag} requires an operand.`);
    values.set(flag, value);
    index++;
  }
  const blenderExecutable: string | undefined = values.get("--blender");
  const extensionDirectory: string | undefined = values.get(
    "--extension-directory",
  );
  if (
    entry === undefined ||
    blenderExecutable === undefined ||
    extensionDirectory === undefined
  )
    throw new Error(
      "blendia: headless requires --blender, --extension-directory, and a project entry.",
    );
  return {
    kind: "headless",
    options: {
      entry,
      blenderExecutable,
      extensionDirectory,
      cwd: values.get("--cwd"),
      project: values.get("--project"),
      blendFile: values.get("--blend-file"),
      startupTimeoutMs: timeout(values.get("--startup-timeout-ms")),
      shutdownTimeoutMs: timeout(values.get("--shutdown-timeout-ms")),
      args,
    },
  };
}

/** Deadline values bound only their named observation phase, never the user's TypeScript execution. */
function timeout(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed: number = Number(value);
  if (
    !/^\d+$/u.test(value) ||
    !Number.isSafeInteger(parsed) ||
    parsed < 100 ||
    parsed > 3600000
  )
    throw new Error(
      "blendia: headless timeouts require an integer from 100 through 3600000 ms.",
    );
  return parsed;
}
