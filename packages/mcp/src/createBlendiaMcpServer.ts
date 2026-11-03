import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { createMcpServer } from "@typia/mcp";
import process from "node:process";
import typia, { type ILlmController } from "typia";

import { BlendiaMcpContext } from "./BlendiaMcpContext";
import { BlendiaMcpController } from "./BlendiaMcpController";
import { BlendiaMcpImageDelivery } from "./BlendiaMcpImageDelivery";
import { BlendiaMcpTransport } from "./BlendiaMcpTransport";
import type { IBlendiaMcpOptions } from "./IBlendiaMcpOptions";
import { registerBlendiaMcpResources } from "./registerBlendiaMcpResources";

/**
 * Create and connect typed tools with one private native-image delivery owner.
 *
 * Connection credentials and headless configuration belong to the server
 * owner, never to model-visible parameters. The supplied public transport is
 * wrapped before connection, so callers cannot accidentally omit native images.
 *
 * @evidence contracts/common.md#principled-implementation typia.llm.application reflects the actual controller once, and createMcpServer owns schema presentation, argument/output validation, and dispatch; public resource and transport APIs share one private delivery owner.
 * @evidence contracts/common.md#clear-and-simple-design The factory composes the real service and transport before connecting, leaves stream selection to its caller, and keeps raw PNG delivery and connection configuration outside tool schemas.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts There are no hand-authored tool schemas, duplicate registerTool handlers, private framework hooks, or alternate MCP framework.
 * @evidence contracts/common.md#meaningful-documentation The API documents private configuration, caller-supplied transport ownership, automatic native-image composition, and asynchronous connection.
 */
export async function createBlendiaMcpServer(
  transport: Transport,
  options: IBlendiaMcpOptions = {},
): Promise<McpServer> {
  const delivery: BlendiaMcpImageDelivery = new BlendiaMcpImageDelivery();
  const context: BlendiaMcpContext = new BlendiaMcpContext(options, delivery);
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
  registerBlendiaMcpResources(server, context);

  server.server.onerror = (): void => {
    process.stderr.write("Blendia MCP protocol error.\n");
  };

  const previous: (() => void) | undefined = server.server.onclose;
  server.server.onclose = (): void => {
    previous?.();
    void context.close().catch((): void => {
      process.stderr.write("Blendia MCP cleanup failed.\n");
    });
  };
  try {
    await server.connect(new BlendiaMcpTransport(transport, delivery));
  } catch (error) {
    await context.close();
    throw error;
  }
  return server;
}
