# Testing

Write only meaningful unit tests of actual first-party logic. Do not invent implementation solely to have something to test. Do not add package.json/configuration string or structure tests, empty-package import tests, upstream typia transformation tests, distribution/export/tarball smoke tests, or synthetic tests of logic created only for testing. Do not reintroduce these rejected checks as manual smoke probes.

Add test infrastructure alongside the first real first-party behavior that justifies it. When no such behavior exists, reserve the future test location without a placeholder workspace, harness, dependency, command, CI test job, or passing scenario. Follow the AutoMovie scenario layout `test/src/features/<domain>/test_<name>.ts` when a real test workspace exists. Export a named function or async function rather than an arrow, begin its JSDoc with the behavior and numbered `Scenarios:`, and answer [testing contracts](../contracts/testing.md).

Derive expected values independently of the implementation. Observe the actual first-party result without replacing globals or foreign methods. Compare floating-point geometry with explicit tolerances when geometry logic exists. Test execution and type checking are separate checks when such tests are implemented.

Inspect documents and configuration directly and execute their actual compiler, formatter, or Evidence tools. These checks are not unit cases and do not establish product or Blender behavior. Do not add placeholder scenarios or an empty-suite green CI claim.

Earlier integration research is advisory context for manual validation of real product behavior. It does not authorize automated integration suites under this unit-test-only rule. Do not substitute an upstream or synthetic smoke probe for real product validation.
