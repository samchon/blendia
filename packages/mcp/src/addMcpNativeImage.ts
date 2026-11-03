import type {
  ImageContent,
  JSONRPCMessage,
} from "@modelcontextprotocol/sdk/types.js";

import type { BlendiaMcpImageDelivery } from "./BlendiaMcpImageDelivery";

/**
 * Add one private PNG to its original response without changing public metadata.
 *
 * @evidence contracts/common.md#principled-implementation Only a successful metadata image envelope can consume its one-time ticket with the original JSON-RPC response ID; the generated structuredContent remains untouched and contains no image bytes.
 * @evidence contracts/common.md#clear-and-simple-design The controller owns typed metadata and the private delivery owner supplies native bytes; this boundary only composes the public MCP image block.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No typia runtime transform call, schema-field deletion, JSON base64 duplication, arbitrary file read, or private SDK hook participates in presentation.
 * @evidence contracts/common.md#meaningful-documentation The function distinguishes declared metadata from the private one-time native payload and preserves unrelated protocol messages and errors.
 * @evidence contracts/performance.md#efficient-algorithms Metadata guards and bounded delivery lookup avoid decoding an image again; the content array is copied once while the existing base64 string is reused only by native content.
 * @evidence contracts/performance.md#bound-retention-and-release-resources A matched delivery is removed before send; this function retains no cache or retry copy, and unmatched or expired tickets supply no bytes.
 */
export function addMcpNativeImage(
  message: JSONRPCMessage,
  delivery: BlendiaMcpImageDelivery,
): JSONRPCMessage {
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

  const metadata: unknown = envelope.result;
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    !("kind" in metadata) ||
    metadata.kind !== "image" ||
    !("deliveryId" in metadata) ||
    typeof metadata.deliveryId !== "string"
  )
    return message;

  const image: ImageContent | undefined = delivery.take(
    metadata.deliveryId,
    metadata,
    message.id,
  );
  if (image === undefined) return message;

  const content: unknown[] = Array.isArray(message.result.content)
    ? message.result.content
    : [];
  return {
    ...message,
    result: { ...message.result, content: [...content, image] },
  };
}
