import { ScriptJob } from "./ScriptJob";

/** Look up a retained record in this process only; another CLI invocation has a different owner. */
export function getScriptJob(id: string): ScriptJob | undefined {
  return ScriptJob.get(id);
}
