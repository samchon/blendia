import type { INativeEnvironmentResult } from "./INativeEnvironmentResult.cjs";

/** Preserve healthy settings or select verified private storage without changing the caller. */
export function prepareNativeEnvironment(
  environment?: NodeJS.ProcessEnv,
): INativeEnvironmentResult;
