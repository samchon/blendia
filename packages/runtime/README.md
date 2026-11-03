# @blendia/runtime

Shared TypeScript execution and session boundary; infrastructure scaffold only.

This private workspace currently exports an empty module. It has no usable
product API or executable command. See the [workspace README](../../README.md)
for verified development commands and implementation tracking.

Local development resolves `src/index.ts`. `pnpm pack` builds `lib` through
`prepack` and applies `publishConfig` so installed tarballs resolve emitted
JavaScript and declarations. Publication remains disabled until real functionality
and its consumer are implemented and verified.
