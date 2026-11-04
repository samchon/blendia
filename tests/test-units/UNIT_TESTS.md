# First-party unit verification

The native-environment case calls the real production selector and project-launch preparation through internal source seams against uniquely owned physical directories. It verifies that complete coherent absolute settings remain verbatim, missing or conflicting secondary settings align to the healthy primary, and cwd-dependent primary paths use retained physical storage that two distinct project working directories resolve identically. On Windows it checks actual mixed-case aliases, lexical first-key priority, undefined alias suppression and drive-dependent paths; on POSIX it checks relative paths and unrelated lowercase names. It launches no compiler or child, changes no global cwd or environment, and does not simulate MSIX redirection. Cleanup touches only unchanged empty directories allocated by the case, preserves unexpected children or changed identities, never removes automatic fallback storage, and retains assertion and cleanup failures independently.

Run `pnpm test` from the repository root, or `pnpm --filter @blendia/test-units start`, to execute every named case. Run `pnpm --filter @blendia/test-units build` separately for ordinary `ttsc --noEmit` diagnostics, `pnpm --filter @blendia/test-units lint` for configured declaration and correctness diagnostics, and `pnpm --filter @blendia/test-units evidence` for its behavioral checklist. These commands execute workspace sources without a preparatory product build.

The DynamicExecutor entry discovers named cases under src/features, reports every failure, rejects an empty suite, and leaves a failing process status when any case fails. There is no case-selection grammar or synthetic runner test.

| Case | First-party observations |
| --- | --- |
| test_cli_arguments | Saved-file and Text argument ownership, immutable input, origin-label exception, machine flags, discovery probe consent and bounds, and doctor paths. |
| test_headless_arguments | Required executable and extension paths, launcher-option uniqueness, decimal deadline bounds, unchanged defaults, script tails, and runtime admission of malformed JavaScript deadline values. |
| test_blender_frames | Independently authored wire fixtures, fragmentation, coalescing, strict UTF-8, byte limits, and encoder refusals. |
| test_scene_inputs | Finite coordinates, topology bounds, detached copies, material and camera/light inputs, handle lifetime, and query cursors. |
| test_render_artifacts | Caller-owned UUIDs, native-job variants, PNG provenance metadata, canonical base64 windows, exact offsets, progress, EOF, and byte bounds. |
| test_script_logs | Incremental UTF-8, split-token redaction, stream tags, paging, retention gaps, immutable reads, and invalid cursor/budget refusals. |
| test_script_job_state | Monotonic phases, terminal ownership, ordinary versus bootstrap/uncertain outcomes, copied snapshots, and bounded credential-free metadata. |
| test_native_environment | Coherent absolute temporary settings, Node/Go selector alignment, actual platform aliases, physical storage across two project cwd values, caller/process nonmutation, and owned empty-directory cleanup. |
| test_connection_environment | Actual platform credential aliases and priority, independent explicit overrides, fresh headless credential removal, copied inputs, and canonical canary redaction in real log/state owners. |
| test_bridge_envelopes | Decimal correlation IDs, exclusive success/failure arms, optional pre-authentication identity, and explicit effects. |
| test_bridge_handshake | Protocol mismatch, safe generation, copied capabilities, and malformed session metadata. |
| test_object_identity | Full-width object IDs, fresh snapshot identity, detached local vectors, and malformed native metadata. |
| test_object_mutation_inputs | Cube parameters, nonempty partial transforms, magnitude limits, sparse/malformed coordinates, and copied mutation inputs. |
| test_mesh_input_shape | Missing, non-array, sparse, and coercible bulk mesh coordinates and indices at the real admission boundary. |
| test_scene_responses | Strict numeric UID ordering, page identity and continuation, detached objects/camera handles, and bounded native mesh counts. |
| test_material_responses | Assignment identity pairs, stale-reference failures, copied opaque shader parameters, and malformed material snapshots. |
| test_camera_light_responses | Finite native precision, optical ordering, active-camera booleans, illumination ranges, native types, and copied readback. |
| test_save_publication | Explicit destinations, overwrite semantics, source session/generation, positive safe byte counts, and empty release completion. |
| test_native_image_policy | Metadata-only JSON, correlated one-time native-image delivery, canonical bounded bytes, capacity, and explicit cleanup. |
| test_scene_mapping | Strict public-array to SDK-tuple conversion and detached nested scene, geometry, material, camera, and light representations. |

The headless admission case calls the actual production preflight with explicit null startup and shutdown deadlines and malformed script arguments, including sparse arrays, and requires precise admission errors before prerequisite filesystem access. It does not simulate a child process or infer shutdown, descendant termination, or cleanup from an observation timeout.

The SDK cases establish first-party client admission and response ownership, including malformed JavaScript inputs before transmission and literal JSON-shaped native replies. They do not establish native mesh correctness, PNG pixel contents, artifact retention, native rendering, or file publication. The runtime cases call the production internal journal and state owner consumed by ScriptJob; direct internal imports follow the existing framing case and introduce no test-only public API.

The connection-environment case calls the actual helper consumed by captured jobs, project launch, and fresh headless launch. It checks actual Windows lexical first-key selection and undefined suppression or POSIX exact-case selection, canonical credentials, independent overrides including empty token and port zero, inherited credential removal before explicit replacement, and caller/process nonmutation. A harmless selected canary passes through the real ScriptLog and ScriptJobState owners to establish redaction at their supported seams; the case does not launch a child or mutate globals.

The native image policy case calls the actual private delivery owner and outbound converter directly. It checks metadata-only public JSON, unchanged successful structured results, request and artifact correlation, one-time native delivery, canonical base64, metadata byte agreement, the one-MiB image and four-delivery capacity bounds, and explicit release. Unavailable bytes after artifact release, session replacement, close, replay, or a mismatched image response produce a correlated typed failure without native content, private bytes, or partial successful metadata; refused mismatches leave the original valid delivery usable. Its byte values do not establish PNG contents, expiry timing, image acquisition, URI authorization, host presentation, typia correctness, generated schemas, MCP transport behavior, or installation. This first-party policy unit is not an MCP E2E suite.

The MCP scene-mapping case checks the actual public-array to SDK-tuple boundary. It rejects wrong-length, sparse, nonnumeric and nonfinite vectors, preserves coordinate order and optional defaults across all five input shapes, and observes detached nested scene and inherited snapshot arrays and handles without changing numeric or decimal identity values. These observations establish first-party representation and copy ownership rather than typia, generated schemas, model tooling, SDK topology validation or native Blender behavior.

These units do not start Blender, sockets, or child processes. Real-engine launch, SDK operations, rendering, saved-file reopening, native process lifetime, and cleanup are owned by tests/test-blender. GUI interaction and any capabilities outside that automated suite still require explicitly recorded product validation. No MCP E2E suite is part of this test layout.

Every named case answers the [testing contracts](../../.agents/skills/contracts/testing.md), selected by this package's own Evidence configuration. Type, lint, formatting, Evidence, unit execution, and actual Blender observations are separate evidence and must not be presented as interchangeable coverage.
