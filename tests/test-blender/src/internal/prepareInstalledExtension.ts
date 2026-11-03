import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { IInstalledExtensionObservation } from "../IInstalledExtensionObservation";
import { runNativeBlender } from "./runNativeBlender";

/**
 * Build and install the actual extension once, then return only its verified installed package directory.
 *
 * @evidence contracts/installation.md#official-installation Public native extension build, repo-add USER without a remote URL, and install-file --enable run as actual Blender commands. A new Blender process verifies enabled addon RNA registration and real disable/enable lifecycle before any scene scenario is admitted.
 * @evidence contracts/installation.md#installed-payload-identity The native verifier resolves bl_ext repository/package __file__, compares every ZIP payload member with installed bytes, matches installed LICENSE to the maintained root, and reports the actual installed directory. Every scenario receives only that directory, with no source import fallback or copied core.
 * @evidence contracts/installation.md#isolated-preparation-lifetime The caller reserves process-only TEMP and BLENDER_USER_CONFIG; this preparation reserves a local repository and BLENDER_USER_EXTENSIONS beneath that private root. Each actual command has a ten-minute preparation/readback observation budget with sanitized PID/stage/status journals. Uncertain native observation closes admission and unrefs only the direct child handle without killing or replaying work; the caller restores its environment in finally and preserves files and global preferences.
 */
export async function prepareInstalledExtension(
  blenderExecutable: string,
  sourceDirectory: string,
  projectDirectory: string,
  outputDirectory: string,
  temporaryDirectory: string,
): Promise<string> {
  const packaging: string = path.join(outputDirectory, "extension-package");
  const installation: string = path.join(
    temporaryDirectory,
    "extension-install",
  );
  const repository: string = path.join(installation, "repository");
  const extensions: string = path.join(installation, "extensions");
  fs.mkdirSync(packaging);
  fs.mkdirSync(repository, { recursive: true, mode: 0o700 });
  fs.mkdirSync(extensions, { mode: 0o700 });
  process.env.BLENDER_USER_EXTENSIONS = extensions;
  const archive: string = path.join(packaging, "blendia-extension.zip");
  const observation: string = path.join(packaging, "installed-extension.json");
  const repositoryId: string = "blendia_engine_tests";
  await runNativeBlender(
    blenderExecutable,
    [
      "--background",
      "--factory-startup",
      "--command",
      "extension",
      "build",
      "--source-dir",
      sourceDirectory,
      "--output-filepath",
      archive,
    ],
    "extension-build",
    outputDirectory,
  );

  // Repository creation resets factory preferences; installation and verification load that isolated saved configuration.
  await runNativeBlender(
    blenderExecutable,
    [
      "--background",
      "--factory-startup",
      "--command",
      "extension",
      "repo-add",
      repositoryId,
      "--directory",
      repository,
      "--source",
      "USER",
    ],
    "extension-repository",
    outputDirectory,
  );
  await runNativeBlender(
    blenderExecutable,
    [
      "--background",
      "--command",
      "extension",
      "install-file",
      archive,
      "--repo",
      repositoryId,
      "--enable",
    ],
    "extension-install",
    outputDirectory,
  );
  await runNativeBlender(
    blenderExecutable,
    [
      "--background",
      "--disable-autoexec",
      "--python-exit-code",
      "1",
      "--python",
      path.join(projectDirectory, "assets", "verify_installed.py"),
      "--",
      archive,
      repositoryId,
      repository,
      path.resolve(projectDirectory, "../../LICENSE"),
      observation,
    ],
    "extension-registration",
    outputDirectory,
  );
  const result: IInstalledExtensionObservation = JSON.parse(
    fs.readFileSync(observation, "utf8"),
  ) as IInstalledExtensionObservation;
  assert.equal(result.registrationVerified, true);
  assert.ok(result.payloadFiles > 0);
  assert.equal(
    result.archiveSha256,
    createHash("sha256").update(fs.readFileSync(archive)).digest("hex"),
  );
  assert.equal(
    path.dirname(path.resolve(result.moduleFile)),
    path.resolve(result.extensionDirectory),
  );
  const relative: string = path.relative(
    fs.realpathSync(repository),
    fs.realpathSync(result.extensionDirectory),
  );
  assert.ok(
    relative.length > 0 &&
      !relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative),
  );
  assert.notEqual(
    fs.realpathSync(result.extensionDirectory),
    fs.realpathSync(sourceDirectory),
  );
  console.log(`Installed extension core: ${result.extensionDirectory}`);
  return fs.realpathSync(result.extensionDirectory);
}
