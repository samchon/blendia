import type { IBlenderConnectionOptions } from "@blendia/sdk";

import type { IBlendiaMcpHeadlessConfiguration } from "./IBlendiaMcpHeadlessConfiguration";

/** Private server-factory settings; credentials never become model tool parameters. */
export interface IBlendiaMcpOptions {
  /** Explicit connection overrides; omitted credentials are snapshotted from the Blendia environment. */
  connection?: IBlenderConnectionOptions;

  /** Optional preconfigured one-shot runner prerequisites. */
  headless?: IBlendiaMcpHeadlessConfiguration;
}
