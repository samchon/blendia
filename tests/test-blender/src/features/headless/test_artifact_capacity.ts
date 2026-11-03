import fs from "node:fs";
import path from "node:path";

import type { IBlenderTestContext } from "../../IBlenderTestContext";
import { prepareCpuSeed } from "../../internal/prepareCpuSeed";
import { runEngineRecipe } from "../../internal/runEngineRecipe";

/**
 * Enforce native artifact capacity and release ownership across real connection handoff.
 *
 * Scenarios:
 * 1. Four actual small CPU renders fill the documented retained-artifact population.
 * 2. A fifth start refuses before ID admission and leaves the four existing images readable.
 * 3. Disconnect/reconnect preserves known render/artifact identities; releasing one allows the refused new ID.
 * 4. Releasing private images leaves the explicitly exported PNG intact.
 *
 * @evidence contracts/blender.md#real-engine-boundary Public SDK calls create four genuine CPU PNGs and observe LIMIT_EXCEEDED from native store reservation. Real disconnect/reconnect reacquires the same engine lease; no fake file or timing/clock override fabricates capacity or expiry.
 * @evidence contracts/blender.md#independent-scene-and-image-expectations The documented four-artifact limit determines the fifth refusal. Existing PNG headers and byte counts remain readable, the rejected UUID has no job until an explicit later call after release, and a saved user's PNG stays byte-identical. TTL expiry and the 128-MiB aggregate-byte limit are not induced by these small images.
 * @evidence contracts/blender.md#process-and-file-ownership Release affects only a known private artifact; it neither removes public output nor requires a new Blender session. The actual runtime must separately observe script/native normal closure and remove private bootstrap storage. No accepted render is replayed and no process is killed.
 */
export async function test_artifact_capacity(
  context: IBlenderTestContext,
): Promise<void> {
  const directory: string = fs.mkdtempSync(
    path.join(context.outputDirectory, "capacity-"),
  );
  const seed: string = await prepareCpuSeed(context, directory);
  await runEngineRecipe(
    context,
    directory,
    "artifactCapacity",
    [path.join(directory, "retained.png")],
    seed,
  );
}
