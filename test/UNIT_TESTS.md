# First-party unit verification

Run `pnpm run build` from the repository root before checking units, because workspace dependencies resolve their built output. Then run `pnpm test` to execute every named case through the AutoMovie-style DynamicExecutor layout, and `pnpm run test:types` separately for compiler and declaration-lint diagnostics. No case-selection grammar or synthetic runner tests are provided.

The CLI case verifies the production launcher's prefix options, help forms, script-argument boundary, refusals, and immutable input. The SDK case verifies the production stream framer's independent wire fixtures, fragmentation, coalescing, strict decoding, byte limits, and encoder refusals. These units do not start Blender, sockets, or child processes and do not establish extension or end-to-end behavior.

Each named case answers the [testing contracts](../.agents/skills/contracts/testing.md); its package-local Evidence configuration selects those cases. CI builds producers before Evidence and units, and executes unit type checking and execution on Ubuntu and Windows. Product validation and remaining scope are tracked in [issue #6](https://github.com/samchon/blendia/issues/6).
