import {
  type IHeadlessProjectResult,
  type IScriptLogEntry,
  type IScriptLogPage,
  runHeadlessProject,
} from "@blendia/runtime";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { IBlenderTestContext } from "../../IBlenderTestContext";
import { BlenderEngineAdmission } from "../../internal/BlenderEngineAdmission";
import { runNativeBlender } from "../../internal/runNativeBlender";

/**
 * Publish real native scene/image outputs and preserve them across a fresh owned script failure.
 *
 * Scenarios:
 * 1. Public SDK calls author bounded geometry, materials, an active camera and area light in actual CPU Blender.
 * 2. Native rendering streams and exports the same PNG, refuses implicit overwrite, and releases only private artifacts.
 * 3. A fresh runtime opens the saved .blend, observes authored objects, changes its own scene, and reports script 1 separately from Blender 0.
 * 4. Independent native readback checks saved topology, shading, aim, illumination and decoded image variation; explicit outputs remain unchanged.
 *
 * @evidence contracts/blender.md#real-engine-boundary The actual public runHeadlessProject launches fresh background Blender processes and executes source fixtures through public BlenderClient APIs. Separate public --python native assertions inspect the saved result; neither GUI clicks, arbitrary bpy parity nor upstream typia correctness is claimed.
 * @evidence contracts/blender.md#independent-scene-and-image-expectations Fixed five-vertex/five-face pyramid coordinates, Principled RGB and factors, 50 mm aimed camera, 1000 W square light, 128-pixel PNG structure and decoded variation determine expectations. Native Python inspects saved bpy data independently of SDK result decoding; hashes only detect overwrites and do not assert cross-render equality.
 * @evidence contracts/blender.md#process-and-file-ownership Both public invocations must report completed lifetimes, separate script/native codes, removed private storage and no retained directory. The ordinary second-script error cannot erase the first outputs; unexpected unknown results fail without replay, killing processes or deleting retained private storage. The runner reserves its own output/TEMP root and preserves all user outputs.
 */
export async function test_scene_roundtrip(
  context: IBlenderTestContext,
): Promise<void> {
  const directory: string = fs.mkdtempSync(
    path.join(context.outputDirectory, "roundtrip-"),
  );
  const seed: string = path.join(directory, "cpu-seed.blend");
  const png: string = path.join(directory, "scene.png");
  const blend: string = path.join(directory, "scene.blend");
  const assets: string = path.join(context.projectDirectory, "assets");
  await runNativeBlender(
    context.blenderExecutable,
    [
      "--background",
      "--factory-startup",
      "--disable-autoexec",
      "--python-exit-code",
      "1",
      "--python",
      path.join(assets, "prepare_seed.py"),
      "--",
      seed,
    ],
    "roundtrip-cpu-seed",
    context.outputDirectory,
  );
  const seedHash: string = createHash("sha256")
    .update(fs.readFileSync(seed))
    .digest("hex");
  BlenderEngineAdmission.assertOpen();
  const author: IHeadlessProjectResult = await runHeadlessProject({
    blenderExecutable: context.blenderExecutable,
    extensionDirectory: context.extensionDirectory,
    blendFile: seed,
    cwd: context.projectDirectory,
    project: "tsconfig.json",
    entry: "src/fixtures/scene.ts",
    args: [png, blend],
    startupTimeoutMs: 120000,
    shutdownTimeoutMs: 30000,
  });
  if (author.outcome === "unknown" || author.blenderOutcome === "unknown")
    BlenderEngineAdmission.stop("roundtrip-author");
  fs.writeFileSync(
    path.join(directory, "author-result.json"),
    JSON.stringify(author, null, 2),
  );
  assert.equal(author.outcome, "completed");
  assert.equal(author.script?.phase, "terminal");
  assert.equal(author.script?.outcome, "exited");
  assert.deepEqual(author.script?.result, { code: 0, signal: null });
  assert.equal(author.blenderOutcome, "exited");
  assert.deepEqual(author.blender, { code: 0, signal: null });
  assert.equal(author.cleanup, "removed");
  assert.equal(author.retainedDirectory, undefined);
  assert.equal(author.diagnostic, undefined);
  assert.equal(
    createHash("sha256").update(fs.readFileSync(seed)).digest("hex"),
    seedHash,
  );
  assert.equal(
    fs
      .readdirSync(context.temporaryDirectory)
      .some((name: string): boolean => name.startsWith("blendia-headless-")),
    false,
  );

  const pngHash: string = createHash("sha256")
    .update(fs.readFileSync(png))
    .digest("hex");
  const blendHash: string = createHash("sha256")
    .update(fs.readFileSync(blend))
    .digest("hex");
  BlenderEngineAdmission.assertOpen();
  const reopened: IHeadlessProjectResult = await runHeadlessProject({
    blenderExecutable: context.blenderExecutable,
    extensionDirectory: context.extensionDirectory,
    blendFile: blend,
    cwd: context.projectDirectory,
    project: "tsconfig.json",
    entry: "src/fixtures/reopen.ts",
    args: [],
    startupTimeoutMs: 120000,
    shutdownTimeoutMs: 30000,
  });
  if (reopened.outcome === "unknown" || reopened.blenderOutcome === "unknown")
    BlenderEngineAdmission.stop("roundtrip-reopen");
  fs.writeFileSync(
    path.join(directory, "reopen-result.json"),
    JSON.stringify(reopened, null, 2),
  );
  assert.equal(reopened.outcome, "completed");
  assert.equal(reopened.script?.phase, "terminal");
  assert.equal(reopened.script?.outcome, "exited");
  assert.deepEqual(reopened.script?.result, { code: 1, signal: null });
  assert.equal(reopened.blenderOutcome, "exited");
  assert.deepEqual(reopened.blender, { code: 0, signal: null });
  assert.equal(reopened.cleanup, "removed");
  assert.equal(reopened.retainedDirectory, undefined);
  assert.equal(reopened.diagnostic, undefined);
  const scriptOutput: string = reopened.scriptLogs
    .flatMap((page: IScriptLogPage): string[] =>
      page.entries.map((entry: IScriptLogEntry): string => entry.text),
    )
    .join("");
  assert.ok(scriptOutput.includes("BLENDIA_REOPENED_SCENE_OK"));
  assert.ok(scriptOutput.includes("BLENDIA_PARTIAL_MUTATION_OK"));
  assert.ok(scriptOutput.includes("BLENDIA_EXPECTED_APPLICATION_ERROR"));
  assert.equal(
    createHash("sha256").update(fs.readFileSync(png)).digest("hex"),
    pngHash,
  );
  assert.equal(
    createHash("sha256").update(fs.readFileSync(blend)).digest("hex"),
    blendHash,
  );
  assert.equal(
    fs
      .readdirSync(context.temporaryDirectory)
      .some((name: string): boolean => name.startsWith("blendia-headless-")),
    false,
  );

  await runNativeBlender(
    context.blenderExecutable,
    [
      "--background",
      "--factory-startup",
      "--disable-autoexec",
      blend,
      "--python-exit-code",
      "1",
      "--python",
      path.join(assets, "inspect_saved.py"),
      "--",
      png,
      path.join(directory, "native-observation.json"),
    ],
    "roundtrip-native-readback",
    context.outputDirectory,
  );
  assert.equal(
    createHash("sha256").update(fs.readFileSync(png)).digest("hex"),
    pngHash,
  );
  assert.equal(
    createHash("sha256").update(fs.readFileSync(blend)).digest("hex"),
    blendHash,
  );
}
