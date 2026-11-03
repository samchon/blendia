/** Publish a persistent result at an explicit user destination. */
export interface IBlenderSaveOptions {
  /** Absolute .png or .blend destination with an existing parent; no extension is appended. */
  path: string;

  /** Default false uses atomic no-replace publication; true explicitly permits replacement. */
  overwrite?: boolean;
}
