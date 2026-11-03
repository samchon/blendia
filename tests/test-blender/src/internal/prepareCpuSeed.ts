import path from "node:path";

import type { IBlenderTestContext } from "../IBlenderTestContext";
import { runNativeBlender } from "./runNativeBlender";

/** Create a genuine Blender input file with CPU settings and an optional native shared mesh. */
export async function prepareCpuSeed(
  context: IBlenderTestContext,
  directory: string,
  kind: "empty" | "shared" = "empty",
): Promise<string> {
  const seed: string = path.join(directory, "cpu-seed.blend");
  await runNativeBlender(
    context.blenderExecutable,
    [
      "--background",
      "--factory-startup",
      "--disable-autoexec",
      "--python-exit-code",
      "1",
      "--python",
      path.join(context.projectDirectory, "assets", "prepare_seed.py"),
      "--",
      seed,
      kind,
    ],
    "cpu-seed",
    context.outputDirectory,
  );
  return seed;
}
