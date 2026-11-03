import type { IBlendiaHelpCommand } from "./IBlendiaHelpCommand";
import type { IBlendiaRunCommand } from "./IBlendiaRunCommand";

/**
 * Admitted terminal request, narrowed by kind into help or a runtime-owned run specification.
 */
export type IBlendiaCommand = IBlendiaHelpCommand | IBlendiaRunCommand;
