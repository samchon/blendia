# Blender file and Text macros

Tracking: [#4](https://github.com/samchon/blendia/issues/4), with shared runtime work in [#3](https://github.com/samchon/blendia/issues/3) and actual verification in [#6](https://github.com/samchon/blendia/issues/6). This planning seed precedes implementation of this slice. The live SDK/bridge/runtime/CLI foundation was merged in [#9](https://github.com/samchon/blendia/pull/9); it does not yet provide Blender-internal TypeScript macro execution.

## Bounded scope

Add Blender actions for running a project file and the active Text datablock through the existing shared TypeScript runtime. Settings identify the project directory, logical source path, optional project tsconfig, Node executable, installed CLI entry and argument array. Consuming projects need the native TypeScript compiler and their SDK/npm dependencies. Reuse the authenticated live Blender session; do not introduce a second bridge or a TS engine.

The UI launches without a shell and remains responsive while a bounded timer drains stdout/stderr and polls child status. Incremental decoding and bounded retained logs expose diagnostics and final outcomes without blocking reads or `wait`/`communicate` on Blender's UI thread. Credentials stay out of logs and results. Concurrent runs must have an explicit ownership policy.

A proposed shared `runTextMacro` operation takes the Text snapshot and declared project/source context, creates an exclusive random sibling with the same TypeScript suffix, delegates to the existing project runner, then cleans up only its owned staging input once execution has conclusively settled. Python can provide a bounded private UTF-8 input file, closed before launch on Windows. The original source, Text datablock and tsconfig must not be overwritten. Exact public API and ownership details remain implementation decisions.

This is module-macro staging with explicit origin metadata. The temporary path is the real compiler/runtime path, while the result can identify its originating Blender Text and intended source path. A stale on-disk source can still fail project checking, and the staged basename, module identity and `import.meta.url` differ. Do not present sibling staging as a full unsaved editor overlay, self-import replacement, IDE or LSP.

Stop and cleanup must distinguish a stop request, confirmed direct-child exit, unconfirmed descendants and possible Blender side effects. Killing a launcher does not prove its ttsx child tree stopped and does not roll back mutations. Implement only an ownership guarantee that can be demonstrated; retain and report potentially live staging inputs when exit is uncertain. A Windows Job Object is an available design option, not an implemented guarantee.

## Acceptance

- A user can run an actual project file from Blender and observe its existing SDK operation and logs without leaving the UI.
- A user can run an edited active Text snapshot in explicit project context, with honest source/staging diagnostics, preserved original files and owned cleanup.
- Actual first-party logic receives meaningful units; direct Blender observations cover the supported UI/file/Text behavior. Do not add configuration, upstream, empty-import, package-distribution or artificial smoke suites.
- Complete the full applicable verification/review round, then require all configured CI on the exact source head before Ready and immediate merge.

## Following slices and sources

Material/camera operations, asynchronous render/jobs, artifacts, thin typia MCP with native images and later headless reuse remain following bounded slices. This UI slice preserves those goals without mixing their implementation into its acceptance. Existing Blender continues to own its engine, editor and renderer; Three.js, full bpy parity and universal synchronous addon callbacks remain outside scope.

Source-verified research and limitations are preserved in [#4's Stage 2 proposal](https://github.com/samchon/blendia/issues/4#issuecomment-6598702203). Relevant primary references are Blender's [Text API](https://docs.blender.org/api/5.2/bpy.types.Text.html), [ttsx execution](https://ttsc.dev/docs/ttsc/execute/), Python [nonblocking descriptors](https://docs.python.org/3.13/library/os.html#os.set_blocking), [subprocess ownership](https://docs.python.org/3.13/library/subprocess.html), Windows limitations of [select](https://docs.python.org/3.13/library/select.html), and Windows [Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects). These support the design; they are not executed UI/Text validation results.
