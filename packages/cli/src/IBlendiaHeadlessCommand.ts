import type { IHeadlessProjectOptions } from "@blendia/runtime";

/** One foreground script against a newly owned background Blender, with bounded captured result JSON. */
export interface IBlendiaHeadlessCommand {
  /** Select fresh owned one-shot execution, not an existing GUI bridge. */
  kind: "headless";

  /** Explicit Blender/extension paths and the original project entry/context. */
  options: IHeadlessProjectOptions;
}
