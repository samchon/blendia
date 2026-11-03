/** Explicit native prerequisites and invocation-owned output roots for engine scenarios. */
export interface IBlenderTestContext {
  /** Resolved actual Blender executable supplied by the operator or CI. */
  blenderExecutable: string;

  /** Actual ZIP-installed extension root verified once before any scenario; never a source fallback. */
  extensionDirectory: string;

  /** Existing source workspace containing this package's tsconfig and fixtures. */
  projectDirectory: string;

  /** Unique reserved directory whose explicit user outputs survive all native exits. */
  outputDirectory: string;

  /** Separate process-local TEMP/TMP/TMPDIR containing owned private runtime storage. */
  temporaryDirectory: string;
}
