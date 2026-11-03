# Unit tests

No unit tests currently exist. The package shells contain no first-party product
behavior to exercise. This directory reserves the future test location; it is not
a pnpm workspace and has no runner or CI test job.

Add meaningful unit tests when real first-party logic is implemented, following
the [testing guidance](../.agents/skills/development/testing.md). Compiler,
formatter, and Evidence checks validate the current frame without claiming product
behavior or passing test scenarios.

Implementation and verification work is tracked in
[issue #6](https://github.com/samchon/blendia/issues/6).
