/**
 * Inspect the current launcher and a project's resolution context without running it.
 */
export interface IProjectDoctorOptions {
  /** Existing invocation directory; defaults to process.cwd(). */
  cwd?: string;

  /** Explicit tsconfig path relative to cwd; omission reports the nearest candidate and its readability. */
  project?: string;
}
