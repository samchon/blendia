---
name: prompting
description: Maintains Blendia agent routers, skills, supporting guides, and local session-record storage with single ownership and precise triggers. Use before changing AGENTS.md, CLAUDE.md, .agents/skills, or instruction storage.
---

# Prompting

Put durable repository rules in [AGENTS.md](../../../AGENTS.md) and their owning skills so a fresh clone contains complete instructions. Keep personal conversation history, session-specific roles, and temporary mission stages only in the ignored `.agents/local/` directory. Optional local context may supplement tracked rules but must never be a required link or prerequisite. Preserve useful local records when reorganizing them, and never stage them.

Keep one canonical `.agents/skills/<name>/SKILL.md` tree. `AGENTS.md` stays below 200 lines and routes every actual skill by trigger and link; `CLAUDE.md` contains exactly `@AGENTS.md` and a final newline. Do not create copied `.claude/skills` or `.codex/skills` trees or junctions.

Give every rule one owner and link its callers when moving it. `SKILL.md` holds purpose, essential boundaries, and routing; put a substantial conditional branch in a directly linked sibling guide. Do not nest skills or copy AutoMovie's unrelated production rules. Each skill has YAML frontmatter, a lowercase hyphenated name matching its directory, and a third-person description explaining what it does and when it applies.

Use the available `skill-creator` workflow when creating or substantially revising reusable skills. Preserve user intent and existing action authorization; skills do not add permission checkpoints to the user's delivery mandate. Keep historical decisions in issues and git, and apply the [documentation](../documentation/SKILL.md) writing rules.

Validate frontmatter, references, trigger reachability, and rule ownership together. Run the available skill validator and any new helper scripts. Compare instructions with a real governed change and its consumers; report structural inspection separately from observed behavior. Add declaration-wide obligations to the applicable [contract](../contracts/SKILL.md) with an answer migration rather than burying them in long prompt prose.
