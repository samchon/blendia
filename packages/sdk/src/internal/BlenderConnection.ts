import { Socket } from "node:net";

import { BlenderError } from "../BlenderError";
import type { IBlenderConnectionOptions } from "../IBlenderConnectionOptions";
import type { IBlenderSession } from "../IBlenderSession";
import { BlenderFrameDecoder } from "./BlenderFrameDecoder";
import { BlenderProtocol } from "./BlenderProtocol";
import type { IBlenderPendingRequest } from "./IBlenderPendingRequest";
import type { IBlenderWireResponse } from "./IBlenderWireResponse";

/**
 * Exclusive async connection to one Blender bridge; every operation is explicit and mutations are never automatically replayed.
 *
 * @evidence contracts/common.md#principled-implementation A version-one authenticated handshake establishes session and generation; framed responses correlate one pending decimal request id before any typed result is returned.
 * @evidence contracts/common.md#clear-and-simple-design Socket ownership and request state live in this internal connection; Blender executes the bounded allowlist and the runtime owns project process launch.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Timeout or connection loss after a sent mutation is OUTCOME_UNKNOWN, never a fabricated rollback or retry.
 * @evidence contracts/common.md#meaningful-documentation The public client supplies method-specific result validators; disconnect releases ownership without cancelling native jobs or removing scene data.
 * @evidence contracts/performance.md#efficient-algorithms Incremental framing visits received bytes once and correlates exactly one pending request without scanning retained request history.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One socket, one decoder of at most 1MiB incomplete payload, and one request timeout are retained; disconnect and all terminal transport failures destroy the socket and reject pending work.
 */
export class BlenderConnection {
  /** Socket exclusively owned by this client. */
  private readonly socket: Socket;

  /** Incremental decoder owned for the socket's lifetime. */
  private readonly decoder: BlenderFrameDecoder = new BlenderFrameDecoder();

  /** Per-connection and per-response timeout in milliseconds. */
  private readonly timeoutMs: number;

  /** Authenticated identity; null exists only during the private handshake. */
  private identity: IBlenderSession | null = null;

  /** Monotonic per-connection request counter, without an idempotency promise. */
  private nextId: bigint = 0n;

  /** Terminal sockets cannot be reconnected or reused. */
  private closed: boolean = false;

  /** Exactly one pending response; concurrent calls fail before transmission. */
  private pending: IBlenderPendingRequest | null = null;

  /** Attach listeners before connecting so no socket failure is unobserved. */
  private constructor(socket: Socket, timeoutMs: number) {
    this.socket = socket;
    this.timeoutMs = timeoutMs;
    this.socket.on("data", (chunk: Buffer): void => this.receive(chunk));
    this.socket.on("error", (error: Error): void => {
      this.fail("CONNECTION_CLOSED", "Blender connection failed.", error);
    });
    this.socket.on("close", (): void => {
      this.fail("CONNECTION_CLOSED", "Blender connection closed.");
    });
  }

  /**
   * Authenticate a loopback connection using explicit credentials or BLENDIA_PORT and BLENDIA_TOKEN.
   *
   * @evidence contracts/common.md#principled-implementation Options are validated before a socket connects to 127.0.0.1; a hello request checks protocol one, returned identity, and advertised required methods.
   * @evidence contracts/common.md#clear-and-simple-design This factory returns only after authentication; callers cannot obtain a half-initialized client.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No endpoint guessing, dependency injection of a fake socket, or retry changes the target Blender.
   * @evidence contracts/common.md#meaningful-documentation The timeout applies independently to connecting and each response; it does not stop Blender execution.
   */
  public static async connect(
    options: IBlenderConnectionOptions = {},
  ): Promise<BlenderConnection> {
    if (
      options === null ||
      typeof options !== "object" ||
      Array.isArray(options)
    )
      throw new BlenderError(
        "INVALID_ARGUMENT",
        "Connection options must be an object.",
      );
    const portInput: unknown =
      options.port === undefined ? process.env.BLENDIA_PORT : options.port;
    const port: number =
      typeof portInput === "string" && /^[0-9]+$/.test(portInput)
        ? Number(portInput)
        : typeof portInput === "number"
          ? portInput
          : NaN;
    const token: unknown =
      options.token === undefined ? process.env.BLENDIA_TOKEN : options.token;
    const timeoutMs: number =
      options.timeoutMs === undefined ? 30000 : options.timeoutMs;
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new BlenderError(
        "INVALID_ARGUMENT",
        "Specify a TCP port from 1 through 65535 or set BLENDIA_PORT.",
      );
    if (typeof token !== "string" || token.length === 0)
      throw new BlenderError(
        "INVALID_ARGUMENT",
        "Specify the session token or set BLENDIA_TOKEN.",
      );
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2147483647)
      throw new BlenderError(
        "INVALID_ARGUMENT",
        "timeoutMs must be an integer from 1 through 2147483647.",
      );
    const socket: Socket = new Socket();
    const client: BlenderConnection = new BlenderConnection(socket, timeoutMs);
    try {
      const connection: Promise<void> = new Promise(
        (resolve: () => void, reject: (error: BlenderError) => void): void => {
          const timer: NodeJS.Timeout = setTimeout((): void => {
            socket.removeListener("error", onError);
            reject(
              new BlenderError("TIMEOUT", "Timed out connecting to Blender."),
            );
            socket.destroy();
          }, timeoutMs);

          /** Dispose of the connection timer when Node reports an error. */
          const onError: (error: Error) => void = (error: Error): void => {
            clearTimeout(timer);
            reject(
              new BlenderError(
                "CONNECTION_CLOSED",
                "Could not connect to Blender.",
                "none",
                { cause: error },
              ),
            );
          };
          socket.once("error", onError);
          socket.once("connect", (): void => {
            clearTimeout(timer);
            socket.removeListener("error", onError);
            resolve();
          });
          socket.connect({ host: "127.0.0.1", port });
        },
      );
      await connection;
      const result: unknown = await client.request(
        "hello",
        { protocolVersion: 1, token },
        false,
      );
      const session: IBlenderSession = BlenderProtocol.session(result);
      if (
        !["cube.create", "object.get", "object.setTransform"].every(
          (method: string): boolean => session.capabilities.includes(method),
        )
      )
        throw new BlenderError(
          "PROTOCOL_MISMATCH",
          "Blender bridge does not provide the required object methods.",
        );
      client.identity = session;
      return client;
    } catch (error) {
      client.fail("CONNECTION_CLOSED", "Blender handshake did not complete.");
      throw error;
    }
  }

  /** Copy authenticated identity so callers cannot mutate the client's generation or capability list. */
  public get session(): IBlenderSession {
    if (this.identity === null)
      throw new BlenderError(
        "CONNECTION_CLOSED",
        "Blender handshake has not completed.",
      );
    return { ...this.identity, capabilities: [...this.identity.capabilities] };
  }

  /**
   * Release this client's bridge ownership and always close its local socket after the disconnect attempt.
   *
   * @evidence contracts/common.md#principled-implementation A live idle client sends disconnect and waits for its correlated reply; already closed clients require no further transport work.
   * @evidence contracts/common.md#clear-and-simple-design Disconnect closes transport only and is separate from scene mutation or process termination.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An in-flight request causes BUSY rather than pretending its Blender operation has been cancelled.
   * @evidence contracts/common.md#meaningful-documentation Scene data remains in Blender, and closing the connection does not promise rollback.
   */
  public async disconnect(): Promise<void> {
    if (this.closed) return;
    if (this.pending !== null)
      throw new BlenderError(
        "BUSY",
        "Wait for the pending Blender operation before disconnecting.",
      );
    try {
      const result: unknown = await this.request("disconnect", {}, false);
      if (
        result === null ||
        typeof result !== "object" ||
        Array.isArray(result) ||
        Object.keys(result).length !== 0
      )
        throw new BlenderError(
          "INVALID_RESPONSE",
          "Disconnect response must be an empty object.",
        );
    } finally {
      this.fail("CONNECTION_CLOSED", "Blender client disconnected.");
    }
  }

  /** Execute one negotiated operation and reject malformed mutation readback as an unknown outcome. */
  public async execute<T>(
    method: string,
    params: unknown,
    mutation: boolean,
    decode: (value: unknown, session: IBlenderSession) => T,
  ): Promise<T> {
    if (!this.session.capabilities.includes(method))
      throw new BlenderError(
        "UNSUPPORTED",
        "The connected bridge does not advertise this method.",
      );
    const value: unknown = await this.request(method, params, mutation);
    try {
      return decode(value, this.session);
    } catch (error) {
      this.fail(
        "INVALID_RESPONSE",
        "Blender returned an invalid operation result.",
      );
      throw new BlenderError(
        mutation ? "OUTCOME_UNKNOWN" : "INVALID_RESPONSE",
        "Blender returned an invalid operation result.",
        mutation ? "possible" : "none",
        { cause: error },
      );
    }
  }

  /** Encode before writing and retain exactly one request; IDs correlate but never make retries safe. */
  private request(
    method: string,
    params: unknown,
    mutation: boolean,
  ): Promise<unknown> {
    if (this.closed)
      return Promise.reject(
        new BlenderError("CONNECTION_CLOSED", "Blender client is closed."),
      );
    if (this.pending !== null)
      return Promise.reject(
        new BlenderError("BUSY", "Only one Blender operation may be pending."),
      );
    const id: string = (++this.nextId).toString();
    if (id.length > 20)
      return Promise.reject(
        new BlenderError(
          "REQUEST_LIMIT",
          "Reconnect after exhausting the request identifier range.",
        ),
      );
    const frame: Buffer = BlenderFrameDecoder.encode({
      id,
      method,
      params,
      ...(this.identity === null
        ? {}
        : {
            sessionId: this.identity.sessionId,
            generation: this.identity.generation,
          }),
    });
    return new Promise<unknown>(
      (
        resolve: (value: unknown) => void,
        reject: (error: BlenderError) => void,
      ): void => {
        const timer: NodeJS.Timeout = setTimeout((): void => {
          this.fail("TIMEOUT", "Timed out waiting for the Blender operation.");
        }, this.timeoutMs);
        this.pending = { id, mutation, timer, resolve, reject };
        try {
          this.socket.write(frame);
        } catch (error) {
          this.fail(
            "CONNECTION_CLOSED",
            "Could not send the Blender operation.",
            error,
          );
        }
      },
    );
  }

  /** Validate complete messages and surface stale-generation server errors before invalidating the connection. */
  private receive(chunk: Buffer): void {
    try {
      for (const value of this.decoder.push(chunk)) {
        const response: IBlenderWireResponse = BlenderProtocol.response(value);
        const pending: typeof this.pending = this.pending;
        if (pending === null || response.id !== pending.id)
          throw new BlenderError(
            "INVALID_RESPONSE",
            "Blender response does not match the pending request.",
          );
        if (
          (this.identity !== null || response.ok) &&
          (typeof response.sessionId !== "string" ||
            typeof response.generation !== "number")
        )
          throw new BlenderError(
            "INVALID_RESPONSE",
            "Authenticated response is missing Blender identity.",
          );
        if (response.ok === false) {
          clearTimeout(pending.timer);
          this.pending = null;
          pending.reject(
            new BlenderError(
              response.error.code,
              response.error.message,
              response.error.effects,
            ),
          );
          if (
            this.identity !== null &&
            (response.sessionId !== this.identity.sessionId ||
              response.generation !== this.identity.generation)
          )
            this.fail("SESSION_CHANGED", "Blender data lifetime changed.");
          continue;
        }
        if (this.identity === null) {
          const session: IBlenderSession = BlenderProtocol.session(
            response.result,
          );
          if (
            session.sessionId !== response.sessionId ||
            session.generation !== response.generation
          )
            throw new BlenderError(
              "INVALID_RESPONSE",
              "Handshake identity differs from its response envelope.",
            );
        } else if (
          response.sessionId !== this.identity.sessionId ||
          response.generation !== this.identity.generation
        )
          throw new BlenderError(
            "INVALID_RESPONSE",
            "Blender data lifetime changed during the operation.",
          );
        clearTimeout(pending.timer);
        this.pending = null;
        pending.resolve(response.result);
      }
    } catch (error) {
      this.fail(
        error instanceof BlenderError ? error.code : "INVALID_RESPONSE",
        error instanceof BlenderError
          ? error.message
          : "Blender sent an invalid response.",
        error,
      );
    }
  }

  /** Terminal transport failure rejects pending work conservatively and releases all live transport resources. */
  private fail(code: string, message: string, cause?: unknown): void {
    this.closed = true;
    const pending: typeof this.pending = this.pending;
    this.pending = null;
    if (pending !== null) {
      clearTimeout(pending.timer);
      pending.reject(
        new BlenderError(
          pending.mutation ? "OUTCOME_UNKNOWN" : code,
          message,
          pending.mutation ? "possible" : "none",
          { cause },
        ),
      );
    }
    this.socket.destroy();
  }
}
