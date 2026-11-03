import type { IBlenderArtifactHandle } from "@blendia/sdk";
import {
  type McpServer,
  type ReadResourceTemplateCallback,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

import type { BlendiaMcpController } from "./BlendiaMcpController";

/**
 * Register bounded owned PNG reads separately from typia's tool registry.
 *
 * URIs convey opaque handles, never filesystem paths. The controller requires
 * metadata observed from a successful render in this server and enforces the
 * same byte, expiry, and session rules as the native image tool.
 *
 * @evidence contracts/common.md#principled-implementation A public ResourceTemplate maps two bounded opaque URI segments to the same readImage controller method; SDK-owned artifact validity remains authoritative.
 * @evidence contracts/common.md#clear-and-simple-design Resource registration uses the SDK resource registry without touching typia's tool handlers or duplicating artifact-reading logic.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Resource addresses grant no arbitrary path read; errors are propagated rather than replaced by fabricated image data.
 * @evidence contracts/common.md#meaningful-documentation The template and comments state URI identity, successful-render discovery, and the shared resource lifetime.
 * @evidence contracts/performance.md#efficient-algorithms Each request performs bounded URI checks followed by the controller's capped linear PNG read; no artifact listing or filesystem scan is introduced.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Registration retains one controller callback and no independent image cache; controller and SDK artifact caps, release, and expiry apply unchanged.
 */
export function registerBlendiaMcpResources(
  server: McpServer,
  controller: BlendiaMcpController,
): void {
  const read: ReadResourceTemplateCallback = async (uri, variables) => {
    const sessionId: string | string[] = variables.sessionId;
    const artifactId: string | string[] = variables.artifactId;
    if (
      typeof sessionId !== "string" ||
      typeof artifactId !== "string" ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(sessionId) ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(artifactId)
    )
      throw new McpError(ErrorCode.InvalidParams, "Invalid artifact handle.");

    const handle: IBlenderArtifactHandle = { sessionId, artifactId };
    const result: Awaited<ReturnType<BlendiaMcpController["readImage"]>> =
      await controller.readImage(handle);
    if (!result.ok)
      throw new McpError(
        ErrorCode.InvalidRequest,
        `${result.error.code}: ${result.error.message}`,
        result.error,
      );

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: result.result.mimeType,
          blob: result.result.dataBase64,
        },
      ],
    };
  };

  server.registerResource(
    "render-artifact",
    new ResourceTemplate("blendia://artifact/{sessionId}/{artifactId}", {
      list: undefined,
    }),
    {
      title: "Owned Blender render PNG",
      description:
        "Read an observed successful render artifact, at most 1 MiB, before release or expiry.",
      mimeType: "image/png",
    },
    read,
  );
}
