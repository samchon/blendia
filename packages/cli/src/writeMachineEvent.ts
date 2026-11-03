import process from "node:process";

import type { IScriptMachineEvent } from "./IScriptMachineEvent";

/** Await each write callback so a slow observer cannot create an unbounded adapter queue. */
export async function writeMachineEvent(
  event: IScriptMachineEvent,
): Promise<void> {
  const line: string = JSON.stringify(event) + "\n";
  if (Buffer.byteLength(line, "utf8") > 65536)
    throw new Error("blendia: machine frame exceeded its 65536-byte bound.");
  await new Promise<undefined>(
    (
      resolve: (value: undefined) => void,
      reject: (error: Error) => void,
    ): void => {
      /** Observe broken-pipe errors instead of leaving an unhandled stream event. */
      const onError: (error: Error) => void = (error: Error): void => {
        reject(error);
      };
      process.stdout.once("error", onError);
      try {
        process.stdout.write(line, (error?: Error | null): void => {
          if (error !== undefined && error !== null) {
            reject(error);
            return;
          }
          process.stdout.removeListener("error", onError);
          resolve(undefined);
        });
      } catch (error) {
        process.stdout.removeListener("error", onError);
        reject(
          error instanceof Error ? error : new Error("Machine output failed."),
        );
      }
    },
  );
}
