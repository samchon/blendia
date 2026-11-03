import fs from "node:fs";
import path from "node:path";

import type { IBlenderTestContext } from "../../IBlenderTestContext";
import { prepareCpuSeed } from "../../internal/prepareCpuSeed";
import { runEngineRecipe } from "../../internal/runEngineRecipe";

/**
 * Require native camera admission and preserve accepted render identity without replay.
 *
 * Scenarios:
 * 1. A real empty scene refuses rendering and does not register the rejected caller ID.
 * 2. An explicitly active camera admits that previously rejected ID and produces a native PNG.
 * 3. The accepted ID rejects duplicate start before effects; get returns the same retained artifact.
 *
 * @evidence contracts/blender.md#real-engine-boundary Real CPU Blender receives public SDK render calls through runHeadlessProject, including native no-camera admission. The scenario does not substitute callbacks or claim GUI cancellation/progress behavior.
 * @evidence contracts/blender.md#independent-scene-and-image-expectations An empty seed has no active camera, so no job can exist for the rejected UUID. Explicit camera selection then allows a 32-pixel native PNG whose signature and original handle remain readable after DUPLICATE_ID. No cross-render image equality is asserted.
 * @evidence contracts/blender.md#process-and-file-ownership Only a rejected no-effect request is issued again after the camera context deliberately changes. Accepted IDs are inspected instead of replayed; public native/script closure and private cleanup are required independently of rendering success, and the published PNG survives artifact release.
 */
export async function test_render_admission(
  context: IBlenderTestContext,
): Promise<void> {
  const directory: string = fs.mkdtempSync(
    path.join(context.outputDirectory, "render-admission-"),
  );
  const seed: string = await prepareCpuSeed(context, directory);
  await runEngineRecipe(
    context,
    directory,
    "renderAdmission",
    [path.join(directory, "admitted.png")],
    seed,
  );
}
