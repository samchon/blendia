/** Native render identity recoverable after explicit reconnect to the same bridge. */
export interface IBlenderRenderHandle {
  /** Bridge owning the native job, independent of data generation. */
  sessionId: string;

  /** Caller-known UUID supplied to startRender. */
  renderId: string;
}
