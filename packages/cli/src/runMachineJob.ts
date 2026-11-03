import {
  type IScriptJobRequest,
  type IScriptJobSnapshot,
  type IScriptLogPage,
  type ScriptJob,
  startScriptJob,
} from "@blendia/runtime";
import { setTimeout } from "node:timers/promises";

import { writeMachineEvent } from "./writeMachineEvent";

/** Render captured observations with backpressure, then commit terminal only after its log tail. */
export async function runMachineJob(
  request: IScriptJobRequest,
): Promise<IScriptJobSnapshot> {
  const job: ScriptJob = startScriptJob(request);
  let cursor: number = 0;
  let previousPhase: IScriptJobSnapshot["phase"] | undefined;
  try {
    for (;;) {
      const snapshot: IScriptJobSnapshot = job.inspect();
      if (snapshot.phase !== previousPhase) {
        await writeMachineEvent({ type: "snapshot", snapshot });
        previousPhase = snapshot.phase;
      }
      const page: IScriptLogPage = job.readLog(cursor);
      if (page.gap) {
        await writeMachineEvent({
          type: "gap",
          id: snapshot.id,
          ownerId: snapshot.ownerId,
          earliestCursor: page.earliestCursor,
          nextCursor: page.earliestCursor,
        });
      }
      for (const entry of page.entries)
        await writeMachineEvent({
          type: "log",
          id: snapshot.id,
          ownerId: snapshot.ownerId,
          entry,
        });
      cursor = page.nextCursor;

      // Once terminal there are no further entries; slow writes can still require multiple pages.
      const current: IScriptJobSnapshot = job.inspect();
      if (current.phase === "terminal" && cursor === current.tailCursor) {
        await writeMachineEvent({ type: "terminal", snapshot: current });
        return current;
      }
      if (!page.hasMore) await setTimeout(25);
    }
  } catch {
    // A broken/oversized frame is an observer failure, never successful process completion.
    const snapshot: IScriptJobSnapshot = job.inspect();
    const unknown: IScriptJobSnapshot = {
      id: snapshot.id,
      ownerId: snapshot.ownerId,
      phase: "terminal",
      outcome: "unknown",
      result: { code: null, signal: null },
      metadataTruncated: true,
      diagnostic:
        "Machine observation failed; staging may be retained and execution may remain active.",
      earliestCursor: snapshot.earliestCursor,
      tailCursor: snapshot.tailCursor,
    };
    await writeMachineEvent({ type: "terminal", snapshot: unknown });
    return unknown;
  } finally {
    if (job.inspect().phase === "terminal") job.close();
  }
}
