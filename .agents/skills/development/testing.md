# Testing

The [canonical user instructions](../../user-instructions.md#meaningful-tests-only) determine whether a test is permitted. The package frame reserves only `test/README.md`; it has no first-party product logic, test workspace, or unit cases. Do not fill that gap with upstream behavior, configuration assertions, empty-shell imports, packed-consumer checks, or code invented solely for tests, including manual versions of those rejected smoke checks.

When actual first-party logic arrives, add meaningful unit cases for its supported behavior. Follow the AutoMovie scenario layout `test/src/features/<domain>/test_<name>.ts` where a real test workspace is justified. Export a named function or async function rather than an arrow, begin its JSDoc with the behavior and numbered `Scenarios:`, and answer [testing contracts](../contracts/testing.md).

Derive expected values independently of the implementation. Observe the actual first-party result without replacing globals or foreign methods. Compare floating-point geometry with explicit tolerances when geometry logic exists. Test execution and type checking are separate checks when such tests are implemented.

Inspect documents and configuration directly and execute their actual compiler, formatter, or Evidence tools. These checks are not unit cases and do not establish product or Blender behavior. Do not add placeholder scenarios or an empty-suite green CI claim.
