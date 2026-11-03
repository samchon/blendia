import type { IBlendiaMcpScriptOptions } from "./IBlendiaMcpScriptOptions";

/** Project input for the privately configured owned Blender one-shot. */
export interface IBlendiaMcpHeadlessOptions extends IBlendiaMcpScriptOptions {
  /** Optional explicit input .blend; output files must be saved by the script. */
  blendFile?: string;
}
