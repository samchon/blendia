import { once } from "node:events";
import { Socket } from "node:net";
import { TextDecoder } from "node:util";

import type { IHeadlessControlPending } from "./IHeadlessControlPending";
import type { IHeadlessControlReply } from "./IHeadlessControlReply";
import type { IHeadlessControlRequest } from "./IHeadlessControlRequest";

/** Private lifetime socket; it never authenticates as the scene bridge's SDK writer. */
export class HeadlessControl {
  /** Only this instance owns the control socket, and closure is a cooperative EOF request. */
  private readonly socket: Socket = new Socket();
  /** At most one 4096-byte payload plus its length header is retained. */
  private input: Buffer = Buffer.alloc(0);
  /** Single correlated acknowledgment, with a bounded timer. */
  private pending: IHeadlessControlPending | undefined;
  /** A failed socket is never reconnected or used to replay a request. */
  private closed: boolean = false;

  /** Install observers before connecting so failures never become unhandled socket events. */
  private constructor(
    private readonly runId: string,
    private readonly token: string,
  ) {
    this.socket.on("data", (bytes: Buffer): void => this.receive(bytes));
    this.socket.on("error", (): void => this.fail());
    this.socket.on("close", (): void => this.fail());
  }

  /** Connect once and prove the owned main-thread pump acknowledged this invocation. */
  public static async attach(
    port: number,
    runId: string,
    token: string,
    timeoutMs: number,
  ): Promise<HeadlessControl> {
    const control: HeadlessControl = new HeadlessControl(runId, token);
    const deadline: number = performance.now() + timeoutMs;
    const connected: Promise<unknown[]> = once(control.socket, "connect", {
      signal: AbortSignal.timeout(timeoutMs),
    });
    try {
      control.socket.connect(port, "127.0.0.1");
      await connected;
      await control.request(
        "attach",
        Math.max(1, Math.ceil(deadline - performance.now())),
      );
      return control;
    } catch {
      // A synchronous connect failure can precede awaiting the already-created event promise.
      void connected.catch((): undefined => undefined);
      control.close();
      throw new Error(
        "blendia: owned headless control attachment was not observed.",
      );
    }
  }

  /** Acknowledgment only requests bootstrap return; callers must still observe Blender exit/EOF. */
  public async finish(timeoutMs: number): Promise<void> {
    await this.request("finish", timeoutMs);
  }

  /** Disconnect only this private control owner; never send a process signal. */
  public close(): void {
    this.fail();
  }

  /** Admit one request and validate its bounded reply without exposing secrets. */
  private async request(
    method: "attach" | "finish",
    timeoutMs: number,
  ): Promise<IHeadlessControlReply> {
    if (this.closed || this.pending !== undefined)
      throw new Error("blendia: private headless control is unavailable.");
    const request: IHeadlessControlRequest = {
      protocolVersion: 1,
      runId: this.runId,
      token: this.token,
      method,
    };
    const payload: Buffer = Buffer.from(JSON.stringify(request), "utf8");
    if (payload.length > 4096)
      throw new Error(
        "blendia: private headless control request is too large.",
      );
    const header: Buffer = Buffer.alloc(4);
    header.writeUInt32BE(payload.length);
    return new Promise<IHeadlessControlReply>(
      (
        resolve: (reply: IHeadlessControlReply) => void,
        reject: (error: Error) => void,
      ): void => {
        this.pending = {
          phase: method === "attach" ? "attached" : "finishing",
          resolve,
          reject,
          timer: setTimeout((): void => this.fail(), timeoutMs),
        };
        this.socket.write(Buffer.concat([header, payload]));
      },
    );
  }

  /** Refuse malformed, oversized, duplicate or uncorrelated replies as unknown observation. */
  private receive(bytes: Buffer): void {
    if (this.closed) return;
    if (this.input.length + bytes.length > 4100) {
      this.fail();
      return;
    }
    this.input = Buffer.concat([this.input, bytes]);
    if (this.input.length < 4) return;
    const length: number = this.input.readUInt32BE(0);
    if (length === 0 || length > 4096) {
      this.fail();
      return;
    }
    if (this.input.length < length + 4) return;
    if (this.input.length !== length + 4 || this.pending === undefined) {
      this.fail();
      return;
    }
    let value: unknown;
    try {
      value = JSON.parse(
        new TextDecoder("utf8", { fatal: true }).decode(this.input.subarray(4)),
      );
    } catch {
      this.fail();
      return;
    }
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value) ||
      Object.keys(value).length !== 4 ||
      !("protocolVersion" in value) ||
      value.protocolVersion !== 1 ||
      !("runId" in value) ||
      value.runId !== this.runId ||
      !("ok" in value) ||
      value.ok !== true ||
      !("phase" in value) ||
      value.phase !== this.pending.phase
    ) {
      this.fail();
      return;
    }
    const pending: IHeadlessControlPending = this.pending;
    this.pending = undefined;
    this.input = Buffer.alloc(0);
    clearTimeout(pending.timer);
    pending.resolve({
      protocolVersion: 1,
      runId: this.runId,
      ok: true,
      phase: pending.phase,
    });
  }

  /** Release timer/socket and settle the one waiter with a fixed sanitized finding. */
  private fail(): void {
    if (this.closed) return;
    this.closed = true;
    const pending: IHeadlessControlPending | undefined = this.pending;
    this.pending = undefined;
    if (pending !== undefined) {
      clearTimeout(pending.timer);
      pending.reject(
        new Error("blendia: private headless control observation was lost."),
      );
    }
    this.input = Buffer.alloc(0);
    this.socket.destroy();
  }
}
