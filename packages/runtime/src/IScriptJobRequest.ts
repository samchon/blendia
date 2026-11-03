import type { IScriptFileJobRequest } from "./IScriptFileJobRequest";
import type { IScriptTextJobRequest } from "./IScriptTextJobRequest";

/** The two supported inputs share execution and Text staging ownership. */
export type IScriptJobRequest = IScriptFileJobRequest | IScriptTextJobRequest;
