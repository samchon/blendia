import type { IBlenderConnectionOptions } from "@blendia/sdk";

/**
 * Run an existing project entry without copying it or changing its compiler configuration.
 *
 * @evidence contracts/common.md#principled-implementation Native paths identify the caller's real project; optional connection fields override only their corresponding inherited environment values.
 * @evidence contracts/common.md#clear-and-simple-design The CLI supplies this request to the shared launcher; socket ownership remains with the script's SDK client.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No generated bootstrap, temporary entry, or alternate TypeScript compiler is represented.
 * @evidence contracts/common.md#meaningful-documentation Property comments define path bases, argument ownership, and credential transport.
 * @evidence contracts/performance.md#efficient-algorithms This record retains caller-supplied path and argument data; execution costs belong to runProjectScript and ttsx.
 * @evidence contracts/performance.md#reuse-equivalent-work Each request represents an effectful run and is never memoized or coalesced.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns the input record; no process or socket is acquired by this type.
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
