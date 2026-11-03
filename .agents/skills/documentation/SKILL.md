---
name: documentation
description: Writes Blendia maintained documentation, README examples, and doc comments. Use before authoring or changing those surfaces, including skill prose.
---

# Documentation

Write identifiers, code comments, JSDoc, maintained technical documentation, skills, commits, and PR descriptions in English. Preserve user-requested Korean research and conversation evidence; user-facing conversation follows the user's language.

Write what the reader needs and cannot infer from the code. Lead with the concrete behavior, use plain terms consistently, and keep one topic per paragraph. Use lists for parallel items and sequences, tables for mappings, and code blocks for exact commands. Explain a consequential restriction's reason where the reader encounters it. Remove repeated rules and generic guidance.

Write each Markdown prose paragraph on one physical source line. Do not insert manual newlines to provide word wrapping; let the reader or editor wrap the display. Keep paragraph boundaries and semantic Markdown structures, including headings, list items, tables, and code fences, intact.

A README is for users: explain the product, installation, and actual usage. Do not add a Development section or list Node.js/pnpm versions. Put developer workflows, tool versions, configuration, build and test commands, CI, Evidence, and monorepo internals in development documentation or their owning skills instead. Take examples from runnable consumers and mark unsupported capabilities clearly. The [contracts](../contracts/SKILL.md) own what declaration comments must substantiate; [prompting](../prompting/SKILL.md) owns instruction layout. Historical decisions and research belong in the GitHub tracker, with repository documents as linked context.
