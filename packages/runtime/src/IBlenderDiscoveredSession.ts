/**
 * Sanitized descriptor metadata and, only when requested, a separate live observation.
 *
 * A valid descriptor is not proof of a currently running Blender. The session token is deliberately absent.
 */
export interface IBlenderDiscoveredSession {
  /** Absolute path to the inspected regular descriptor file. */
  descriptorPath: string;

  /** Supported descriptor and bridge protocol. */
  protocolVersion: 1;

  /** The only supported bridge address; no DNS or remote host is contacted. */
  host: "127.0.0.1";

  /** Validated TCP port from 1 through 65535. */
  port: number;

  /** Identity claimed by the descriptor and checked against hello when probing. */
  sessionId: string;

  /** Descriptor presence and optional live outcome remain distinct. */
  probeStatus:
    | "not-requested"
    | "live"
    | "busy"
    | "unreachable"
    | "rejected"
    | "identity-mismatch";

  /** Version from a successful identity-matching hello; otherwise null. */
  blenderVersion: string | null;

  /** Data lifetime from a successful identity-matching hello; otherwise null. */
  generation: number | null;

  /** Fixed sanitized probe category, never a foreign error message or stack. */
  probeCode: string | null;
}
