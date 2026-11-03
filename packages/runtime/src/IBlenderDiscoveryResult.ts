import type { IBlenderDiscoveredSession } from "./IBlenderDiscoveredSession";

/**
 * Bounded descriptor findings without credentials or an automatic connection claim.
 */
export interface IBlenderDiscoveryResult {
  /** Absolute explicitly selected directory. */
  directory: string;

  /** At most 32 accepted descriptors; each records whether a live probe occurred. */
  sessions: IBlenderDiscoveredSession[];

  /** Fixed diagnostic codes; raw file contents and foreign exceptions are never included. */
  issues: string[];

  /** Directory-entry or matching-descriptor scan budget was reached; more files may exist. */
  truncated: boolean;

  /** Explicit probing was requested but more than eight accepted descriptors were found. */
  probeTruncated: boolean;
}
