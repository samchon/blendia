import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { prepareNativeEnvironment } from "../../../../../packages/runtime/native/prepareNativeEnvironment.cjs";
import { prepareProjectLaunch } from "../../../../../packages/runtime/src/internal/prepareProjectLaunch";

/**
 * Keep native temporary storage physically stable across real project working directories.
 *
 * Scenarios:
 * 1. Complete absolute settings for the same physical root retain their spelling and unrelated values.
 * 2. Missing, relative or conflicting secondary settings align to the selected healthy primary.
 * 3. Actual platform aliases retain Node's priority without changing the caller or process environment.
 * 4. Cwd-dependent primary settings use retained owned storage that two real project directories resolve identically.
 *
 * @evidence contracts/testing.md#behavioral-verification Call the production environment selector and project launch preparation against real owned directories; observe coherent preservation, secondary alignment and physical temporary-root stability across distinct child working directories, without spawning a child.
 * @evidence contracts/testing.md#independent-expectations Node and Go must receive the same physical temporary parent despite choosing different environment variables. Complete absolute settings remain verbatim; incomplete or conflicting settings align to the selected absolute primary, while a relative primary cannot depend on a future child's cwd or current drive.
 * @evidence contracts/testing.md#distinguishing-cases Cover the actual platform's key aliases and undefined suppression, missing/relative/different-root secondary settings, noncanonical absolute spelling, relative primary paths and Windows drive-dependent forms. Compare real filesystem identities from two owned project directories, preserve empty/undefined unrelated fields and verify caller/global nonmutation; MSIX redirection remains actual host acceptance.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this named production-policy unit. It creates only real owned directories, launches no compiler or child, changes no process cwd/environment, retains automatic fallback storage, and cleans only unchanged empty owned directories while preserving assertion and cleanup failures independently.
 */
export function test_native_environment(): void {
  const parent: string = fs.realpathSync.native(process.cwd());
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

  const owned: Map<string, fs.BigIntStats> = new Map([[directory, identity]]);
  const failures: unknown[] = [];
  try {
    const workingDirectories: string[] = [
      path.join(directory, "project-a"),
      path.join(directory, "project-b"),
    ];
    for (const cwd of workingDirectories) {
      fs.mkdirSync(cwd);
      owned.set(cwd, fs.lstatSync(cwd, { bigint: true }));
      assert.equal(fs.realpathSync.native(cwd), cwd);
    }

    const configured: string = directory + path.sep + ".";
    const unrelated: NodeJS.ProcessEnv = {
      BLENDIA_NATIVE_UNIT_VALUE: "caller-owned",
      BLENDIA_NATIVE_UNIT_EMPTY: "",
      BLENDIA_NATIVE_UNIT_UNDEFINED: undefined,
    };

    // Compare as a boolean so assertion output cannot dump inherited secrets.
    const inheritedBefore: string = JSON.stringify(process.env);
    const cwdBefore: string = process.cwd();
    const coherent: readonly NodeJS.ProcessEnv[] = [
      { TEMP: configured, TMP: configured, TMPDIR: configured },
      ...(process.platform === "win32"
        ? [
            { Temp: configured, Tmp: configured, TmpDir: configured },
            { temp: configured, tMp: configured, tmpdir: configured },
            {
              Temp: "ignored-alias",
              TEMP: configured,
              TMP: configured,
              TMPDIR: configured,
            },
          ]
        : [
            {
              TEMP: configured,
              TMP: configured,
              TMPDIR: configured,
              tmpdir: "unrelated-lowercase",
            },
          ]),
    ];
    for (const candidate of coherent) {
      const caller: NodeJS.ProcessEnv = Object.freeze({
        ...candidate,
        ...unrelated,
      });
      const selected: ReturnType<typeof prepareNativeEnvironment> =
        prepareNativeEnvironment(caller);
      assert.deepEqual(selected.environment, caller);
      assert.notEqual(selected.environment, caller);
      assert.equal(selected.directory, undefined);
      assert.deepEqual(selected.retainedDirectories, []);
      selected.environment.BLENDIA_NATIVE_UNIT_VALUE = "copy-only";
      assert.equal(caller.BLENDIA_NATIVE_UNIT_VALUE, "caller-owned");
    }

    const primary: NodeJS.ProcessEnv =
      process.platform === "win32"
        ? { TEMP: configured }
        : { TMPDIR: configured };
    const incomplete: readonly NodeJS.ProcessEnv[] = [
      primary,
      { TEMP: configured, TMP: "relative-secondary", TMPDIR: configured },
      { TEMP: configured, TMP: workingDirectories[0], TMPDIR: configured },
      ...(process.platform === "win32"
        ? [
            { Temp: configured, tMp: "relative-secondary" },
            { TEMP: undefined, Temp: "suppressed-alias", TMP: configured },
          ]
        : [
            { Temp: "unrelated-lowercase", TMPDIR: undefined, TMP: configured },
          ]),
    ];
    for (const candidate of incomplete) {
      const caller: NodeJS.ProcessEnv = Object.freeze({
        ...candidate,
        ...unrelated,
      });
      const selected: ReturnType<typeof prepareNativeEnvironment> =
        prepareNativeEnvironment(caller);
      const expected: NodeJS.ProcessEnv = {
        ...(process.platform === "win32" ? unrelated : caller),
        TEMP: configured,
        TMP: configured,
        TMPDIR: configured,
      };
      assert.deepEqual(selected.environment, expected);
      assert.equal(selected.directory, undefined);
      assert.deepEqual(selected.retainedDirectories, []);
      assert.deepEqual(caller, { ...candidate, ...unrelated });
      for (const cwd of workingDirectories) {
        const launch: ReturnType<typeof prepareProjectLaunch> =
          prepareProjectLaunch({ cwd, entry: "entry.ts" }, caller);
        for (const key of ["TEMP", "TMP", "TMPDIR"]) {
          assert.equal(launch.env[key], configured);
          assert.equal(
            fs.realpathSync.native(path.resolve(cwd, launch.env[key]!)),
            directory,
          );
        }
      }
    }

    // This relative path is valid here, so resolving it in the parent would hide the defect.
    const relative: string = path.relative(process.cwd(), directory);
    assert.equal(fs.realpathSync.native(relative), directory);
    const dependent: string[] = [relative];
    if (process.platform === "win32") {
      const drive: string = path.parse(directory).root;
      if (/^[A-Za-z]:\\$/.test(drive))
        dependent.push(drive.slice(0, 2) + relative, directory.slice(2));
    }
    for (const candidate of dependent) {
      const caller: NodeJS.ProcessEnv = Object.freeze({
        TEMP: candidate,
        TMP: candidate,
        TMPDIR: candidate,
        ...unrelated,
      });
      const selected: ReturnType<typeof prepareNativeEnvironment> =
        prepareNativeEnvironment(caller);
      assert.equal(typeof selected.directory, "string");
      const physical: string = fs.realpathSync.native(selected.directory!);
      const observed: fs.BigIntStats = fs.lstatSync(physical, { bigint: true });
      assert.equal(observed.isDirectory(), true);
      assert.equal(observed.isSymbolicLink(), false);
      assert.notEqual(physical, directory);
      assert.deepEqual(selected.retainedDirectories, []);
      for (const cwd of workingDirectories) {
        const launch: ReturnType<typeof prepareProjectLaunch> =
          prepareProjectLaunch({ cwd, entry: "entry.ts" }, caller);
        for (const key of ["TEMP", "TMP", "TMPDIR"])
          assert.equal(
            fs.realpathSync.native(path.resolve(cwd, launch.env[key]!)),
            physical,
          );
      }
      assert.deepEqual(caller, {
        TEMP: candidate,
        TMP: candidate,
        TMPDIR: candidate,
        ...unrelated,
      });
    }
    assert.equal(JSON.stringify(process.env) === inheritedBefore, true);
    assert.equal(process.cwd(), cwdBefore);
    assert.deepEqual(fs.readdirSync(directory).sort(), [
      "project-a",
      "project-b",
    ]);
  } catch (error) {
    failures.push(error);
  }

  for (const [target, expected] of [...owned].reverse()) {
    try {
      const observed: fs.BigIntStats = fs.lstatSync(target, { bigint: true });
      if (
        !observed.isDirectory() ||
        observed.isSymbolicLink() ||
        observed.dev !== expected.dev ||
        observed.ino !== expected.ino ||
        fs.realpathSync.native(target) !== target
      )
        throw new Error(
          "Native environment unit directory identity changed; retained.",
        );

      // Unknown children make rmdir refuse; never recursively remove shared fallback storage.
      fs.rmdirSync(target);
    } catch (error) {
      failures.push(error);
    }
  }

  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(
      failures,
      "Native environment unit and cleanup failed.",
    );
}
