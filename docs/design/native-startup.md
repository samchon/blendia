# Native startup evidence and toolchain upgrade

Tracking: [PR #18](https://github.com/samchon/blendia/pull/18), [overall mission #1](https://github.com/samchon/blendia/issues/1), [required startup diagnosis #3](https://github.com/samchon/blendia/issues/3), and [validation #6](https://github.com/samchon/blendia/issues/6). The user-selected scope upgrades the shared `ttsc`, `@ttsc/lint`, and `@ttsc/evidence` catalog range to `^0.36.0`, with 0.36.0 installed in the lockfile. Existing public `ttsx` and source-first commands are preserved. No production bootstrap, preloader, shim, runtime/Python change, product prebuild, or alternate compiler path is introduced.

At this authored-scope checkpoint, actual 0.36.0 execution under the default inherited temporary environment is unobserved. Installation is dependency evidence, not proof of native admission or a startup fix. The tracker owns subsequent actual public-entry observations, exact-head checks, and outcomes; the historical 0.35.0 pair below cannot certify the upgraded path. [PR17's accepted functional and automation results](https://github.com/samchon/blendia/issues/6#issuecomment-6614289519) remain valid for their recorded head and environment, while the original diagnosis obligations remain unfinished.

## Separate observations

| Observation | Recorded fact | Causal limit |
| --- | --- | --- |
| Original silent configuration failure | The public config wrapper returned exit 1 | The original inherited environment, inner native status/error/stderr, exact source hash, and full input provenance were not captured |
| Historical 0.35.0 inherited TEMP/TMP run A | `config:check` returned 2 with a physical-parent temporary-directory exception before native attempt tracing began | This identifies that observed prerequisite boundary, not the original exit-1 cause or the OS actor behind the physical namespace difference |
| Historical 0.35.0 owned physical TEMP/TMP run B | The same public command returned 0 and its trace contains a native attempt returning status 0 | B's trace was present; the earlier blank-sink claim was an observer table-display error and is retracted |
| Native Go plugin build | The nested build returned status 0 after 801.166 seconds | This was a successful build interval, not the whole user-program duration or proof of a CPU/network/lock cause |
| First native emit | Its trace has an attempt without a returned result; it was manually interrupted with an honest unknown lifetime and retained input/stage | Suspended thread snapshots do not identify a suspending actor, deadlock, or natural completion |
| Separate later native emit | It returned status 0 after 413.840 seconds and that separate CLI invocation completed naturally | This is not completion of the interrupted first emit and does not establish the earlier suspension cause |

The 0.35.0 pair preserved selected source/configuration and installed-entry hashes, while using different temporary coordinates sequentially. That evidence does not establish every compiler/native/cache byte or a controlled timing benchmark. Run A failed while acquiring file-backed native-output capture, before the native-attempt trace boundary; run B reached that boundary. No new invocation, benchmark, cache purge, security change, forced process action, or global environment change follows merely from documenting this pair.

Native trace result fields `stdout: null` and `stderr: null` are recorded before file-backed output capture is read. They do not prove the child produced empty output. An independently captured outer stderr file can establish its own observed bytes, but cannot reconstruct missing historical inner stderr. Similarly, the older 830/395-second source-log creation-to-last-output intervals belonged to different programs, including an intentional application-error run; they are not isolated preparation stopwatches.

## Remaining verification boundary

Use the existing public source commands with the selected toolchain and retain actual status, diagnostics, trace presence, and the relevant input/environment identity. Keep failed prerequisites observable rather than skipping them into a green result. Existing development checks, native guards, plugin discovery, captured/inherited stdio, MCP protocol stdout, and private artifact ownership retain their roles; no upstream typia revalidation, fake child/server, or MCP E2E is added by this upgrade.

The original silent failure and old suspension actor remain unproven. A successful newer invocation cannot retrospectively supply the omitted observations, and faster later runs do not establish a solved cause or a startup guarantee. Functional acceptance and a bounded evidence review do not make the remaining required diagnosis optional or establish that the whole mission is complete. Preserve the dated [startup evidence](https://github.com/samchon/blendia/issues/3#issuecomment-6601366606), original artifacts, and explicit unknown outcomes alongside new tracker results.
