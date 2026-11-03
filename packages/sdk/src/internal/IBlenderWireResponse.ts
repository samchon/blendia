import type { IBlenderWireFailureResponse } from "./IBlenderWireFailureResponse";
import type { IBlenderWireSuccessResponse } from "./IBlenderWireSuccessResponse";

/**
 * Validated version-one response envelope; unauthenticated errors may omit session identity.
 */
export type IBlenderWireResponse =
  IBlenderWireSuccessResponse | IBlenderWireFailureResponse;
