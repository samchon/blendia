# Validation

Reopen the [canonical user instructions](../../user-instructions.md) before each action. Apply their batch-by-cause rule to every verification round.

For the current frame, collect build, shared configuration checking, formatting, and Evidence results together. The [project commands](../project/commands.md) describe the actual commands. There are no applicable first-party unit cases yet; do not add smoke tests or synthetic infrastructure to manufacture a passing suite. When real first-party logic and permitted unit tests arrive, include their execution and type checking in the affected round.

For a focused change, choose checks that exercise the changed contracts and actual consumers. Broaden only for a failure, changed dependency, or unresolved concern. Distinguish inspection, local execution, CI execution, and real Blender validation in reports. Record environment-dependent checks that cannot run and their exact blocker.

Use the shared Prettier configuration on changed matching files during final preparation, then run `format:check`. Avoid unrelated reformatting. Complete [self-review](../review/SKILL.md) and the [delivery procedure](../pull-request/SKILL.md) before reporting the mission complete.
