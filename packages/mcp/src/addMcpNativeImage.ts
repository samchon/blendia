import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { Buffer } from "node:buffer";
import typia from "typia";

import type { IBlendiaMcpImageResult } from "./IBlendiaMcpImageResult";
import { MAX_MCP_IMAGE_BYTES } from "./MAX_MCP_IMAGE_BYTES";

/**
 * Add a native PNG block to the controller's validated image envelope.
 *
 * The declared structured result remains intact, including its base64 field, so
 * the generated output schema stays truthful. Only the dedicated image shape
 * is promoted; ordinary results, errors, and protocol messages pass unchanged.
 *
 * @evidence contracts/common.md#principled-implementation The dedicated typed image discriminator and canonical bounded base64 identify an owned PNG result; its existing structuredContent is never removed or rewritten.
 * @evidence contracts/common.md#clear-and-simple-design This pure outbound conversion owns image presentation only; typia retains argument/output validation and dispatch, and the controller owns artifact reads.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Only public JSON-RPC result data is converted; there are no private SDK hooks, replacement tool registries, filesystem reads, or client-specific branches.
 * @evidence contracts/common.md#meaningful-documentation The comment explains why base64 remains duplicated and which messages pass through without a native block.
 * @evidence contracts/performance.md#efficient-algorithms Base64 length is checked before decoding at most 1 MiB; conversion is linear in that bounded image size and copies only the content array and envelope.
 * @evidence contracts/performance.md#bound-retention-and-release-resources This function retains no messages or image cache; the caller's response owns the duplicate image representation until the transport completes sending it.
 */
export function addMcpNativeImage(message: JSONRPCMessage): JSONRPCMessage {
  if (!("result" in message) || message.result.isError === true) return message;

  const envelope: unknown = message.result.structuredContent;
  if (
    typeof envelope !== "object" ||
    envelope === null ||
    !("ok" in envelope) ||
    envelope.ok !== true ||
    !("result" in envelope)
  )
    return message;

  const image: unknown = envelope.result;
  if (!typia.is<IBlendiaMcpImageResult>(image)) return message;

  if (
    image.dataBase64.length > Math.ceil(MAX_MCP_IMAGE_BYTES / 3) * 4 ||
    image.artifact.bytes > MAX_MCP_IMAGE_BYTES
  )
    return message;

  const bytes: Buffer = Buffer.from(image.dataBase64, "base64");
  if (
    bytes.length !== image.artifact.bytes ||
    bytes.length > MAX_MCP_IMAGE_BYTES ||
    bytes.toString("base64") !== image.dataBase64
  )
    return message;

  const content: unknown[] = Array.isArray(message.result.content)
    ? message.result.content
    : [];
  return {
    ...message,
    result: {
      ...message.result,
      content: [
        ...content,
        { type: "image", data: image.dataBase64, mimeType: image.mimeType },
      ],
    },
  };
}
