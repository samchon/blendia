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
 * 4. The installed artifact owner admits the complete native PNG and rejects truncated or checksum-corrupt copies before success.
 *
 * @evidence contracts/blender.md#real-engine-boundary Public SDK calls render and publish genuine native outputs to invocation-owned files. The existing separate Blender load validates the saved transform, decodes the native PNG and exercises actual ArtifactStore/BridgeError modules resolved only from the verified installed extension against real owned files; no methods, filesystem or native callback are replaced.
 * @evidence contracts/blender.md#independent-scene-and-image-expectations Literal sentinel bytes establish no-clobber behavior, a user edit cannot change private PNG bytes, and the saved Cube location is 3/2/1. The authentic 32-pixel PNG supplies byte identity and native decoding for complete adoption/read/export, while its 33-byte header, mid-IDAT prefix, missing IEND and changed data byte independently establish invalid inputs. Chunk walking locates cuts without implementing the production validator; native I/O failure injection and exhaustive codec compliance are not claimed.
 * @evidence contracts/blender.md#process-and-file-ownership Reserved malformed stages are explicitly discarded and the actual store closes after the whole integrity round. The source seed, published PNG/.blend and user backup remain unchanged by readback; releasing the valid private artifact preserves its separate export. Public script/native closure and private cleanup remain separate requirements, with racer injection, unsafe-image autosave, parent loss, unknown observation and GUI interaction unclaimed.
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
  const pngHash: string = createHash("sha256")
    .update(fs.readFileSync(png))
    .digest("hex");
  const savedHash: string = createHash("sha256")
    .update(fs.readFileSync(saved))
    .digest("hex");
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
      png,
      context.extensionDirectory,
      path.join(directory, "publication-native-observation.json"),
    ],
    "publication-native-readback",
    context.outputDirectory,
  );
  assert.equal(
    createHash("sha256").update(fs.readFileSync(png)).digest("hex"),
    pngHash,
  );
  assert.equal(
    createHash("sha256").update(fs.readFileSync(saved)).digest("hex"),
    savedHash,
  );
  assert.equal(fs.readFileSync(`${saved}1`, "utf8"), "KEEP USER BACKUP");
}
