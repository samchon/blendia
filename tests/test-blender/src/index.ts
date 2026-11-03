import { DynamicExecutor } from "@nestia/e2e";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { IBlenderTestContext } from "./IBlenderTestContext";
import { BlenderAdmissionStoppedError } from "./internal/BlenderAdmissionStoppedError";
import { prepareInstalledExtension } from "./internal/prepareInstalledExtension";

/** Run real-engine scenarios with explicit prerequisites and preserved output provenance. */
async function main(): Promise<void> {
  const executable: string | undefined = process.env.BLENDIA_BLENDER_EXECUTABLE;
  const extension: string | undefined =
    process.env.BLENDIA_EXTENSION_SOURCE_DIRECTORY;
  assert.ok(
    executable,
    "Set BLENDIA_BLENDER_EXECUTABLE to an actual Blender executable.",
  );
  assert.ok(
    extension,
    "Set BLENDIA_EXTENSION_SOURCE_DIRECTORY to the actual extension packaging source.",
  );

  const parent: string = path.resolve(
    process.env.BLENDIA_TEST_OUTPUT_DIRECTORY ?? os.tmpdir(),
  );
  assert.ok(
    fs.statSync(parent).isDirectory(),
    "The output parent must already exist.",
  );
  const outputDirectory: string = fs.mkdtempSync(
    path.join(parent, "blendia-engine-"),
  );
  const temporaryDirectory: string = path.join(
    outputDirectory,
    "private-runtime",
  );
  fs.mkdirSync(temporaryDirectory, { mode: 0o700 });
  const blenderConfiguration: string = path.join(
    temporaryDirectory,
    "blender-config",
  );
  fs.mkdirSync(blenderConfiguration, { mode: 0o700 });
  console.log(`Actual Blender outputs: ${outputDirectory}`);

  // Scope native temporary storage to this runner's environment, never the user's global settings.
  const previous: NodeJS.ProcessEnv = {
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    TMPDIR: process.env.TMPDIR,
    BLENDER_USER_CONFIG: process.env.BLENDER_USER_CONFIG,
    BLENDER_USER_EXTENSIONS: process.env.BLENDER_USER_EXTENSIONS,
  };
  process.env.TEMP = temporaryDirectory;
  process.env.TMP = temporaryDirectory;
  process.env.TMPDIR = temporaryDirectory;
  process.env.BLENDER_USER_CONFIG = blenderConfiguration;
  try {
    const projectDirectory: string = path.resolve(__dirname, "..");
    const installed: string = await prepareInstalledExtension(
      path.resolve(executable),
      path.resolve(extension),
      projectDirectory,
      outputDirectory,
      temporaryDirectory,
    );
    const context: IBlenderTestContext = {
      blenderExecutable: path.resolve(executable),
      extensionDirectory: installed,
      projectDirectory,
      outputDirectory,
      temporaryDirectory,
    };
    const report: DynamicExecutor.IReport = await DynamicExecutor.validate({
      prefix: "test_",
      extension: "ts",
      simultaneous: 1,
      location: path.join(__dirname, "features"),
      parameters: (name: string): [IBlenderTestContext] => {
        const privateDirectory: string = path.join(temporaryDirectory, name);
        const configuration: string = path.join(
          privateDirectory,
          "blender-config",
        );
        fs.mkdirSync(configuration, { recursive: true, mode: 0o700 });

        // Preserve an unknown case's files without making another case's cleanup observation ambiguous.
        process.env.TEMP = privateDirectory;
        process.env.TMP = privateDirectory;
        process.env.TMPDIR = privateDirectory;
        process.env.BLENDER_USER_CONFIG = configuration;
        return [{ ...context, temporaryDirectory: privateDirectory }];
      },
      onComplete: (execution: DynamicExecutor.IExecution): void => {
        const status: string =
          execution.error === null
            ? "PASS"
            : execution.error instanceof BlenderAdmissionStoppedError
              ? "BLOCKED"
              : "FAIL";
        console.log(`${status} ${execution.name}`);
        if (execution.error !== null) console.error(execution.error);
      },
    });
    assert.notEqual(
      report.executions.length,
      0,
      "No actual-engine scenarios were discovered.",
    );
    if (
      report.executions.some(
        (execution: DynamicExecutor.IExecution): boolean =>
          execution.error !== null,
      )
    )
      process.exitCode = 1;
  } finally {
    for (const name of [
      "TEMP",
      "TMP",
      "TMPDIR",
      "BLENDER_USER_CONFIG",
      "BLENDER_USER_EXTENSIONS",
    ]) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}

main().catch((error: unknown): void => {
  console.error(error);
  process.exitCode = 1;
});
