import process from "node:process";

import type { IProjectScriptOptions } from "../IProjectScriptOptions";

/**
 * Snapshot the connection values that the child will receive, without changing its caller.
 *
 * Windows child environments keep the lexicographically first case-insensitive key,
 * including an undefined first alias that suppresses later aliases. Canonicalizing
 * only these two credentials keeps capture redaction and child selection aligned.
 * Owned headless launches discard inherited credentials before any explicit override.
 */
export function prepareConnectionEnvironment(
  environment: NodeJS.ProcessEnv,
  connection?: IProjectScriptOptions["connection"],
  clearInherited: boolean = false,
): NodeJS.ProcessEnv {
  const copied: NodeJS.ProcessEnv = { ...environment };
  for (const name of ["BLENDIA_PORT", "BLENDIA_TOKEN"]) {
    const aliases: string[] =
      process.platform === "win32"
        ? Object.keys(copied)
            .sort((left: string, right: string): number =>
              left < right ? -1 : left > right ? 1 : 0,
            )
            .filter((key: string): boolean => key.toUpperCase() === name)
        : [name];
    const selected: string | undefined =
      aliases.length === 0 ? undefined : copied[aliases[0]];
    for (const alias of aliases) delete copied[alias];
    if (!clearInherited && selected !== undefined) copied[name] = selected;
  }
  if (connection?.port !== undefined)
    copied.BLENDIA_PORT = String(connection.port);
  if (connection?.token !== undefined) copied.BLENDIA_TOKEN = connection.token;
  return copied;
}
