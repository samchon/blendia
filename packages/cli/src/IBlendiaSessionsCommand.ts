import type { IBlenderDiscoveryOptions } from "@blendia/runtime";

/** Explicit-directory metadata discovery; probing requires separate explicit consent. */
export interface IBlendiaSessionsCommand {
  /** Select explicit-directory discovery rather than script execution. */
  kind: "sessions";
  /** Directory and optional bounded hello probe admission. */
  options: IBlenderDiscoveryOptions;
}
