import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { IBlenderTestContext } from "../../IBlenderTestContext";
import { prepareCpuSeed } from "../../internal/prepareCpuSeed";
import { runEngineRecipe } from "../../internal/runEngineRecipe";
import { runNativeBlender } from "../../internal/runNativeBlender";

/**
 * Reject material reassignment of actual shared native mesh data without altering either sibling.
 *
 * Scenarios:
 * 1. Real native preparation creates two objects sharing one two-face mesh and original material.
 * 2. Public SDK assignment rejects with INVALID_ARGUMENT and no effects for both objects.
 * 3. Independent native reopening finds the original shared data, slots, faces and shader unchanged.
 *
 * @evidence contracts/blender.md#real-engine-boundary The seed contains genuine bpy shared mesh data. Public runHeadlessProject and BlenderClient perform the rejected assignments, and a separate native Blender load inspects the saved result rather than replacing scene methods or comparing source patterns.
 * @evidence contracts/blender.md#independent-scene-and-image-expectations Literal four vertices, two triangles, two shared users, Original Shared Material, RGB 0.2/0.4/0.6, and unchanged face slot zero are the native oracle. The deliberately created replacement material may exist but cannot become either sibling's assignment; no render is needed for this data-safety boundary.
 * @evidence contracts/blender.md#process-and-file-ownership The seed hash is preserved, the post-refusal copy remains an explicit output, and the public invocation must observe script/native success and private cleanup. No rejected mutation is retried or rolled back by the test.
 */
export async function test_shared_material_refusal(
  context: IBlenderTestContext,
): Promise<void> {
  const directory: string = fs.mkdtempSync(
    path.join(context.outputDirectory, "shared-"),
  );
  const seed: string = await prepareCpuSeed(context, directory, "shared");
  const before: string = createHash("sha256")
    .update(fs.readFileSync(seed))
    .digest("hex");
  const saved: string = path.join(directory, "shared-preserved.blend");
  await runEngineRecipe(context, directory, "sharedMaterial", [saved], seed);
  assert.equal(
    createHash("sha256").update(fs.readFileSync(seed)).digest("hex"),
    before,
  );
  await runNativeBlender(
    context.blenderExecutable,
    [
      "--background",
      "--factory-startup",
      "--disable-autoexec",
      saved,
      "--python-exit-code",
      "1",
      "--python",
      path.join(context.projectDirectory, "assets", "inspect_shared.py"),
      "--",
      path.join(directory, "shared-native-observation.json"),
    ],
    "shared-native-readback",
    context.outputDirectory,
  );
}
