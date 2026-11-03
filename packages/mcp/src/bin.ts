#!/usr/bin/env node
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import process from "node:process";

import type { IBlendiaMcpHeadlessConfiguration } from "./IBlendiaMcpHeadlessConfiguration";
import type { IBlendiaMcpOptions } from "./IBlendiaMcpOptions";
import { createBlendiaMcpServer } from "./createBlendiaMcpServer";

/** Start one stdio session; stdout belongs exclusively to JSON-RPC framing. */
async function main(): Promise<void> {
  const executable: string | undefined =
    process.env.BLENDIA_MCP_BLENDER_EXECUTABLE;
  const extensionDirectory: string | undefined =
    process.env.BLENDIA_MCP_EXTENSION_DIRECTORY;
  if ((executable === undefined) !== (extensionDirectory === undefined))
    throw new Error("Both private headless paths are required together.");

  let headless: IBlendiaMcpHeadlessConfiguration | undefined;
  if (executable !== undefined && extensionDirectory !== undefined)
    headless = {
      blenderExecutable: executable,
      extensionDirectory,
      startupTimeoutMs: readDeadline("BLENDIA_MCP_STARTUP_TIMEOUT_MS"),
      shutdownTimeoutMs: readDeadline("BLENDIA_MCP_SHUTDOWN_TIMEOUT_MS"),
    };

  const options: IBlendiaMcpOptions = { headless };

  // The public SDK transport owns framing and the four-MiB inbound bound.
  const server: McpServer = await createBlendiaMcpServer(
    new StdioServerTransport(process.stdin, process.stdout, {
      maxBufferSize: 4 * 1024 * 1024,
    }),
    options,
  );

  const close: () => void = (): void => {
    void server.close().catch((): void => {
      process.stderr.write("Blendia MCP transport cleanup failed.\n");
      process.exitCode = 1;
    });
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
  process.stdin.once("end", close);
}

/** Read a private lifecycle deadline in the runtime's supported milliseconds. */
function readDeadline(name: string): number | undefined {
  const value: string | undefined = process.env[name];
  if (value === undefined) return undefined;

  const number: number = Number(value);
  if (!Number.isInteger(number) || number < 100 || number > 3600000)
    throw new Error("Invalid private headless deadline.");
  return number;
}

void main().catch((): void => {
  // Errors can include private connection inputs; emit no raw exception here.
  process.stderr.write("Blendia MCP startup failed.\n");
  process.exitCode = 1;
});
