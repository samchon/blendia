import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { IProjectScriptResult } from "./IProjectScriptResult";
import type { ITextMacroOptions } from "./ITextMacroOptions";
import type { ITextMacroResult } from "./ITextMacroResult";
import { TEXT_MACRO_MAX_BYTES } from "./TEXT_MACRO_MAX_BYTES";
import { runProjectScript } from "./runProjectScript";

/**
 * Stage a Text snapshot beside its intended source and delegate to the existing project runner.
 *
 * The project supplies its native TypeScript compiler and imports. The sibling is the real module identity, so its filename and diagnostics differ from sourcePath. Original on-disk errors still participate in whole-project checking; this is not an unsaved-file overlay.
 *
 * @evidence contracts/common.md#principled-implementation Check bounded UTF-8 size, supported suffix, and lexical plus physical project containment before exclusive wx creation of a random sibling with unchanged text.
 * @evidence contracts/common.md#clear-and-simple-design The run-text CLI supplies a snapshot while runProjectScript retains all compiler, process, and connection handoff behavior; this function owns only staging and its reported disposition.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Existing source files and tsconfig are not overwritten; no custom compiler, import rewrite, skipped project check, or false cancellation substitutes for the real project.
 * @evidence contracts/common.md#meaningful-documentation The API distinguishes origin from compiler path and documents normal-exit cleanup, uncertain-termination retention, and the limits of sibling-module identity.
 */
export async function runTextMacro(
  options: ITextMacroOptions,
): Promise<ITextMacroResult> {
  if (options.cwd.trim().length === 0 || options.sourcePath.trim().length === 0)
    throw new Error(
      "blendia: Text macros require a project directory and source path.",
    );
  if (Buffer.byteLength(options.text, "utf8") > TEXT_MACRO_MAX_BYTES)
    throw new Error(
      `blendia: Text macro exceeds ${TEXT_MACRO_MAX_BYTES} UTF-8 bytes.`,
    );

  const cwd: string = path.resolve(options.cwd);
  const sourcePath: string = path.resolve(cwd, options.sourcePath);
  const extension: string = path.extname(sourcePath);
  if (
    ![".ts", ".tsx", ".mts", ".cts"].includes(extension) ||
    /\.d\.(?:ts|tsx|mts|cts)$/u.test(sourcePath)
  )
    throw new Error(
      "blendia: Text source path must name a non-declaration TypeScript module.",
    );

  const root: string = fs.realpathSync(cwd);
  const parent: string = fs.realpathSync(path.dirname(sourcePath));
  const relativePaths: string[] = [
    path.relative(cwd, sourcePath),
    path.relative(root, parent),
  ];
  if (
    relativePaths.some(
      (relative: string): boolean =>
        relative === ".." ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative),
    )
  )
    throw new Error(
      "blendia: Text source path must stay within its project directory.",
    );

  const origin: string = options.origin ?? sourcePath;
  const stagedPath: string = path.join(
    path.dirname(sourcePath),
    `blendia-macro-${randomUUID()}${extension}`,
  );
  const descriptor: number = fs.openSync(stagedPath, "wx", 0o600);
  let identity: fs.BigIntStats | undefined;
  const stagingErrors: string[] = [];
  let stagingCause: unknown;
  try {
    identity = fs.fstatSync(descriptor, { bigint: true });
    fs.writeFileSync(descriptor, options.text, "utf8");
  } catch (error) {
    stagingCause = error;
    stagingErrors.push(
      `write or identity: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    fs.closeSync(descriptor);
  } catch (error) {
    if (stagingErrors.length === 0) stagingCause = error;
    stagingErrors.push(
      `close: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (stagingErrors.length !== 0 || identity === undefined)
    throw new Error(
      `blendia: Text staging failed; owned file retained at ${JSON.stringify(stagedPath)}. ${stagingErrors.join(" ")}`,
      { cause: stagingCause },
    );

  let result: IProjectScriptResult;
  try {
    result = await runProjectScript({
      cwd,
      entry: stagedPath,
      project: options.project,
      args: options.args,
      connection: options.connection,
    });
  } catch (error) {
    throw new Error(
      `blendia: Text launcher failed; staging retained at ${JSON.stringify(stagedPath)}. ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  let cleanupError: string | undefined;
  if (result.signal !== null || result.code === null)
    cleanupError =
      "Launcher termination was abnormal; child execution may still be active.";
  else {
    try {
      const current: fs.BigIntStats | undefined = fs.lstatSync(stagedPath, {
        bigint: true,
        throwIfNoEntry: false,
      });
      if (current !== undefined) {
        if (
          !current.isFile() ||
          current.dev !== identity.dev ||
          current.ino !== identity.ino
        )
          cleanupError =
            "The staging path now identifies a different file; it was preserved.";
        else fs.unlinkSync(stagedPath);
      }
    } catch (error) {
      cleanupError = error instanceof Error ? error.message : String(error);
    }
  }
  return {
    ...result,
    sourcePath,
    stagedPath,
    origin,
    staging: cleanupError === undefined ? "removed" : "retained",
    cleanupError,
  };
}
