import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { IBlenderTestContext } from "../../IBlenderTestContext";
import { prepareCpuSeed } from "../../internal/prepareCpuSeed";
import { runEngineRecipe } from "../../internal/runEngineRecipe";
import { runNativeBlender } from "../../internal/runNativeBlender";

/**
 * Publish native files only with explicit replacement consent and preserve independent user backups.
 *
 * Scenarios:
 * 1. Existing PNG and .blend destinations refuse implicit overwrite without changing their bytes.
 * 2. Explicit overwrite publishes real outputs, and modifying a user's PNG cannot alter the private artifact.
 * 3. Native .blend replacement preserves an existing user .blend1 backup and saves the final cube transform.
 *
 * @evidence contracts/blender.md#real-engine-boundary Public SDK calls render and publish genuine native outputs to invocation-owned files. A separate actual Blender load validates the final saved transform. This exercises filesystem publication, not a mocked link/replace operation or a distribution smoke check.
 * @evidence contracts/blender.md#independent-scene-and-image-expectations Literal sentinel file/backup bytes establish no-clobber expectations. The published PNG must equal independently read private bytes even after the user copy is modified; the final saved Cube location is exactly 3/2/1. The original seed hash stays unchanged, but direct before/after bpy.data.filepath observation is outside the public SDK and is not claimed.
 * @evidence contracts/blender.md#process-and-file-ownership All paths are explicit outputs in a reserved case directory; existing backup bytes survive both native replacements. The source seed is not overwritten, artifact release cannot erase exports, and script/native closure plus private cleanup remain separate requirements. Concurrent racer injection, unsafe-image autosave, parent loss and unknown observation are not forced here.
 */
export async function test_output_publication(
  context: IBlenderTestContext,
): Promise<void> {
  const directory: string = fs.mkdtempSync(
    path.join(context.outputDirectory, "publication-"),
  );
  const seed: string = await prepareCpuSeed(context, directory);
  const before: string = createHash("sha256")
    .update(fs.readFileSync(seed))
    .digest("hex");
  const png: string = path.join(directory, "publication.png");
  const saved: string = path.join(directory, "publication.blend");
  await runEngineRecipe(
    context,
    directory,
    "outputPublication",
    [png, saved],
    seed,
  );
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
      path.join(context.projectDirectory, "assets", "inspect_publication.py"),
      "--",
      path.join(directory, "publication-native-observation.json"),
    ],
    "publication-native-readback",
    context.outputDirectory,
  );
  assert.equal(fs.readFileSync(`${saved}1`, "utf8"), "KEEP USER BACKUP");
}
