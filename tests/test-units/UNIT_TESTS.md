# First-party unit verification

The native-environment case calls the real public selector against one uniquely owned physical directory. It verifies platform-selected temporary storage, verbatim copied settings, caller and inherited environment nonmutation, and the selector's check-allocation cleanup. It launches no compiler or child and does not simulate MSIX redirection or automatic fallback; those outcomes require actual default-host observations. Its cleanup touches only its verified empty directory and preserves any unexpected child or changed identity.

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
| test_native_environment | Actual physical temporary-parent selection, verbatim copied settings, caller/process nonmutation, and removal of owned empty check allocations. |
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

The native image policy case calls the actual private delivery owner and outbound converter directly. It checks metadata-only public JSON, unchanged structured results, request and artifact correlation, one-time native delivery, canonical base64, metadata byte agreement, the one-MiB image and four-delivery capacity bounds, and explicit release. Its byte values do not establish PNG contents, expiry timing, image acquisition, URI authorization, host presentation, typia correctness, generated schemas, MCP transport behavior, or installation. This first-party policy unit is not an MCP E2E suite.

The MCP scene-mapping case checks the actual public-array to SDK-tuple boundary. It rejects wrong-length, sparse, nonnumeric and nonfinite vectors, preserves coordinate order and optional defaults across all five input shapes, and observes detached nested scene and inherited snapshot arrays and handles without changing numeric or decimal identity values. These observations establish first-party representation and copy ownership rather than typia, generated schemas, model tooling, SDK topology validation or native Blender behavior.

These units do not start Blender, sockets, or child processes. Real-engine launch, SDK operations, rendering, saved-file reopening, native process lifetime, and cleanup are owned by tests/test-blender. GUI interaction and any capabilities outside that automated suite still require explicitly recorded product validation. No MCP E2E suite is part of this test layout.

Every named case answers the [testing contracts](../../.agents/skills/contracts/testing.md), selected by this package's own Evidence configuration. Type, lint, formatting, Evidence, unit execution, and actual Blender observations are separate evidence and must not be presented as interchangeable coverage.
