import {
  type IHeadlessProjectResult,
  runHeadlessProject,
} from "@blendia/runtime";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { IBlenderTestContext } from "../IBlenderTestContext";
import { BlenderEngineAdmission } from "./BlenderEngineAdmission";

/** Execute a real source recipe and require separately observed script/native success and private cleanup. */
export async function runEngineRecipe(
  context: IBlenderTestContext,
  directory: string,
  fixture: string,
  args: readonly string[],
  blendFile: string,
): Promise<IHeadlessProjectResult> {
  BlenderEngineAdmission.assertOpen();
  const result: IHeadlessProjectResult = await runHeadlessProject({
    blenderExecutable: context.blenderExecutable,
    extensionDirectory: context.extensionDirectory,
    cwd: context.projectDirectory,
    project: "tsconfig.json",
    entry: `src/fixtures/${fixture}.ts`,
    args,
    blendFile,
    startupTimeoutMs: 120000,
    shutdownTimeoutMs: 30000,
  });
  if (result.outcome === "unknown" || result.blenderOutcome === "unknown")
    BlenderEngineAdmission.stop(fixture);
  fs.writeFileSync(
    path.join(directory, `${fixture}-result.json`),
    JSON.stringify(result, null, 2),
  );
  assert.equal(result.outcome, "completed");
  assert.equal(result.script?.phase, "terminal");
  assert.equal(result.script?.outcome, "exited");
  assert.deepEqual(result.script?.result, { code: 0, signal: null });
  assert.equal(result.blenderOutcome, "exited");
  assert.deepEqual(result.blender, { code: 0, signal: null });
  assert.equal(result.cleanup, "removed");
  assert.equal(result.retainedDirectory, undefined);
  assert.equal(result.diagnostic, undefined);
  assert.equal(
    fs
      .readdirSync(context.temporaryDirectory)
      .some((name: string): boolean => name.startsWith("blendia-headless-")),
    false,
  );
  return result;
}
