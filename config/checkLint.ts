import process from "node:process";
import { type ITtscCompilerResult, TtscCompiler } from "ttsc";

/**
 * Run the workspace's development lint and evidence guards against its existing tsconfig.
 *
 * The explicit plugin list selects this additional lint pass only; normal ttsc and ttsx retain the project's other configured and automatically discovered plugins. The public compile API has no noEmit option: it captures private output in memory or temporary storage, which this guard discards without writing distribution files.
 * Every diagnostic is printed with its original fields. Compiler failures, host exceptions, and constructor failures set a nonzero exit status.
 */
export function checkLint(): void {
  try {
    const result: ITtscCompilerResult = new TtscCompiler({
      cwd: process.cwd(),
      tsconfig: "tsconfig.json",
      plugins: [{ transform: "@ttsc/lint", configFile: "lint.config.ts" }],
    }).compile();

    if (result.type === "exception") {
      console.error(JSON.stringify(result));
      process.exitCode = 1;
      return;
    }

    for (const diagnostic of result.diagnostics ?? [])
      console.error(JSON.stringify(diagnostic));

    if (result.type === "failure") process.exitCode = 1;
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

checkLint();
