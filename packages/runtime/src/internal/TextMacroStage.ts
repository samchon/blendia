import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { IProjectScriptResult } from "../IProjectScriptResult";
import type { ITextMacroOptions } from "../ITextMacroOptions";
import type { ITextMacroResult } from "../ITextMacroResult";
import { TEXT_MACRO_MAX_BYTES } from "../TEXT_MACRO_MAX_BYTES";
import { TextMacroStageError } from "./TextMacroStageError";

/** Single owner of exclusive sibling creation and full-width filesystem-identity cleanup. */
export class TextMacroStage {
  /** Keep full original paths and filesystem identity private from bounded display projections. */
  private constructor(
    public readonly cwd: string,
    public readonly sourcePath: string,
    public readonly stagedPath: string,
    public readonly origin: string,
    private readonly identity: fs.BigIntStats,
  ) {}

  /** Refuse escapes and unsupported modules before exclusive creation; retained write failures report ownership. */
  public static create(options: ITextMacroOptions): TextMacroStage {
    if (
      options.cwd.trim().length === 0 ||
      options.sourcePath.trim().length === 0
    )
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
    if (
      [path.relative(cwd, sourcePath), path.relative(root, parent)].some(
        (relative: string): boolean =>
          relative === ".." ||
          relative.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relative),
      )
    )
      throw new Error(
        "blendia: Text source path must stay within its project directory.",
      );
    const stagedPath: string = path.join(
      path.dirname(sourcePath),
      `blendia-macro-${randomUUID()}${extension}`,
    );
    const descriptor: number = fs.openSync(stagedPath, "wx", 0o600);
    let identity: fs.BigIntStats | undefined;
    const errors: string[] = [];
    try {
      identity = fs.fstatSync(descriptor, { bigint: true });
      fs.writeFileSync(descriptor, options.text, "utf8");
    } catch (error) {
      errors.push(
        `write or identity: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    try {
      fs.closeSync(descriptor);
    } catch (error) {
      errors.push(
        `close: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (errors.length !== 0 || identity === undefined)
      throw new TextMacroStageError(
        `blendia: Text staging failed; owned file retained at ${JSON.stringify(stagedPath)}. ${errors.join(" ")}`,
        {
          code: null,
          signal: null,
          sourcePath,
          stagedPath,
          origin: options.origin ?? sourcePath,
          staging: "retained",
          cleanupError:
            "Exclusive staging write, identity read or close failed; owned path was retained.",
        },
      );
    return new TextMacroStage(
      cwd,
      sourcePath,
      stagedPath,
      options.origin ?? sourcePath,
      identity,
    );
  }

  /** Only a fully observed ordinary exit authorizes removing this same owned file. */
  public finish(
    result: IProjectScriptResult,
    certain: boolean,
  ): ITextMacroResult {
    let cleanupError: string | undefined;
    if (!certain || result.signal !== null || result.code === null)
      cleanupError =
        "Launcher termination was uncertain; staging was retained and child execution may still be active.";
    else {
      try {
        const current: fs.BigIntStats | undefined = fs.lstatSync(
          this.stagedPath,
          { bigint: true, throwIfNoEntry: false },
        );
        if (current !== undefined) {
          if (
            !current.isFile() ||
            current.dev !== this.identity.dev ||
            current.ino !== this.identity.ino
          )
            cleanupError =
              "The staging path now identifies a different file; it was preserved.";
          else fs.unlinkSync(this.stagedPath);
        }
      } catch (error) {
        cleanupError = error instanceof Error ? error.message : String(error);
      }
    }
    return {
      ...result,
      sourcePath: this.sourcePath,
      stagedPath: this.stagedPath,
      origin: this.origin,
      staging: cleanupError === undefined ? "removed" : "retained",
      cleanupError,
    };
  }
}
