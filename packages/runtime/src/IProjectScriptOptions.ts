import type { IBlenderConnectionOptions } from "@blendia/sdk";

/**
 * Run an existing project entry without copying it or changing its compiler configuration.
 */
export interface IProjectScriptOptions {
  /** Existing entry path, resolved relative to cwd. */
  entry: string;

  /** Invocation directory; defaults to the calling process's current directory. */
  cwd?: string;

  /** Explicit tsconfig path relative to cwd; omission delegates project discovery to ttsx. */
  project?: string;

  /** Script arguments after the entry, preserved without parsing or shell expansion. */
  args?: readonly string[];

  /** Optional SDK connection fields passed through BLENDIA_PORT and BLENDIA_TOKEN; no socket is opened here. */
  connection?: Pick<IBlenderConnectionOptions, "port" | "token">;
}
