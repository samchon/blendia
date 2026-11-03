# Validation

Follow [AGENTS.md](../../../AGENTS.md) before each action and apply its batch-by-cause rule to every verification round.

Collect the affected build, configuration, formatting, Evidence, and meaningful first-party unit-test results together. The [project commands](../project/commands.md) describe the shared commands; package manifests determine implemented test commands. When no applicable first-party unit cases exist, say so without manufacturing a passing suite.

For a focused change, choose checks that exercise the changed contracts and actual consumers. Broaden only for a failure, changed dependency, or unresolved concern. Distinguish inspection, local execution, CI execution, and real Blender validation in reports. Record environment-dependent checks that cannot run and their exact blocker.

Use the shared Prettier configuration on changed matching files during final preparation, then run `format:check`. Avoid unrelated reformatting. Complete [self-review](../review/SKILL.md) and the [delivery procedure](../pull-request/SKILL.md) before reporting the mission complete.
