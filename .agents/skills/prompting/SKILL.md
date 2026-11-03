---
name: prompting
description: Maintains Blendia user instructions, agent routers, skills, and supporting guides with single ownership and precise triggers. Use before changing AGENTS.md, CLAUDE.md, .agents/user-instructions.md, or .agents/skills.
---

# Prompting

The [canonical user instructions](../../user-instructions.md) own current user constraints and must be reopened before every work unit and action. Update them when instructions change, then reconcile affected skills and guides without preserving superseded requirements as current rules.

Keep one canonical `.agents/skills/<name>/SKILL.md` tree. `AGENTS.md` stays below 200 lines and routes the canonical instructions and every actual skill by trigger and link; `CLAUDE.md` contains exactly `@AGENTS.md` and a final newline. Do not create copied `.claude/skills` or `.codex/skills` trees or junctions.

Give every rule one owner and link its callers when moving it. `SKILL.md` holds purpose, essential boundaries, and routing; put a substantial conditional branch in a directly linked sibling guide. Do not nest skills or copy AutoMovie's unrelated production rules. Each skill has YAML frontmatter, a lowercase hyphenated name matching its directory, and a third-person description explaining what it does and when it applies.

Use the available `skill-creator` workflow when creating or substantially revising reusable skills. Preserve user intent and existing action authorization; skills do not add permission checkpoints to the user's delivery mandate. Keep historical decisions in issues and git, and apply the [documentation](../documentation/SKILL.md) writing rules.

Validate frontmatter, references, trigger reachability, and rule ownership together. Run the available skill validator and any new helper scripts. Compare instructions with a real governed change and its consumers; report structural inspection separately from observed behavior. Add declaration-wide obligations to the applicable [contract](../contracts/SKILL.md) with an answer migration rather than burying them in long prompt prose.
