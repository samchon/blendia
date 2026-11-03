import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TextDecoder } from "node:util";

import type { IHeadlessBootstrapConfig } from "./IHeadlessBootstrapConfig";
import type { IHeadlessReady } from "./IHeadlessReady";

/** Runtime-owned bootstrap files; explicit user outputs never participate in cleanup. */
export class HeadlessWorkspace {
  /** Unique directory reserved by mkdtemp, never supplied by a user as a cleanup target. */
  public readonly directory: string = fs.mkdtempSync(
    path.join(os.tmpdir(), "blendia-headless-"),
  );
  /** Private configuration filepath passed as data, with no credentials in argv. */
  public readonly configPath: string = path.join(this.directory, "config.json");
  /** Atomically published private readiness file; creation belongs to this invocation's bootstrap. */
  private readonly readyPath: string = path.join(this.directory, "ready.json");
  /** One fresh ownership identity shared by config, readiness and control. */
  public readonly runId: string = randomUUID();
  /** Invocation secret, known before native output capture begins. */
  public readonly token: string = randomBytes(32).toString("base64url");
  /** Original config identity; never unlink a replaced credential path. */
  private configIdentity: fs.BigIntStats | undefined;
  /** Original admitted readiness identity, captured only after full schema/secret validation. */
  private readyIdentity: fs.BigIntStats | undefined;

  /** Write one exclusive private config and preserve ownership even if writing fails. */
  public writeConfig(attachTimeoutMs: number): void {
    fs.chmodSync(this.directory, 0o700);
    const config: IHeadlessBootstrapConfig = {
      protocolVersion: 1,
      runId: this.runId,
      readyPath: this.readyPath,
      controlToken: this.token,
      attachTimeoutMs,
    };
    const serialized: string = JSON.stringify(config);
    if (Buffer.byteLength(serialized, "utf8") > 16384)
      throw new Error("blendia: private headless configuration is too large.");
    const descriptor: number = fs.openSync(this.configPath, "wx", 0o600);
    try {
      this.configIdentity = fs.fstatSync(descriptor, { bigint: true });
      fs.writeFileSync(descriptor, serialized, "utf8");
    } finally {
      fs.closeSync(descriptor);
    }
  }

  /** Read only a matching regular bounded file; absence is still-starting rather than proof of failure. */
  public readReady(): IHeadlessReady | undefined {
    const identity: fs.BigIntStats | undefined = fs.lstatSync(this.readyPath, {
      bigint: true,
      throwIfNoEntry: false,
    });
    if (identity === undefined) return undefined;
    if (!identity.isFile() || identity.size > 16384n)
      throw new Error(
        "blendia: headless readiness is not a bounded regular file.",
      );
    const descriptor: number = fs.openSync(
      this.readyPath,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0),
    );
    let value: unknown;
    try {
      const opened: fs.BigIntStats = fs.fstatSync(descriptor, { bigint: true });
      if (
        !opened.isFile() ||
        opened.dev !== identity.dev ||
        opened.ino !== identity.ino ||
        opened.size > 16384n
      )
        throw new Error("blendia: headless readiness identity changed.");
      const bytes: Buffer = Buffer.alloc(16385);
      let length: number = 0;
      while (length < bytes.length) {
        const count: number = fs.readSync(
          descriptor,
          bytes,
          length,
          bytes.length - length,
          null,
        );
        if (count === 0) break;
        length += count;
      }
      if (length > 16384)
        throw new Error("blendia: headless readiness is too large.");
      value = JSON.parse(
        new TextDecoder("utf8", { fatal: true }).decode(
          bytes.subarray(0, length),
        ),
      );
    } finally {
      fs.closeSync(descriptor);
    }
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value) ||
      Object.keys(value).length !== 7 ||
      !("protocolVersion" in value) ||
      value.protocolVersion !== 1 ||
      !("runId" in value) ||
      value.runId !== this.runId ||
      !("host" in value) ||
      value.host !== "127.0.0.1" ||
      !("port" in value) ||
      typeof value.port !== "number" ||
      !Number.isInteger(value.port) ||
      value.port < 1 ||
      value.port > 65535 ||
      !("controlPort" in value) ||
      typeof value.controlPort !== "number" ||
      !Number.isInteger(value.controlPort) ||
      value.controlPort < 1 ||
      value.controlPort > 65535 ||
      value.controlPort === value.port ||
      !("token" in value) ||
      value.token !== this.token ||
      !("sessionId" in value) ||
      typeof value.sessionId !== "string" ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(value.sessionId)
    )
      throw new Error(
        "blendia: headless readiness does not match this invocation.",
      );
    this.readyIdentity = identity;
    return {
      protocolVersion: 1,
      runId: this.runId,
      host: "127.0.0.1",
      port: value.port,
      token: this.token,
      sessionId: value.sessionId,
      controlPort: value.controlPort,
    };
  }

  /** Remove only the admitted unchanged files, then the empty owned directory; never recurse. */
  public cleanup(): void {
    this.removeOwned(this.configPath, this.configIdentity);
    this.removeOwned(this.readyPath, this.readyIdentity);
    fs.rmdirSync(this.directory);
  }

  /** Full-width dev/ino checks preserve any path replaced while Blender was running. */
  private removeOwned(
    file: string,
    identity: fs.BigIntStats | undefined,
  ): void {
    const current: fs.BigIntStats | undefined = fs.lstatSync(file, {
      bigint: true,
      throwIfNoEntry: false,
    });
    if (current === undefined) return;
    if (
      identity === undefined ||
      !current.isFile() ||
      current.dev !== identity.dev ||
      current.ino !== identity.ino
    )
      throw new Error(
        "blendia: private headless path identity changed; retained for inspection.",
      );
    fs.unlinkSync(file);
  }
}
