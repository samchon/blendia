/**
 * Metadata observations, not proof that compilation, Go, networking, or native plugins work.
 */
export interface IProjectDoctorReport {
  /** Actual executable used by this Node process and the runtime launcher. */
  nodeExecutable: string;

  /** Actual process.version, without spawning another executable. */
  nodeVersion: string;

  /** Absolute validated project resolution directory. */
  cwd: string;

  /** Absolute explicitly requested tsconfig path, or null when discovery was delegated. */
  requestedProjectPath: string | null;

  /** Explicit config or nearest candidate path when found; never a claim that ttsx selected it. */
  tsconfigPath: string | null;

  /** Readability observation; semantic tsconfig/extends/plugin validation is not performed. */
  tsconfigStatus:
    | "explicit-readable"
    | "explicit-missing"
    | "explicit-unreadable"
    | "candidate-readable"
    | "candidate-unreadable"
    | "not-located";

  /** Public metadata resolved from the runtime's own ttsc dependency. */
  ttscPackagePath: string | null;

  /** Version read from that installed package's metadata. */
  ttscVersion: string | null;

  /** Resolved public bin.ttsx file, when declared by the runtime dependency. */
  ttsxPath: string | null;

  /** Whether that bin is a readable regular file, without executing it. */
  ttsxReadable: boolean;

  /** Project-context resolution of @blendia/sdk/package.json, or null if unavailable. */
  sdkPackagePath: string | null;

  /** Project-context resolution of typescript/package.json, or null if unavailable. */
  typescriptPackagePath: string | null;

  /** Version read from the project's resolved TypeScript metadata. */
  typescriptVersion: string | null;

  /** Fixed findings; no source execution, original exceptions, credentials, or environment dump. */
  issues: string[];

  /** Native setup, cold Go cache, network access, plugins, and actual execution remain unchecked. */
  execution: "not-tested";
}
