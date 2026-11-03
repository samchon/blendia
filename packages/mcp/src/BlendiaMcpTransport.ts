import type {
  Transport,
  TransportSendOptions,
} from "@modelcontextprotocol/sdk/shared/transport.js";
import type {
  JSONRPCMessage,
  MessageExtraInfo,
} from "@modelcontextprotocol/sdk/types.js";

import type { BlendiaMcpImageDelivery } from "./BlendiaMcpImageDelivery";
import { addMcpNativeImage } from "./addMcpNativeImage";

/**
 * Preserve public transport behavior while delivering private PNG bytes once.
 *
 * Only the actual readImage request callback acquires an async correlation
 * scope. typia still validates and dispatches it; the original response ID and
 * metadata ticket must match before send can consume private native content.
 *
 * @evidence contracts/common.md#principled-implementation Public callback composition establishes an AsyncLocalStorage scope only for readImage calls; outbound native content requires the same response identity and one-time metadata ticket, while lifecycle and framing remain delegated.
 * @evidence contracts/common.md#clear-and-simple-design This adapter bridges private delivery ownership to the actual SDK transport without changing typia's registry or placing raw image bytes in a declared JSON result.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No private handler, runtime typia transform, global replacement, extra schema registry, or client-specific fallback is used.
 * @evidence contracts/common.md#meaningful-documentation The class identifies original-request correlation, native-only bytes, and the delegated lifecycle; callbacks remain public SDK-owned integration points.
 */
export class BlendiaMcpTransport implements Transport {
  /** Public SDK close callback; the underlying transport retains its own streams. */
  public onclose: Transport["onclose"] = undefined;

  /** Public out-of-band error callback; no protocol payload is logged here. */
  public onerror: Transport["onerror"] = undefined;

  /** Public SDK message callback; wrapper dispatch remains the SDK's responsibility. */
  public onmessage: Transport["onmessage"] = undefined;

  /** Stream owner supplied by the actual server consumer. */
  private readonly transport: Transport;

  /** Factory-owned bounded private image deliveries. */
  private readonly delivery: BlendiaMcpImageDelivery;

  /** Install public callback forwarding before the SDK starts the transport. */
  public constructor(transport: Transport, delivery: BlendiaMcpImageDelivery) {
    this.transport = transport;
    this.delivery = delivery;
    transport.onclose = (): void => {
      this.delivery.close();
      this.onclose?.();
    };
    transport.onerror = (error: Error): void => this.onerror?.(error);
    transport.onmessage = <T extends JSONRPCMessage>(
      message: T,
      extra?: MessageExtraInfo,
    ): void => {
      const forward: () => void = (): void => this.onmessage?.(message, extra);
      if (
        "id" in message &&
        "method" in message &&
        message.method === "tools/call" &&
        message.params?.name === "readImage"
      )
        this.delivery.runRequest(message.id, forward);
      else forward();
    };
  }

  /** Start only after the SDK installs callbacks on this wrapper. */
  public start(): Promise<void> {
    return this.transport.start();
  }

  /** Preserve routing and consume matching private bytes before the actual send. */
  public send(
    message: JSONRPCMessage,
    options?: TransportSendOptions,
  ): Promise<void> {
    return this.transport.send(
      addMcpNativeImage(message, this.delivery),
      options,
    );
  }

  /** Close the real stream owner; its callback retires pending image copies. */
  public close(): Promise<void> {
    return this.transport.close();
  }

  /** Preserve an optional transport session identity. */
  public get sessionId(): string | undefined {
    return this.transport.sessionId;
  }

  /** Delegate optional protocol-version negotiation to the stream owner. */
  public setProtocolVersion(version: string): void {
    this.transport.setProtocolVersion?.(version);
  }
}
