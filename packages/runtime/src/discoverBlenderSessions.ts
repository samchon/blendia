import { BlenderClient, BlenderError } from "@blendia/sdk";
import type { IBlenderSession } from "@blendia/sdk";
import { constants } from "node:fs";
import type { Dir, Dirent, Stats } from "node:fs";
import { lstat, open, opendir } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";

import type { IBlenderDiscoveredSession } from "./IBlenderDiscoveredSession";
import type { IBlenderDiscoveryOptions } from "./IBlenderDiscoveryOptions";
import type { IBlenderDiscoveryResult } from "./IBlenderDiscoveryResult";

/**
 * Read bounded session descriptors from one explicit directory and optionally observe their live bridges.
 *
 * At most 256 directory entries and 32 matching regular descriptors are inspected. A file contributes at most 16 KiB; links and nonregular credential inputs are skipped. Scan-budget exhaustion and the separate eight-probe budget have distinct flags. No directory is discovered implicitly or recursively.
 *
 * A probe performs SDK hello and finally disconnect, briefly reserving an idle owner. BUSY is reported without retry, takeover, or any scene command. Public findings contain no token, raw descriptor, foreign error text, or exception cause.
 *
 * @evidence contracts/common.md#principled-implementation Validate descriptor identity, protocol, exact loopback host, port, and bounded ASCII credential before constructing sanitized metadata; open-file identity and regular-file checks constrain credential inputs.
 * @evidence contracts/common.md#clear-and-simple-design Descriptor acquisition closes its file and directory handles before optional network observations; private credentials are kept separately from the sanitized public records.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Default discovery makes no SDK call; explicit probes reuse BlenderClient and preserve BUSY without opening another command path or replaying a request.
 * @evidence contracts/common.md#meaningful-documentation Descriptor presence, matching live hello, scan truncation, and probe-budget truncation are different observations, and neither discovery nor doctor proves native execution readiness.
 * @evidence contracts/performance.md#efficient-algorithms One nonrecursive scan stops at 256 entries or 32 matching descriptors, opens each candidate once for a bounded read, and performs at most eight sequential probes without rescanning or running native checks.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One directory and one descriptor handle are open at a time; each descriptor read is capped at 16385 bytes to reject growth past 16 KiB, public results contain at most 32 sessions, and each of at most eight probes releases its SDK connection in finally.
 */
export async function discoverBlenderSessions(
  options: IBlenderDiscoveryOptions,
): Promise<IBlenderDiscoveryResult> {
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options) ||
    typeof options.directory !== "string" ||
    options.directory.length === 0 ||
    options.directory.includes("\0") ||
    (options.probe !== undefined && typeof options.probe !== "boolean")
  )
    throw new Error(
      "blendia: discovery requires an explicit directory and valid options.",
    );
  const timeoutMs: number =
    options.probeTimeoutMs === undefined ? 1000 : options.probeTimeoutMs;
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 100 ||
    timeoutMs > 5000 ||
    (options.probeTimeoutMs !== undefined && options.probe !== true)
  )
    throw new Error(
      "blendia: probeTimeoutMs requires probe and must be an integer from 100 through 5000.",
    );
  const result: IBlenderDiscoveryResult = {
    directory: path.resolve(options.directory),
    sessions: [],
    issues: [],
    truncated: false,
    probeTruncated: false,
  };
  let directory: Dir;
  try {
    directory = await opendir(result.directory);
  } catch {
    throw new Error(
      "blendia: the explicit descriptor directory could not be opened.",
    );
  }
  let scanned: number = 0;
  let descriptors: number = 0;
  const credentials: Map<IBlenderDiscoveredSession, string> = new Map();
  let ended: boolean = false;
  try {
    while (scanned < 256 && descriptors < 32) {
      const entry: Dirent | null = await directory.read();
      if (entry === null) {
        ended = true;
        break;
      }
      scanned++;
      if (!/^session-.*\.json$/.test(entry.name)) continue;
      descriptors++;
      const descriptorPath: string = path.join(result.directory, entry.name);
      let handle: FileHandle | null = null;
      let record: Record<string, unknown>;
      try {
        const before: Stats = await lstat(descriptorPath);
        if (before.isSymbolicLink() || !before.isFile()) {
          result.issues.push("DESCRIPTOR_NOT_REGULAR");
          continue;
        }
        handle = await open(
          descriptorPath,
          constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
        );
        const current: Stats = await handle.stat();
        if (
          !current.isFile() ||
          current.dev !== before.dev ||
          current.ino !== before.ino
        ) {
          result.issues.push("DESCRIPTOR_CHANGED");
          continue;
        }
        if (current.size > 16384) {
          result.issues.push("DESCRIPTOR_TOO_LARGE");
          continue;
        }
        const bytes: Buffer = Buffer.alloc(16385);
        let used: number = 0;
        while (used < bytes.length) {
          const count: number = (
            await handle.read(bytes, used, bytes.length - used, null)
          ).bytesRead;
          if (count === 0) break;
          used += count;
        }
        if (used > 16384) {
          result.issues.push("DESCRIPTOR_TOO_LARGE");
          continue;
        }
        const value: unknown = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(
            bytes.subarray(0, used),
          ),
        );
        if (
          value === null ||
          typeof value !== "object" ||
          Array.isArray(value)
        ) {
          result.issues.push("DESCRIPTOR_INVALID");
          continue;
        }
        record = value as Record<string, unknown>;
      } catch {
        result.issues.push("DESCRIPTOR_UNREADABLE_OR_INVALID");
        continue;
      } finally {
        if (handle !== null) {
          try {
            await handle.close();
          } catch {
            result.issues.push("DESCRIPTOR_CLOSE_FAILED");
          }
        }
      }
      if (
        record.protocolVersion !== 1 ||
        record.host !== "127.0.0.1" ||
        typeof record.port !== "number" ||
        !Number.isInteger(record.port) ||
        record.port < 1 ||
        record.port > 65535 ||
        typeof record.sessionId !== "string" ||
        record.sessionId.length === 0 ||
        record.sessionId.length > 128 ||
        typeof record.token !== "string" ||
        record.token.length === 0 ||
        record.token.length > 512 ||
        !/^[\x21-\x7e]+$/.test(record.token)
      ) {
        result.issues.push("DESCRIPTOR_UNSUPPORTED_OR_INVALID");
        continue;
      }
      const token: string = record.token;

      const session: IBlenderDiscoveredSession = {
        descriptorPath,
        protocolVersion: 1,
        host: "127.0.0.1",
        port: record.port,
        sessionId: record.sessionId,
        probeStatus: "not-requested",
        blenderVersion: null,
        generation: null,
        probeCode: null,
      };
      result.sessions.push(session);
      credentials.set(session, token);
    }
    result.truncated = !ended;
  } catch {
    result.issues.push("DIRECTORY_READ_FAILED");
    result.truncated = true;
  } finally {
    try {
      await directory.close();
    } catch {
      result.issues.push("DIRECTORY_CLOSE_FAILED");
    }
  }
  const tokens: string[] = [...credentials.values()];
  if (tokens.some((token: string): boolean => result.directory.includes(token)))
    throw new Error(
      "blendia: a descriptor credential occurs in the selected directory metadata.",
    );
  result.sessions = result.sessions.filter(
    (session: IBlenderDiscoveredSession): boolean => {
      if (
        tokens.some(
          (token: string): boolean =>
            session.descriptorPath.includes(token) ||
            session.sessionId.includes(token),
        )
      ) {
        credentials.delete(session);
        result.issues.push("DESCRIPTOR_METADATA_CONTAINS_CREDENTIAL");
        return false;
      }
      return true;
    },
  );
  if (options.probe === true) {
    result.probeTruncated = result.sessions.length > 8;
    for (const session of result.sessions.slice(0, 8)) {
      const token: string | undefined = credentials.get(session);
      if (token === undefined) {
        result.issues.push("PROBE_CREDENTIAL_UNAVAILABLE");
        continue;
      }
      let client: BlenderClient | null = null;
      try {
        client = await BlenderClient.connect({
          port: session.port,
          token,
          timeoutMs,
        });
        const live: IBlenderSession = client.session;
        if (live.sessionId !== session.sessionId) {
          session.probeStatus = "identity-mismatch";
          session.probeCode = "SESSION_MISMATCH";
        } else {
          session.probeStatus = "live";
          session.generation = live.generation;
          session.blenderVersion =
            live.blenderVersion.length <= 256 &&
            !tokens.some((secret: string): boolean =>
              live.blenderVersion.includes(secret),
            )
              ? live.blenderVersion
              : null;
          if (session.blenderVersion === null)
            result.issues.push("PROBE_METADATA_UNAVAILABLE");
        }
      } catch (error) {
        const code: string =
          error instanceof BlenderError ? error.code : "PROBE_FAILED";
        switch (code) {
          case "BUSY":
            session.probeStatus = "busy";
            session.probeCode = "BUSY";
            break;
          case "TIMEOUT":
          case "CONNECTION_CLOSED":
            session.probeStatus = "unreachable";
            session.probeCode = code;
            break;
          case "UNAUTHORIZED":
          case "PROTOCOL_MISMATCH":
          case "INVALID_RESPONSE":
          case "INVALID_FRAME":
            session.probeStatus = "rejected";
            session.probeCode = code;
            break;
          default:
            session.probeStatus = "rejected";
            session.probeCode = "PROBE_FAILED";
        }
      } finally {
        if (client !== null) {
          try {
            await client.disconnect();
          } catch {
            session.probeCode ??= "DISCONNECT_FAILED";
            result.issues.push("PROBE_DISCONNECT_FAILED");
          }
        }
      }
    }
  }
  credentials.clear();
  return result;
}
