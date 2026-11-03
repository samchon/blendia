import type { IBlendiaHelpCommand } from "./IBlendiaHelpCommand";
import type { IBlendiaRunCommand } from "./IBlendiaRunCommand";
import type { IBlendiaTextCommand } from "./IBlendiaTextCommand";

/**
 * Admitted terminal request, narrowed by kind into help, saved-file execution, or a Text snapshot.
 */
export type IBlendiaCommand =
  IBlendiaHelpCommand | IBlendiaRunCommand | IBlendiaTextCommand;
