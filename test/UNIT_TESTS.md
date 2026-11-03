# First-party unit verification

Run `pnpm test` from the repository root to execute every named case through the AutoMovie-style DynamicExecutor layout, and `pnpm run test:types` separately for compiler and declaration-lint diagnostics. Local workspace consumers resolve TypeScript source without a preparatory build. No case-selection grammar or synthetic runner tests are provided.

The CLI case verifies the production launcher's prefix options, help forms, script-argument boundary, refusals, and immutable input. The SDK case verifies the production stream framer's independent wire fixtures, fragmentation, coalescing, strict decoding, byte limits, and encoder refusals. These units do not start Blender, sockets, or child processes and do not establish extension or end-to-end behavior.

Each named case answers the [testing contracts](../.agents/skills/contracts/testing.md); its package-local Evidence configuration selects those cases. The independent `test.yml` workflow checks Evidence and runs unit type checking and execution on Ubuntu and Windows without building producers. The separate `build.yml` workflow checks configuration, formatting, and distribution builds. Product validation and remaining scope are tracked in [issue #6](https://github.com/samchon/blendia/issues/6).
