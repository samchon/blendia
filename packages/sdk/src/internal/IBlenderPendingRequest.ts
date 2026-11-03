import type { BlenderError } from "../BlenderError";

/**
 * One in-flight request retained by BlenderClient until a matching reply or terminal connection failure.
 */
export interface IBlenderPendingRequest {
  /** Positive decimal request correlation id. */
  id: string;

  /** Whether losing the response may hide scene changes. */
  mutation: boolean;

  /** Response timeout cleared on every settlement path. */
  timer: NodeJS.Timeout;

  /** Complete the active request with its validated envelope result. */
  resolve: (value: unknown) => void;

  /** Fail the active request with its reported or conservatively unknown effects. */
  reject: (error: BlenderError) => void;
}
