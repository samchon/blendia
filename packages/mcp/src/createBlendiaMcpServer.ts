import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpServer } from "@typia/mcp";
import process from "node:process";
import typia, { type ILlmController } from "typia";

import { BlendiaMcpContext } from "./BlendiaMcpContext";
import { BlendiaMcpController } from "./BlendiaMcpController";
import type { IBlendiaMcpOptions } from "./IBlendiaMcpOptions";
import { registerBlendiaMcpResources } from "./registerBlendiaMcpResources";

/**
 * Create typed Blender tools and owned image resources without opening stdin.
 *
 * Connection credentials and headless configuration belong to the server
 * owner, never to model-visible parameters. Connect the result through
 * BlendiaMcpTransport to enable native image content.
 *
 * @evidence contracts/common.md#principled-implementation typia.llm.application reflects the actual controller once, and createMcpServer owns schema presentation, argument/output validation, and dispatch; resources use the public SDK registry.
 * @evidence contracts/common.md#clear-and-simple-design The factory composes the real service and protocol adapters, leaving transport selection to its caller and connection configuration outside tool schemas.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts There are no hand-authored tool schemas, duplicate registerTool handlers, private framework hooks, or alternate MCP framework.
 * @evidence contracts/common.md#meaningful-documentation The API documents private configuration, caller-owned transport connection, and the native image adapter requirement.
 */
export function createBlendiaMcpServer(
  options: IBlendiaMcpOptions = {},
): McpServer {
  const context: BlendiaMcpContext = new BlendiaMcpContext(options);
  const controller: BlendiaMcpController = new BlendiaMcpController(context);
  const reflected: ILlmController<BlendiaMcpController> = {
    protocol: "class",
    name: "blendia",
    application: typia.llm.application<BlendiaMcpController>(),
    execute: controller,
  };
  const server: McpServer = createMcpServer(reflected, {
    version: "0.1.0",
    textFallback: false,
  });
  registerBlendiaMcpResources(server, controller);

  const previous: (() => void) | undefined = server.server.onclose;
  server.server.onclose = (): void => {
    previous?.();
    void context.close().catch((): void => {
      process.stderr.write("Blendia MCP cleanup failed.\n");
    });
  };
  return server;
}
