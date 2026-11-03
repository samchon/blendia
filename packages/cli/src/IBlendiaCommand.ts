import type { IProjectScriptOptions } from "@blendia/runtime";

/**
 * Admitted terminal request; script arguments are contained in the run options.
 *
 * @evidence contracts/common.md#principled-implementation The discriminant separates terminal help from a run that has a required entry and runtime-owned options.
 * @evidence contracts/common.md#clear-and-simple-design parseBlendiaCommand produces this record and the executable consumes it without another argument parser.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No fake command, implicit Blender connection, or test-only branch is represented.
 * @evidence contracts/common.md#meaningful-documentation The run branch reuses the runtime contract instead of introducing a parallel launch specification.
 * @evidence contracts/performance.md#efficient-algorithms This union stores one small help value or the caller's admitted run data.
 * @evidence contracts/performance.md#reuse-equivalent-work Commands are independent user requests and are not cached.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The record owns no external resources and remains reachable only through its consumer.
 */
export type IBlendiaCommand =
  | {
      /** Render the supported command grammar. */
      kind: "help";
    }
  | {
      /** Execute one real project entry. */
      kind: "run";

      /** Paths and script arguments admitted before launching the runtime. */
      options: IProjectScriptOptions;
    };
