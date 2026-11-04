"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let fallbackDirectory;
let fallbackIdentity;

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function directoryIdentity(directory) {
  const identity = fs.lstatSync(directory, { bigint: true });
  if (!identity.isDirectory() || identity.isSymbolicLink())
    throw new Error("blendia: native scratch must be a physical directory.");
  return identity;
}

/** Match the environment key that Node will actually pass to a Windows child. */
function readChildEnvironment(environment, name) {
  if (process.platform !== "win32") return environment[name];

  // Node sorts and deduplicates keys before discarding undefined values.
  // An undefined first alias therefore suppresses later spellings too.
  const key = Object.keys(environment)
    .sort()
    .find((candidate) => candidate.toUpperCase() === name.toUpperCase());
  return key === undefined ? undefined : environment[key];
}

function setTemporaryDirectory(environment, directory) {
  if (process.platform === "win32")
    for (const key of Object.keys(environment))
      if (["TEMP", "TMP", "TMPDIR"].includes(key.toUpperCase()))
        delete environment[key];

  environment.TEMP = environment.TMP = environment.TMPDIR = directory;
}

/** Check the same physical parent/child boundary the compiler will enforce. */
function checkParent(candidate, retainedDirectories) {
  let allocation;
  try {
    const physicalParent = fs.realpathSync.native(path.resolve(candidate));
    directoryIdentity(physicalParent);
    allocation = fs.mkdtempSync(
      path.join(physicalParent, ".blendia-native-check-"),
    );
    const identity = directoryIdentity(allocation);
    const physicalChild = fs.realpathSync.native(allocation);
    const observed = directoryIdentity(physicalChild);
    if (
      path.dirname(physicalChild) !== physicalParent ||
      !sameIdentity(identity, observed)
    )
      throw new Error("blendia: native scratch escaped its physical parent.");

    // Remove only the still-identical empty directory created by this check.
    if (!sameIdentity(directoryIdentity(allocation), identity))
      throw new Error("blendia: native scratch identity changed.");
    fs.rmdirSync(allocation);
    allocation = undefined;
    return physicalParent;
  } catch {
    if (allocation !== undefined) retainedDirectories.push(allocation);
    return undefined;
  }
}

/**
 * Copy the caller's environment before the public native launcher starts.
 * Healthy temporary settings are preserved verbatim. An unsafe allocation is
 * retained, never adopted as a fallback or recursively removed. The random
 * fallback is process-owned and intentionally retained for unknown descendants.
 */
function prepareNativeEnvironment(environment = process.env) {
  const copied = { ...environment };
  const retainedDirectories = [];
  const inherited =
    process.platform === "win32"
      ? readChildEnvironment(copied, "TEMP") ||
        readChildEnvironment(copied, "TMP") ||
        (readChildEnvironment(copied, "SystemRoot") ||
          readChildEnvironment(copied, "windir")) + "\\temp"
      : copied.TMPDIR || copied.TMP || copied.TEMP || "/tmp";
  if (checkParent(inherited, retainedDirectories) !== undefined)
    return { environment: copied, retainedDirectories };

  if (fallbackDirectory !== undefined) {
    try {
      if (
        !sameIdentity(fallbackIdentity, directoryIdentity(fallbackDirectory)) ||
        checkParent(fallbackDirectory, retainedDirectories) !==
          fallbackDirectory
      )
        throw new Error("blendia: retained native scratch identity changed.");
      setTemporaryDirectory(copied, fallbackDirectory);
      return {
        environment: copied,
        directory: fallbackDirectory,
        retainedDirectories,
      };
    } catch {
      retainedDirectories.push(fallbackDirectory);
    }
  }

  let allocated;
  try {
    const parent = fs.realpathSync.native(os.homedir());
    const parentIdentity = directoryIdentity(parent);
    if (
      typeof process.getuid === "function" &&
      parentIdentity.uid !== BigInt(process.getuid())
    )
      throw new Error(
        "blendia: native scratch parent is not owned by this user.",
      );
    allocated = fs.mkdtempSync(path.join(parent, ".blendia-native-"));
    const identity = directoryIdentity(allocated);
    const physical = fs.realpathSync.native(allocated);
    if (
      path.dirname(physical) !== parent ||
      !sameIdentity(identity, directoryIdentity(physical)) ||
      (typeof process.getuid === "function" &&
        identity.uid !== BigInt(process.getuid())) ||
      !sameIdentity(parentIdentity, directoryIdentity(parent)) ||
      checkParent(physical, retainedDirectories) !== physical
    )
      throw new Error("blendia: automatic native scratch verification failed.");

    fallbackDirectory = physical;
    fallbackIdentity = identity;
    setTemporaryDirectory(copied, physical);
    return { environment: copied, directory: physical, retainedDirectories };
  } catch (error) {
    if (allocated !== undefined) retainedDirectories.push(allocated);
    const retained =
      retainedDirectories.length === 0
        ? ""
        : ` Retained allocations: ${retainedDirectories.join(", ")}.`;
    throw new Error(
      `blendia: unable to prepare safe native temporary storage.${retained}`,
      { cause: error },
    );
  }
}

module.exports = { prepareNativeEnvironment };
