import type { IScriptGapEvent } from "./IScriptGapEvent";
import type { IScriptLogEvent } from "./IScriptLogEvent";
import type { IScriptSnapshotEvent } from "./IScriptSnapshotEvent";

/** The only JSONL envelopes emitted by captured run/run-text. */
export type IScriptMachineEvent =
  IScriptSnapshotEvent | IScriptLogEvent | IScriptGapEvent;
