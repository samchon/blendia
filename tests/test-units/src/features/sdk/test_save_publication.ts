import assert from "node:assert/strict";
import path from "node:path";

import type { IBlenderSaveOptions } from "../../../../../packages/sdk/src/IBlenderSaveOptions";
import type { IBlenderSavedFile } from "../../../../../packages/sdk/src/IBlenderSavedFile";
import type { IBlenderSession } from "../../../../../packages/sdk/src/IBlenderSession";
import { BlenderArtifactProtocol } from "../../../../../packages/sdk/src/internal/BlenderArtifactProtocol";

/**
 * Bind publication requests and metadata to an explicit destination and source lifetime.
 *
 * Scenarios:
 * 1. Absolute PNG/.blend destinations normalize explicitly and overwrite defaults only when omitted.
 * 2. PNG metadata may retain an earlier artifact generation; .blend metadata requires the current one.
 * 3. Wrong paths, foreign identities, invalid byte counts, and nonempty completion responses fail.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercise the save/saved/empty codecs consumed by exportArtifact/saveBlendCopy/releaseArtifact; observations establish request and readback ownership, not whether a filesystem publication or release actually occurred.
 * @evidence contracts/testing.md#independent-expectations Destinations are explicit absolute paths with the requested extension and a real boolean overwrite, returned bytes are positive safe integers, source session matches, and generation is current for .blend or no later than current for PNG; release completion contains no fields.
 * @evidence contracts/testing.md#distinguishing-cases Cover normalized Unicode paths, case-insensitive extensions, omitted/true/false overwrite, relative/missing/wrong extensions and NUL, current/past/future generations, foreign path/session, zero/fractional/unsafe bytes, and null/array/nonempty release values; no-clobber races and native IO remain engine-owned.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this named production codec case using path strings and literal metadata without touching the filesystem, testing package layout, creating fake artifacts, or replacing native publication.
 */
export function test_save_publication(): void {
  const png: string = path.resolve("publication", "한글 output.PNG");
  const blend: string = path.resolve("publication", "scene.BLEND");
  const destination: string = `${path.dirname(png)}${path.sep}nested${path.sep}..${path.sep}${path.basename(png)}`;
  assert.deepEqual(
    BlenderArtifactProtocol.save({ path: destination }, ".png"),
    { path: png, overwrite: false },
  );
  assert.deepEqual(
    BlenderArtifactProtocol.save({ path: blend, overwrite: true }, ".blend"),
    { path: blend, overwrite: true },
  );
  assert.equal(
    BlenderArtifactProtocol.save({ path: png, overwrite: false }, ".png")
      .overwrite,
    false,
  );
  const invalid: readonly unknown[] = [
    null,
    [],
    {},
    { path: "relative.png" },
    { path: path.resolve("image") },
    { path: blend },
    { path: png + ".tmp" },
    { path: png + "\0" },
    { path: png, overwrite: "false" },
    { path: png, overwrite: 0 },
    { path: png, overwrite: null },
  ];
  for (const value of invalid)
    assert.throws(
      (): IBlenderSaveOptions =>
        BlenderArtifactProtocol.save(value as IBlenderSaveOptions, ".png"),
      { code: "INVALID_ARGUMENT", effects: "none" },
    );

  const session: IBlenderSession = {
    protocolVersion: 1,
    sessionId: "bridge",
    generation: 3,
    blenderVersion: "5.2.0",
    capabilities: [],
  };
  const expected: IBlenderSaveOptions = { path: png, overwrite: false };
  const wire: IBlenderSavedFile = {
    path: png,
    bytes: 1,
    sourceSessionId: "bridge",
    generation: 2,
  };
  const saved: IBlenderSavedFile = BlenderArtifactProtocol.saved(
    wire,
    session,
    expected,
    false,
  );
  assert.deepEqual(saved, {
    path: png,
    bytes: 1,
    sourceSessionId: "bridge",
    generation: 2,
  });
  saved.bytes = 50;
  assert.equal(wire.bytes, 1);
  assert.equal(
    BlenderArtifactProtocol.saved(
      { ...wire, bytes: Number.MAX_SAFE_INTEGER },
      session,
      expected,
      false,
    ).bytes,
    Number.MAX_SAFE_INTEGER,
  );
  assert.equal(
    BlenderArtifactProtocol.saved(
      { ...wire, generation: 0 },
      session,
      expected,
      false,
    ).generation,
    0,
  );
  assert.equal(
    BlenderArtifactProtocol.saved(
      { ...wire, path: blend, generation: 3 },
      session,
      { path: blend },
      true,
    ).generation,
    3,
  );
  assert.throws(
    (): IBlenderSavedFile =>
      BlenderArtifactProtocol.saved(wire, session, expected, true),
    { code: "INVALID_RESPONSE" },
  );
  const invalidMetadata: readonly unknown[] = [
    null,
    { ...wire, path: "relative.png" },
    { ...wire, path: path.resolve("publication", "foreign.png") },
    { ...wire, sourceSessionId: "other" },
    { ...wire, generation: -1 },
    { ...wire, generation: 4 },
    { ...wire, generation: 2.5 },
    { ...wire, bytes: 0 },
    { ...wire, bytes: -1 },
    { ...wire, bytes: 1.5 },
    { ...wire, bytes: Number.MAX_SAFE_INTEGER + 1 },
    { ...wire, bytes: Infinity },
    { ...wire, bytes: "1" },
  ];
  for (const value of invalidMetadata)
    assert.throws(
      (): IBlenderSavedFile =>
        BlenderArtifactProtocol.saved(value, session, expected, false),
      { code: "INVALID_RESPONSE", effects: "none" },
    );

  assert.equal(BlenderArtifactProtocol.empty({}), undefined);
  for (const value of [null, [], { released: true }, { cancelled: true }])
    assert.throws((): void => BlenderArtifactProtocol.empty(value), {
      code: "INVALID_RESPONSE",
      effects: "none",
    });
}
