import fs from "node:fs";
import path from "node:path";

import type { IBlenderTestContext } from "../../IBlenderTestContext";
import { prepareCpuSeed } from "../../internal/prepareCpuSeed";
import { runEngineRecipe } from "../../internal/runEngineRecipe";

/**
 * Keep the live writer lease and object identity distinct from names and new owned sessions.
 *
 * Scenarios:
 * 1. A real second hello receives BUSY while invalid credentials receive UNAUTHORIZED.
 * 2. Distinct same-name cubes retain independent UIDs and transforms across disconnect/reconnect.
 * 3. setActive false leaves the selected camera unchanged.
 * 4. A fresh Blender reopens the saved scene and rejects the former session's public object handle.
 *
 * @evidence contracts/blender.md#real-engine-boundary The source fixtures use public BlenderClient connections against actual runHeadlessProject bridges; no socket, server or native mutation is substituted. Rename/delete/undo and current-session load are not exposed by the SDK and are not claimed here.
 * @evidence contracts/blender.md#independent-scene-and-image-expectations Two explicitly named cubes must receive different decimal identities and retain independent literal transforms. Active camera selection changes only with setActive true. A saved public handle belongs to the first actual session, while the second native launch must have a different session identity; this scenario does not render an image.
 * @evidence contracts/blender.md#process-and-file-ownership Explicit disconnect releases only the writer lease and preserves scene data. Each real one-shot invocation separately requires script/native exit zero and private cleanup through runEngineRecipe; public handle JSON and the native saved copy remain explicit outputs without credentials.
 */
export async function test_session_ownership(
  context: IBlenderTestContext,
): Promise<void> {
  const directory: string = fs.mkdtempSync(
    path.join(context.outputDirectory, "session-"),
  );
  const seed: string = await prepareCpuSeed(context, directory);
  const saved: string = path.join(directory, "session.blend");
  const handle: string = path.join(directory, "object-handle.json");
  await runEngineRecipe(context, directory, "session", [saved, handle], seed);
  await runEngineRecipe(context, directory, "foreignSession", [handle], saved);
}
