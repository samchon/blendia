import type { IBlendiaMcpFailure } from "./IBlendiaMcpFailure";
import type { IBlendiaMcpSuccess } from "./IBlendiaMcpSuccess";

/** All model tools preserve one generated success/failure output schema. */
export type IBlendiaMcpResult<T> = IBlendiaMcpSuccess<T> | IBlendiaMcpFailure;
