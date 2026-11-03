/** Private spawn data; never serialize environment or connection credentials. */
export interface IPreparedProjectLaunch {
  /** Current process.execPath, with no global executable lookup. */
  executable: string;
  /** Public launcher, optional project, original entry, and script arguments. */
  args: string[];
  /** Resolved real invocation directory. */
  cwd: string;
  /** Private inherited environment with optional child-only credential overrides. */
  env: NodeJS.ProcessEnv;
}
