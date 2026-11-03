import type { IHeadlessProjectResult } from "@blendia/runtime";

/** Observed headless result with private retained bootstrap-directory metadata suppressed. */
export interface IBlendiaMcpHeadlessResult extends Omit<
  IHeadlessProjectResult,
  "retainedDirectory"
> {}
