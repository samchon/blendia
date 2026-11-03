import type { IScriptJobSnapshot } from "@blendia/runtime";

/** Phase observation; terminal type additionally commits the fully emitted log tail. */
export interface IScriptSnapshotEvent {
  /** Terminal is emitted only after all observed log entries or gaps are accounted for. */
  type: "snapshot" | "terminal";
  /** Bounded public observation, including correlation identity. */
  snapshot: IScriptJobSnapshot;
}
