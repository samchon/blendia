# MCP agent tools

## Status and scope

This planning seed opens the MCP facade before implementation. [MCP #5](https://github.com/samchon/blendia/issues/5) and its [closed public API and host-acceptance handoff](https://github.com/samchon/blendia/issues/5#issuecomment-6611074046) own the research, decisions and remaining questions. It follows shared runtime execution, SDK scene/render/save and owned headless execution; a separate test-automation Draft owns the tests/* migration and new automated E2E workflows.

The facade consumes the actual SDK for nonvisual scene inspection/mutation and native rendering, plus shared captured jobs, explicit-directory discovery, metadata doctor and owned headless execution. It exposes bounded owned PNG image tools/resources. Final method names and ownership are frozen with the real producers before implementation, keeping one service implementation across consumers.

## Generated schema and native images

Use typia.llm.application/controller and @typia/mcp for generated schema, input/result validation and dispatch. Use the researched public APIs in the actual product integration; no separate typia revalidation task is included. The previously inspected factory emits structuredContent with optional JSON text fallback; this alone does not emit native image content.

Use a minimal typed-result adapter at a public transport boundary when required for native PNG results. Preserve request correlation, structured metadata, errors and generated tool discovery. Do not use private hooks, assume high-level and generated tool registries merge, or implement another MCP framework. Resource access uses the public API and does not imply the host model consumed a native image.

Keep stdout exclusively JSON-RPC and diagnostics/source preparation on stderr. Apply public transport input bounds and the existing SDK artifact/UTF-8/base64/offset/size contracts. No arbitrary filesystem read endpoint is included. Known credentials, configuration, environment and private input never become public metadata or resource content.

## Ownership and lifetime

Respect session/startGeneration, expiration, release and bounded artifact storage. Render requests preserve the caller's UUID across an unknown reply for explicit later lookup; they are not replayed. Disconnect and stopping TypeScript do not cancel Blender rendering.

Headless bridge artifact handles expire when their owned Blender exits. Published user files persist separately; any MCP-owned bounded copy must have its own truthful lifetime. Do not return a durable URI for an expired bridge object. Startup, tool and render deadlines are distinct; a longer timeout is not a performance or cancellation claim.

## Acceptance

Verify actual tools/list and tools/call with the real shared services, structured errors and native PNG output. Preserve the existing meaningful unit coverage and exact-head source/CI checks. The later authorized tests/test-units and tests/test-blender suites preserve meaningful units and automate real Blender under their own Draft. MCP automated E2E was explicitly canceled; both real coding-agent native-image acceptance runs remain required.

Run one real native-image tool call in each Codex and Claude Code. Each host must identify two visual properties omitted from prompt and metadata; provide neither answer nor image path/base64. Audit the complete host tool stream for zero shell/file/image-open fallback. Initialization or protocol receipt alone is insufficient model-consumption evidence. Use task-owned temporary configuration without changing global/project settings or authentication.

Final integrated acceptance installs the latest actual extension ZIP and uses a secret-free scene TypeScript workflow to produce persistent PNG and .blend outputs, including the same scene through headless and MCP image consumption. Preserve user artifacts outside Git with safe provenance and hashes. Do not claim prior source registration was ZIP installation or UI click automation.

## Boundaries

No full bpy/RNA/codegen parity, arbitrary Python endpoint, embedded JavaScript runtime, Blender rewrite, Three.js integration, daemon, false process-tree cancel, package publication or release is included. Remaining cold native preparation observations and unexecuted limitations stay explicit in issues.
