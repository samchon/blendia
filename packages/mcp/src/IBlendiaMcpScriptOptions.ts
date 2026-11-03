import type { IProjectScriptOptions } from "@blendia/runtime";

/** Saved project source launched through captured runtime jobs without public connection overrides. */
export interface IBlendiaMcpScriptOptions extends Omit<
  IProjectScriptOptions,
  "connection"
> {}
