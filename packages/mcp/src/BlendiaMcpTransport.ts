import type {
  Transport,
  TransportSendOptions,
} from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

import { addMcpNativeImage } from "./addMcpNativeImage";

/**
 * Forward the public transport contract with one outbound image conversion.
 *
 * The SDK still owns callback installation, initialization, and framing. The
 * wrapped transport owns its streams and closes them through its public API.
 *
 * @evidence contracts/common.md#principled-implementation All lifecycle callbacks and protocol-version updates delegate to the supplied public Transport; only outbound validated image envelopes gain a content block.
 * @evidence contracts/common.md#clear-and-simple-design Composition at Transport.send leaves the typia tool registry untouched and works with the actual SDK stdio transport.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The adapter accesses no private SDK state and does not replace globals or register duplicate tool handlers.
 * @evidence contracts/common.md#meaningful-documentation The class documents stream ownership and the single presentation change while its accessors preserve SDK callback ownership.
 */
export class BlendiaMcpTransport implements Transport {
  /** Retain the supplied stream owner without starting or replacing it. */
  public constructor(private readonly transport: Transport) {}

  /** Start the wrapped stream after the SDK installs callbacks. */
  public start(): Promise<void> {
    return this.transport.start();
  }

  /** Preserve routing options and add native content without changing schemas. */
  public send(
    message: JSONRPCMessage,
    options?: TransportSendOptions,
  ): Promise<void> {
    return this.transport.send(addMcpNativeImage(message), options);
  }

  /** Release the wrapped transport's own resources. */
  public close(): Promise<void> {
    return this.transport.close();
  }

  /** Delegate close notification registration to the stream owner. */
  public get onclose(): Transport["onclose"] {
    return this.transport.onclose;
  }

  /** Install the SDK close callback on the actual stream owner. */
  public set onclose(callback: Transport["onclose"]) {
    this.transport.onclose = callback;
  }

  /** Delegate out-of-band error notification without logging payloads. */
  public get onerror(): Transport["onerror"] {
    return this.transport.onerror;
  }

  /** Install the SDK error callback without capturing protocol payloads. */
  public set onerror(callback: Transport["onerror"]) {
    this.transport.onerror = callback;
  }

  /** Allow the SDK to own inbound request callbacks on the wrapped transport. */
  public get onmessage(): Transport["onmessage"] {
    return this.transport.onmessage;
  }

  /** Install the SDK request callback without another inbound dispatcher. */
  public set onmessage(callback: Transport["onmessage"]) {
    this.transport.onmessage = callback;
  }

  /** Preserve an optional transport session identity. */
  public get sessionId(): string | undefined {
    return this.transport.sessionId;
  }

  /** Forward optional protocol-version negotiation when the transport supports it. */
  public setProtocolVersion(version: string): void {
    this.transport.setProtocolVersion?.(version);
  }
}
