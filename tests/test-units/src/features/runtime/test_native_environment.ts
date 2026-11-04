import { prepareNativeEnvironment } from "@blendia/runtime/native-environment";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Preserve a caller's healthy native temporary environment without mutating process state or retaining check allocations.
 *
 * Scenarios:
 * 1. The platform's selected temporary setting admits a real, uniquely owned physical directory.
 * 2. Unselected nonexistent settings and unrelated empty or undefined values remain verbatim in a fresh copy.
 * 3. The caller and inherited process environment stay unchanged, and the temporary ownership check leaves no children.
 *
 * @evidence contracts/testing.md#behavioral-verification Call the production selector consumed by the Node preload and project launcher against a unique real directory; observe selected-parent admission, verbatim copied settings, absence of process mutation and release of the selector's check allocation.
 * @evidence contracts/testing.md#independent-expectations Windows TEMP and other platforms' TMPDIR select the explicit healthy parent; the contract preserves all caller values rather than replacing them with canonical paths, and a successful ownership check must remove only its own empty child.
 * @evidence contracts/testing.md#distinguishing-cases Give the selected setting a valid noncanonical spelling while lower-priority settings do not exist, retain empty and undefined values, and mutate the returned copy independently; actual MSIX redirection, automatic fallback and uncertain retained allocations remain real host acceptance rather than simulated filesystem behavior.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this named first-party filesystem selection unit; it launches no compiler or child, changes no process environment, creates no fake backend, and cleans only its own verified empty directory without touching shared fallback roots.
 */
export function test_native_environment(): void {
  const parent: string = fs.realpathSync.native(os.homedir());
  const allocated: string = fs.mkdtempSync(
    path.join(parent, ".blendia-unit-native-"),
  );
  const identity: fs.BigIntStats = fs.lstatSync(allocated, { bigint: true });
  const directory: string = fs.realpathSync.native(allocated);
  if (
    !identity.isDirectory() ||
    identity.isSymbolicLink() ||
    path.dirname(directory) !== parent
  )
    throw new Error(
      "Native environment unit directory ownership is uncertain; retained.",
    );

  try {
    const configured: string = directory + path.sep + ".";
    const environment: NodeJS.ProcessEnv = Object.freeze({
      TEMP:
        process.platform === "win32"
          ? configured
          : path.join(directory, "unselected-temp"),
      TMP: path.join(directory, "unselected-tmp"),
      TMPDIR:
        process.platform === "win32"
          ? path.join(directory, "unselected-tmpdir")
          : configured,
      BLENDIA_NATIVE_UNIT_VALUE: "caller-owned",
      BLENDIA_NATIVE_UNIT_EMPTY: "",
      BLENDIA_NATIVE_UNIT_UNDEFINED: undefined,
    });

    // Compare the observation as a boolean so failure output cannot dump inherited secrets.
    const inheritedBefore: string = JSON.stringify(process.env);
    const prepared: ReturnType<typeof prepareNativeEnvironment> =
      prepareNativeEnvironment(environment);
    assert.deepEqual(prepared.environment, environment);
    assert.notEqual(prepared.environment, environment);
    assert.equal(prepared.directory, undefined);
    assert.deepEqual(prepared.retainedDirectories, []);
    assert.deepEqual(fs.readdirSync(directory), []);
    assert.equal(JSON.stringify(process.env) === inheritedBefore, true);
    prepared.environment.BLENDIA_NATIVE_UNIT_VALUE = "copy-only";
    assert.equal(environment.BLENDIA_NATIVE_UNIT_VALUE, "caller-owned");
    assert.equal(JSON.stringify(process.env) === inheritedBefore, true);
  } finally {
    const observed: fs.BigIntStats = fs.lstatSync(directory, { bigint: true });
    if (
      !observed.isDirectory() ||
      observed.isSymbolicLink() ||
      observed.dev !== identity.dev ||
      observed.ino !== identity.ino ||
      fs.realpathSync.native(allocated) !== directory
    )
      throw new Error(
        "Native environment unit directory identity changed; retained.",
      );

    // An unexpected remaining child makes rmdir refuse; no recursive cleanup can erase it.
    fs.rmdirSync(directory);
  }
}
