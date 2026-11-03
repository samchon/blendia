# Testing

Write meaningful units of actual first-party logic and actual Blender engine scenarios at their respective boundaries. Do not invent implementation solely to have something to test. Do not add package.json/configuration string or structure tests, empty-package import tests, upstream typia transformation tests, distribution/export/tarball smoke tests, or synthetic tests of logic created only for testing. Do not reintroduce these rejected checks as manual smoke probes.

| Workspace | Boundary and maintained guide |
| --- | --- |
| `tests/test-units` (`@blendia/test-units`) | [First-party units](../../../tests/test-units/UNIT_TESTS.md), independent of an installed Blender engine. |
| `tests/test-blender` (`@blendia/test-blender`) | [Actual Blender E2E](../../../tests/test-blender/TESTING.md), including official extension packaging and installation. |

Follow the AutoMovie scenario layout within each module: `src/features/<domain>/test_<name>.ts`. Export a named function or async function rather than an arrow, begin its JSDoc with the behavior and numbered `Scenarios:`, and answer the [contracts](../contracts/SKILL.md) selected by that module's Evidence configuration. Keep meaningful first-party MCP logic units in the unit module; do not add an MCP E2E module or revalidate upstream typia.

Derive expected values independently of the implementation. Observe the actual first-party result without replacing globals or foreign methods. Compare floating-point geometry with explicit tolerances when geometry logic exists. Test execution and type checking are separate checks, and both modules consume local TypeScript sources without a prebuild.

Inspect documents and configuration directly and execute their actual compiler, formatter, or Evidence tools. These checks are not unit cases and do not establish product or Blender behavior. Do not add placeholder scenarios or an empty-suite green CI claim.

The engine suite runs real Blender through the ZIP-installed extension and public first-party interfaces. Preserve independent native observations of scene state, geometry, rendering, and saved-file reopening; a fake child or an implementation-derived expected value cannot stand in for the engine. Extension build and installation are real suite prerequisites, not a requirement to compile TypeScript packages first.

Report the actual engine version, environment, executed scenarios, and retained observations. Headless engine coverage does not establish GUI interaction. Follow the module guide for isolated configuration, process ownership, uncertain outcomes, and public artifact selection; private runtime storage must not be uploaded as test evidence. A configured workflow, checklist annotation, or empty suite does not establish a passing engine run.
