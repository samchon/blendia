import type { IBlendiaDoctorCommand } from "./IBlendiaDoctorCommand";
import type { IBlendiaHelpCommand } from "./IBlendiaHelpCommand";
import type { IBlendiaRunCommand } from "./IBlendiaRunCommand";
import type { IBlendiaSessionsCommand } from "./IBlendiaSessionsCommand";
import type { IBlendiaTextCommand } from "./IBlendiaTextCommand";

/**
 * Admitted terminal request, narrowed by kind into help, saved-file execution, or a Text snapshot.
 */
export type IBlendiaCommand =
  | IBlendiaHelpCommand
  | IBlendiaRunCommand
  | IBlendiaTextCommand
  | IBlendiaSessionsCommand
  | IBlendiaDoctorCommand;
