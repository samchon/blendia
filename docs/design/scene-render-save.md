# Author a scene, render a PNG, and save a Blender copy

Tracking: [SDK #2](https://github.com/samchon/blendia/issues/2), [lifecycle #3](https://github.com/samchon/blendia/issues/3), [validation #6](https://github.com/samchon/blendia/issues/6), and [PR #14](https://github.com/samchon/blendia/pull/14). This guide describes the scene-to-output source API and its ownership limits. Real Blender acceptance and delivered artifacts belong in the tracking records; this guide does not certify a successful run. [Owned headless execution](headless-projects.md) reuses these methods with a separate blocking lifetime; the [MCP guide](mcp-agent-tools.md) describes agent tools and bounded native image delivery over the same SDK.

## Connect and prepare

Enable the [Blender extension](../../blender/extension/README.md), start its bridge, and run a project script through the [source CLI](../../packages/cli/README.md). The project's native TypeScript compiler, SDK, imports, and configured plugins must be available; [first-run preparation](script-jobs.md#first-run-preparation) explains native plugin/cache limits. No package build is required for local execution. The [SDK guide](../../packages/sdk/README.md) owns connection setup and its scene-to-output code example.

Await calls sequentially on one client; only one request may be pending. `blender.session` identifies the authenticated session, data generation, and advertised capabilities. The SDK refuses unsupported new methods before sending them, while retaining connection compatibility with older bridges. Scene edits run on Blender's main thread and require the existing Object Mode/Global Undo context. A request must still fit within the 1 MiB wire limit even when its individual input-count limits are satisfied.

Object and material handles belong to the current session/generation; loading, undo, or redo can invalidate them. Native render and artifact handles instead contain session identity and their own ID, so explicit reconnect to the same bridge can recover retained native work. Requests still carry the current data generation. There is no automatic reconnect, mutation replay, or transaction rollback.

## Typical workflow

1. Call `inspectScene()` to observe the current scene, frame, camera, and object page.
2. Create a mesh with `createMesh`, then create a Principled material with `createMaterial` and apply it with `assignMaterial`.
3. Create a camera using `setActive: true`, and add an area light. Choose the render engine and frame in Blender; this API does not switch them temporarily.
4. Generate and retain a canonical UUID before calling `startRender`. Await the returned job and poll `getRender(job.handle)` sequentially until it leaves `running`/`finalizing`.
5. Only `succeeded` certifies an owned PNG artifact. Save it with `saveArtifact`, or consume bounded `readArtifact` chunks before release/expiry.
6. After rendering and temporary-path restoration settle, call `saveBlendCopy` with an explicit destination. Use a distinct path unless replacement is intentional.
7. Release the private artifact when no longer needed and disconnect. Reopening the saved copy is a separate Blender action; acquire fresh scene handles afterward.

## Scene surface

| Method | Inputs and result |
| --- | --- |
| `inspectScene(query = {})` | `limit` defaults to 50, at most 100; pass the returned opaque `nextCursor` as `cursor` for another page. Results include session/generation, scene ID/name, frame, active camera, total object count, and object snapshots. |
| `createMesh(options)` | Optional `name`, bulk `vertices`, and indexed `faces`; returns the object snapshot plus `vertexCount`, `edgeCount`, and `polygonCount`. |
| `createMaterial(options)` | Required `baseColorLinearRGB`, optional `name`, `roughness`, and `metallic`; returns a material handle, actual name, and parameter readback. |
| `assignMaterial(options)` | `object` and `material` handles; replaces the whole mesh's material assignment with one DATA slot. |
| `createCamera(options)` | World `location`/`target`, optional `name`, `lensMm`, `clipStart`, `clipEnd`, and `setActive`; returns an object/camera snapshot. |
| `createAreaLight(options)` | World `location`/`target`, optional `name`, `colorLinearRGB`, `powerWatts`, and `size`; returns an object/light snapshot. |

Scene pages use current UID order and an opaque cursor tied to session, generation, and scene. Each page is fresh, so concurrent scene changes can affect later pages; this is not a cross-page snapshot. Bounded returned pages do not establish a hard traversal latency.

Mesh creation accepts empty and points-only meshes. Bounds are 8192 vertices, 8192 faces, and 32768 total face corners. Coordinates must be finite and within absolute `1e20`; each face needs at least three distinct in-range integer indices. Validation precedes linking, and topology that Blender would correct is refused rather than silently repaired. No manifoldness guarantee is made. Failure cleanup touches owned intermediate data only; effects can remain possible once mutation begins.

Materials are opaque Principled/output-node materials: scene-linear RGB components are in `0..1`, alpha is fixed to one, roughness defaults to `0.5`, and metallic defaults to `0`, both in `0..1`. Assignment requires local single-user editable mesh data, rejects linked/shared data, and is bounded by 8192 polygons/32768 loops. It applies the one material to every face without silently copying data or modifying sibling objects.

Cameras and lights are unparented and aim from world location toward a distinct world target with local -Z tracking, +Y up, and XYZ Euler rotation. Coordinates are finite within absolute `1e20`. Camera lens defaults to 50 mm within `1..500`; clipping defaults to `0.1`/`1000`, with `1e-6 <= clipStart < clipEnd <= 1e12`. `setActive` defaults false; true permanently changes the scene camera. Area lights default to scene-linear white, 1000 W, and size 5; power is within `0..1e12`, and size within `1e-6..1e6` Blender units.

## Native GUI render and recovery

`startRender` requires a caller-known canonical `renderId` UUID and optional width/height, defaulting to 512 each. The SDK's universal outer bound is `1..4096` per dimension, at most 16777216 pixels; the producer also checks the current Blender RNA bounds before its first setter. A native context can reject dimensions such as `1..3`; invalid dimensions are refused rather than silently clamped. The GUI path renders the current active camera, frame, and engine asynchronously in a Blender window; [owned headless execution](headless-projects.md#main-thread-and-finite-conditions) instead blocks until native completion. Multiview and cropped render borders are refused so the owned PNG retains the requested job dimensions.

Requested resolution, percentage 100, and PNG 8-bit RGBA settings persist in the scene, so a later saved copy carries them. The API does not temporarily swap the camera or engine. Only `render.filepath` is temporary: restoration occurs only while it still identifies the owned stage and the data lifetime permits restoration. A different user-selected output path is preserved rather than overwritten.

`getRender` accepts a session/render handle. [BlenderRenderJob](../../packages/sdk/src/BlenderRenderJob.ts) contains immutable `startGeneration`, scene ID/name, camera object ID, engine/frame/dimensions, and UTC `startedAt`. `running` and `finalizing` are pending; `succeeded` adds `finishedAt` and an artifact. `cancelled`, `failed`, and `unknown` add `finishedAt` and `error` with code, message, and effects. Native completion handlers alone do not prove the job has ended: finalization verifies native/scene/render-init ownership and the owned PNG before certifying success.

Retain the UUID before sending. If the start reply is lost with `OUTCOME_UNKNOWN`, reconnect explicitly to the same bridge and inspect that handle instead of resending the mutation. Duplicate accepted IDs are refused; this is not replay/idempotency. Each session retains at most 4096 accepted-ID tombstones; another admission fails with `LIMIT_EXCEEDED` before effects and requires a new bridge session. Terminal metadata has a separate cap of eight records/600 seconds, so an older handle can become `NOT_FOUND` even though its ID cannot be reused. Active jobs are not TTL-evicted.

One native render is active at a time. During rendering only render inspection, owned artifact reads/releases, and disconnect are admitted; artifact export, scene saves, edits, and another render are BUSY. There is no programmatic render cancel method. Blender's actual native Esc can be observed, but stopping a TypeScript job or disconnecting does not cancel native rendering or reverse effects.

Foreign render initialization, history/load changes, or uncertain restoration can produce `unknown` without a certified artifact. New renders and saves stay BUSY while an owned temporary filepath remains unresolved; inspect and resolve that reference in Blender before continuing. Global Render Result exclusivity and arbitrary addon/compositor/save-handler sandboxing are not promised. Do not equate the latest global render result with this job's owned PNG.

## Artifacts and explicit destinations

[IBlenderArtifact](../../packages/sdk/src/IBlenderArtifact.ts) contains a session/artifact handle, `renderId`, immutable `startGeneration`, `mimeType: "image/png"`, bytes, width/height, and `expiresAt`. At most four artifacts are retained, each at most 32 MiB and 128 MiB total, for 600 seconds. Export or consume an artifact before release/expiry; these private files are not permanent user output.

`readArtifact` takes `artifact`, `offset`, and optional `maxBytes` within `1..196608`, default 196608. Its [chunk result](../../packages/sdk/src/IBlenderArtifactChunk.ts) contains `artifactId`, exact `offset`/`nextOffset`, `totalBytes`, canonical `dataBase64`, and `eof`. Advance using `nextOffset`; offset equal to total returns empty EOF, while beyond-total offsets fail. `releaseArtifact(handle)` releases that private artifact only. These handles grant no arbitrary filesystem-read capability.

`saveArtifact` takes `artifact`, absolute `.png` `path`, and optional `overwrite`. `saveBlendCopy` takes absolute `.blend` `path` and optional `overwrite`. The parent must already exist; no extension is appended. `overwrite` defaults false and uses atomic no-replace publication; true explicitly permits atomic replacement. Unsupported filesystems fail rather than falling back to nonatomic publication. Artifact export copies bytes into a distinct owned file, so releasing private storage cannot alias or remove a successful user export.

Both return [IBlenderSavedFile](../../packages/sdk/src/IBlenderSavedFile.ts): actual path, bytes, sourceSessionId, and generation. For PNG export, generation is the artifact's immutable start generation; for a Blender copy, it is the scene generation observed at saving. A persistent destination is outside undo/rollback. A sent save that times out can already have published, so inspect the explicit destination before deciding whether another save is appropriate.

Native Blender saving uses copy semantics and relative-path remapping. The current working filepath remains unchanged rather than switching the open document to the copy; relative asset references are remapped for reopening, but assets are not packed. Known dirty external images are refused when Blender's native Always Save policy would write them as a side effect; global preferences are not changed to bypass this preflight. Save handlers can still have effects, and an unexpected history or working-path change is reported as uncertain. Cleanup touches only exact owned staging/backup files, never a published destination or preexisting user backup.

## Acceptance and verification

One secret-free source TS inspects the loaded scene, creates a five-vertex pyramid, assigns opaque material, adds active camera/area light, starts a caller-ID native render, polls, reads bounded PNG chunks, saves PNG and a .blend copy at explicit destinations, then reopens the .blend and rerenders the same camera/settings. Preserve the actual PNG/.blend/TS as ignored or external task-owned user artifacts, never Git. Headless and MCP consume the same scene core; background EXEC can block its Python RPC and does not inherit GUI async guarantees.

Observe actual invalid topology/shared mesh rejection, no-overwrite/explicit overwrite, chunk boundaries/release/expiry, stale reconnect and render ownership/cancellation where available. Units cover only real first-party validators/state/chunk logic, never upstream behavior, static manifests, artificial child/filesystem fixtures or a separate example package. Record unsupported observations precisely. Collect source checks, applicable Evidence, independent complete review, actual Blender results and exact-head CI in one cause round; reuse same-head CI full lint/native guards/distribution build rather than duplicate local aggregates. Green checks and fresh self/independent review lead directly to Ready/merge under the standing mandate.

Final integrated acceptance additionally covers isolated headless scene/render/save lifetime, typia MCP native images in real clients and installation of the latest extension ZIP. Their actual results belong in the relevant tracking records; source integration does not establish real-client image consumption. Package publication and release are not authorized.

## Primary-source basis

These links were inspected during the closed design research. They support the accepted behavior above, not a claim that this new feature has already passed actual acceptance.

- [Blender 5.2 GUI render invoke/start/end](https://github.com/blender/blender/blob/blender-v5.2-release/source/blender/editors/render/render_internal.cc): invoke owns a native window-manager job, write_still reaches the native start, and a new invocation can clear global Render Result. A later global result is not exclusive proof of our render output.
- [Pipeline completion ordering](https://github.com/blender/blender/blob/blender-v5.2-release/source/blender/render/intern/pipeline.cc#L1936) and [later cleanup](https://github.com/blender/blender/blob/blender-v5.2-release/source/blender/render/intern/pipeline.cc#L2003): callback completion precedes pipeline/global rendering cleanup, so a complete handler alone does not prove native job termination.
- [Python job query](https://github.com/blender/blender/blob/blender-v5.2-release/source/blender/python/intern/bpy_app.cc#L767) and [window-manager query](https://github.com/blender/blender/blob/blender-v5.2-release/source/blender/windowmanager/intern/wm_jobs.cc#L820): running-job observations do not establish exclusivity over pending work. [Handler API](https://docs.blender.org/api/5.2/bpy.app.handlers.html) describes render_init/complete/cancel; register and remove only our own handlers.
- [save_as_mainfile API](https://docs.blender.org/api/5.2/bpy.ops.wm.html#bpy.ops.wm.save_as_mainfile): copy retains the current document, relative_remap is supported, and check_existing is an overwrite warning rather than a no-replace race guarantee.
- [Native save implementation](https://github.com/blender/blender/blob/blender-v5.2-release/source/blender/windowmanager/intern/wm_files.cc#L4004): native external-image auto-save can run before the copy branch; copy/remap reach the writer and background support does not require a window. [Native backup and temporary writes](https://github.com/blender/blender/blob/blender-v5.2-release/source/blender/blenloader/intern/writefile.cc#L2045) require an owned-stage publication boundary instead of cleaning user backups.
- [os.link](https://docs.python.org/3.13/library/os.html#os.link) and [os.replace](https://docs.python.org/3.13/library/os.html#os.replace) support explicit no-replace/overwrite publication choices. Unsupported filesystems fail without a hidden nonatomic copy fallback.
