import assert from "node:assert/strict";

import type { BlenderRenderJob } from "../../../../packages/sdk/src/BlenderRenderJob";
import type { IBlenderArtifact } from "../../../../packages/sdk/src/IBlenderArtifact";
import type { IBlenderArtifactChunk } from "../../../../packages/sdk/src/IBlenderArtifactChunk";
import type { IBlenderArtifactReadOptions } from "../../../../packages/sdk/src/IBlenderArtifactReadOptions";
import type { IBlenderRenderHandle } from "../../../../packages/sdk/src/IBlenderRenderHandle";
import type { IBlenderRenderJobBase } from "../../../../packages/sdk/src/IBlenderRenderJobBase";
import type { IBlenderRenderOptions } from "../../../../packages/sdk/src/IBlenderRenderOptions";
import type { IBlenderSession } from "../../../../packages/sdk/src/IBlenderSession";
import { BlenderArtifactProtocol } from "../../../../packages/sdk/src/internal/BlenderArtifactProtocol";
import { BlenderRenderProtocol } from "../../../../packages/sdk/src/internal/BlenderRenderProtocol";

/**
 * Refuse foreign or inconsistent native-render observations and bounded artifact byte windows.
 *
 * Scenarios:
 * 1. Caller-owned render IDs and dimensions stay canonical before start transmission.
 * 2. Pending and terminal variants preserve start provenance across later generations.
 * 3. Canonical byte chunks correlate identity, requested offset, progress, EOF, and decoded length.
 * 4. Exact chunk and artifact bounds succeed; foreign, oversized, noncanonical, and stalled responses fail.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercise actual BlenderClient render and artifact codecs directly, observing admitted identities, discriminated outcomes, immutable provenance, validated byte windows, and malformed-response errors without a native render or socket substitute.
 * @evidence contracts/testing.md#independent-expectations Literal UUIDs, timestamps, one/two/three-byte canonical base64 fixtures, and documented 4096-pixel, 196608-byte chunk and 32-MiB artifact limits determine expectations independently of response parsing.
 * @evidence contracts/testing.md#distinguishing-cases Cover default and boundary dimensions, foreign sessions and request IDs, pending/terminal contradictions, generation and PNG provenance, nonzero offset, empty exact EOF, no progress, byte overflow and noncanonical base64; actual PNG rendering, retention and filesystem publication remain manual.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this named case against real internal render/artifact validators consumed by the client; no native process, file fixture, framework simulation, or upstream codec test is introduced.
 */
export function test_render_artifacts(): void {
  const renderId: string = "12345678-1234-4234-8234-123456789abc";
  const otherId: string = "87654321-4321-4321-8321-cba987654321";
  const session: IBlenderSession = {
    protocolVersion: 1,
    sessionId: "bridge",
    generation: 3,
    blenderVersion: "5.2.0",
    capabilities: [],
  };
  const handle: IBlenderRenderHandle = { sessionId: "bridge", renderId };
  assert.deepEqual(BlenderRenderProtocol.options({ renderId }), {
    renderId,
    width: 512,
    height: 512,
  });
  assert.deepEqual(
    BlenderRenderProtocol.options({ renderId, width: 1, height: 4096 }),
    { renderId, width: 1, height: 4096 },
  );
  for (const input of [
    { renderId: renderId.toUpperCase() },
    { renderId: "missing" },
    { renderId, width: 0 },
    { renderId, height: 4097 },
    { renderId, width: 1.5 },
    { renderId, height: NaN },
  ])
    assert.throws(
      (): IBlenderRenderOptions => BlenderRenderProtocol.options(input),
      { code: "INVALID_ARGUMENT" },
    );
  assert.deepEqual(BlenderRenderProtocol.handle(handle, session), handle);
  assert.throws(
    (): IBlenderRenderHandle =>
      BlenderRenderProtocol.handle({ ...handle, sessionId: "other" }, session),
    { code: "STALE_HANDLE" },
  );

  const base: IBlenderRenderJobBase = {
    handle,
    startGeneration: 2,
    sceneId: "9",
    sceneName: "Scene",
    cameraObjectId: "7",
    engine: "BLENDER_EEVEE",
    frame: 1,
    width: 64,
    height: 32,
    startedAt: "2026-11-04T00:00:00.000Z",
  };
  const artifact: IBlenderArtifact = {
    handle: { sessionId: "bridge", artifactId: "owned-png" },
    renderId,
    startGeneration: 2,
    mimeType: "image/png",
    bytes: 4,
    width: 64,
    height: 32,
    expiresAt: "2026-11-04T00:10:00.000Z",
  };
  assert.deepEqual(BlenderRenderProtocol.artifact(artifact, session), artifact);
  assert.equal(
    BlenderRenderProtocol.artifact({ ...artifact, bytes: 33554432 }, session)
      .bytes,
    33554432,
  );
  for (const status of ["running", "finalizing"])
    assert.equal(
      BlenderRenderProtocol.job({ ...base, status }, session, handle).status,
      status,
    );
  const succeeded: BlenderRenderJob = BlenderRenderProtocol.job(
    {
      ...base,
      status: "succeeded",
      finishedAt: "2026-11-04T00:00:01.000Z",
      artifact,
    },
    session,
    handle,
  );
  assert.ok(succeeded.status === "succeeded");
  assert.equal(succeeded.startGeneration, 2);
  assert.deepEqual(succeeded.artifact, artifact);
  succeeded.artifact.handle.artifactId = "caller mutation";
  assert.equal(artifact.handle.artifactId, "owned-png");
  for (const status of ["cancelled", "failed", "unknown"])
    assert.equal(
      BlenderRenderProtocol.job(
        {
          ...base,
          status,
          finishedAt: "2026-11-04T00:00:01.000Z",
          error: {
            code: "NATIVE_FAILURE",
            message: "No owned output.",
            effects: "possible",
          },
        },
        session,
        handle,
      ).status,
      status,
    );
  const invalidJobs: readonly unknown[] = [
    { ...base, status: "running", artifact },
    { ...base, status: "finalizing", finishedAt: "2026-11-04T00:00:01.000Z" },
    { ...base, status: "running", handle: { ...handle, renderId: otherId } },
    { ...base, status: "running", startGeneration: 4 },
    {
      ...base,
      status: "succeeded",
      finishedAt: "2026-11-03T23:59:59.000Z",
      artifact,
    },
    {
      ...base,
      status: "succeeded",
      finishedAt: "2026-11-04T00:00:01.000Z",
      artifact: { ...artifact, renderId: otherId },
    },
    {
      ...base,
      status: "succeeded",
      finishedAt: "2026-11-04T00:00:01.000Z",
      artifact: { ...artifact, width: 65 },
    },
    {
      ...base,
      status: "succeeded",
      finishedAt: "2026-11-04T00:00:01.000Z",
      artifact: { ...artifact, startGeneration: 1 },
    },
    {
      ...base,
      status: "failed",
      finishedAt: "2026-11-04T00:00:01.000Z",
      artifact,
      error: { code: "FAILED", message: "Failure", effects: "none" },
    },
    {
      ...base,
      status: "unknown",
      finishedAt: "2026-11-04T00:00:01.000Z",
      error: { code: "UNKNOWN", message: "Uncertain", effects: "certain" },
    },
  ];
  for (const response of invalidJobs)
    assert.throws(
      (): BlenderRenderJob =>
        BlenderRenderProtocol.job(response, session, handle),
      { code: "INVALID_RESPONSE" },
    );
  for (const response of [
    { ...artifact, mimeType: "image/jpeg" },
    { ...artifact, bytes: 0 },
    { ...artifact, bytes: 33554433 },
    { ...artifact, startGeneration: 4 },
    { ...artifact, expiresAt: "not-a-date" },
  ])
    assert.throws(
      (): IBlenderArtifact => BlenderRenderProtocol.artifact(response, session),
      { code: "INVALID_RESPONSE" },
    );

  const request: IBlenderArtifactReadOptions = {
    artifact: artifact.handle,
    offset: 0,
    maxBytes: 3,
  };
  assert.equal(
    BlenderArtifactProtocol.read(
      { artifact: artifact.handle, offset: 0 },
      session,
    ).maxBytes,
    196608,
  );
  assert.deepEqual(
    BlenderArtifactProtocol.read(
      { artifact: artifact.handle, offset: 33554432, maxBytes: 1 },
      session,
    ),
    { artifact: artifact.handle, offset: 33554432, maxBytes: 1 },
  );
  const invalidReads: readonly IBlenderArtifactReadOptions[] = [
    { ...request, offset: -1 },
    { ...request, offset: 33554433 },
    { ...request, offset: 0.5 },
    { ...request, maxBytes: 0 },
    { ...request, maxBytes: 196609 },
    { ...request, maxBytes: Infinity },
  ];
  for (const input of invalidReads)
    assert.throws(
      (): IBlenderArtifactReadOptions =>
        BlenderArtifactProtocol.read(input, session),
      { code: "INVALID_ARGUMENT" },
    );
  assert.throws(
    (): IBlenderArtifactReadOptions =>
      BlenderArtifactProtocol.read(
        { ...request, artifact: { ...artifact.handle, sessionId: "other" } },
        session,
      ),
    { code: "STALE_HANDLE" },
  );
  const chunk: IBlenderArtifactChunk = {
    artifactId: "owned-png",
    offset: 0,
    nextOffset: 3,
    totalBytes: 4,
    dataBase64: "AQID",
    eof: false,
  };
  assert.deepEqual(BlenderArtifactProtocol.chunk(chunk, request), chunk);
  const pair: IBlenderArtifactChunk = {
    ...chunk,
    nextOffset: 2,
    dataBase64: "AQI=",
  };
  assert.deepEqual(BlenderArtifactProtocol.chunk(pair, request), pair);
  const last: IBlenderArtifactChunk = {
    artifactId: "owned-png",
    offset: 3,
    nextOffset: 4,
    totalBytes: 4,
    dataBase64: "BA==",
    eof: true,
  };
  assert.deepEqual(
    BlenderArtifactProtocol.chunk(last, { ...request, offset: 3 }),
    last,
  );
  const eof: IBlenderArtifactChunk = {
    artifactId: "owned-png",
    offset: 4,
    nextOffset: 4,
    totalBytes: 4,
    dataBase64: "",
    eof: true,
  };
  assert.deepEqual(
    BlenderArtifactProtocol.chunk(eof, { ...request, offset: 4 }),
    eof,
  );
  const invalidChunks: readonly unknown[] = [
    { ...chunk, artifactId: "foreign" },
    { ...chunk, offset: 1 },
    { ...chunk, nextOffset: 2 },
    { ...chunk, totalBytes: 0 },
    { ...chunk, totalBytes: 33554433 },
    { ...chunk, eof: true },
    { ...chunk, nextOffset: 0, dataBase64: "" },
    { ...chunk, nextOffset: 5 },
    { ...chunk, dataBase64: "AQID\n" },
    { ...chunk, dataBase64: "AR==", nextOffset: 1 },
    { ...chunk, dataBase64: "-_8=", nextOffset: 2 },
    { ...chunk, dataBase64: "AQ==", nextOffset: 3 },
  ];
  for (const response of invalidChunks)
    assert.throws(
      (): IBlenderArtifactChunk =>
        BlenderArtifactProtocol.chunk(response, request),
      { code: "INVALID_RESPONSE" },
    );
  assert.throws(
    (): IBlenderArtifactChunk =>
      BlenderArtifactProtocol.chunk(chunk, { ...request, maxBytes: 2 }),
    { code: "INVALID_RESPONSE" },
  );
  const maximum: IBlenderArtifactChunk = {
    artifactId: "owned-png",
    offset: 0,
    nextOffset: 196608,
    totalBytes: 33554432,
    dataBase64: Buffer.alloc(196608).toString("base64"),
    eof: false,
  };
  assert.deepEqual(
    BlenderArtifactProtocol.chunk(maximum, {
      artifact: artifact.handle,
      offset: 0,
    }),
    maximum,
  );
}
