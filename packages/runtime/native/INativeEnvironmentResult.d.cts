/** Environment admitted before a public ttsc/ttsx process starts. */
export interface INativeEnvironmentResult {
  /** A copy; the supplied environment is never modified. */
  environment: NodeJS.ProcessEnv;

  /** Automatically created physical root, retained for possible descendants. */
  directory?: string;

  /** Uncertain check allocations that were deliberately left untouched. */
  retainedDirectories: string[];
}
