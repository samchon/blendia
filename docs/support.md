# Observed environments and limits

Blendia's recorded observations cover specific workflows and environments, not every Blender version or operating system. The package remains unpublished. Use the [product guides](../README.md#usage-documentation) for setup and the [validation guide](design/automated-validation.md) for what the automated suites actually observe.

| Environment | Recorded scope | What it does not establish |
| --- | --- | --- |
| Blender 5.2.0 on Windows, graphical application | Live SDK scene operations, file/Text macros, native PNG and `.blend` output, and native reopening in the completed product slices | Every GUI action, full addon callback parity, or other Blender releases |
| Blender 5.2.0 on Windows, installed extension and owned headless execution | Actual ZIP installation and one-shot scene/render/save lifetime with explicit executable/extension paths | A daemon, durable private artifact handles after exit, or cancellation during blocking native rendering |
| Codex and Claude Code with the PR16 MCP server | Both hosts consumed native PNGs, answered blind visual questions, and completed without shell/file/image-open fallback | Other MCP hosts, arbitrary resource-blob presentation, or general model accuracy |
| Ubuntu 24.04, official Blender 5.2.0 Linux x64, CPU | A configured PR17 installed-engine CI target; its current run is not certified by this guide | A passing E2E result before the actual workflow completes |
| Unit CI on Ubuntu and Windows | Source-based first-party logic checks; PR17's expanded eighteen-case suite requires its own results | Native Blender, graphical interaction, or host image consumption |
| Other operating systems, Blender versions, and agent hosts | Not established by the recorded matrix | Universal compatibility or a fallback installation |

The [PR16 acceptance record](https://github.com/samchon/blendia/issues/5#issuecomment-6612053287) and [exact-source review](https://github.com/samchon/blendia/pull/16#pullrequestreview-5758452029) distinguish live connection ownership, native-image perception, normal cleanup, and CI. Earlier scene and headless observations belong to [PR14](https://github.com/samchon/blendia/pull/14) and [PR15](https://github.com/samchon/blendia/pull/15). PR17's [validation tracker](https://github.com/samchon/blendia/issues/6) owns the new automated results; prior manual acceptance is not relabeled as an automated suite pass.

## First-use preparation

Allow for native compiler/plugin preparation before user TypeScript begins. Recorded observations include a roughly 801-second first-use run and a 413.840-second native preparation interval, while some warm runs took roughly 28–35 seconds. These were different runs and conditions, not a controlled cold/warm benchmark. Their causes are not fully established, and no fix or guaranteed warm-start speedup is claimed. A long quiet interval or a temporary Suspended thread snapshot does not prove a deadlock or justify starting a second copy.

The [canonical first-run guide](design/script-jobs.md#first-run-preparation) explains project compiler/dependency setup, possible network/Go/cache preparation, and preserving the final observed outcome. Its [dated timing evidence](https://github.com/samchon/blendia/issues/3#issuecomment-6601366606) remains separate from the [later MCP acceptance observations](https://github.com/samchon/blendia/issues/5#issuecomment-6612053287). Metadata-only doctor output does not execute native prerequisites. Host startup, tool-call, SDK-response, native-observation, and cooperative shutdown budgets are distinct; none promises process-tree cancellation or rollback.

Blendia exposes bounded authored operations and explicit scene/process/file lifetimes. It does not provide full `bpy` parity, a replacement TS IDE, universal synchronous addon callbacks, automatic replay of uncertain mutations, or guaranteed cancellation. Explicit saved user PNG and `.blend` files outlive the owned process; private bridge artifacts and their MCP resource identities do not.
