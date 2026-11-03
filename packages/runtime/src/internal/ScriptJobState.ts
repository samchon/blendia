import type { IScriptJobSnapshot } from "../IScriptJobSnapshot";
import type { ITextMacroResult } from "../ITextMacroResult";
import type { IScriptExecutionResult } from "./IScriptExecutionResult";

/** Own monotonic launcher observations and bounded, credential-free public metadata. */
export class ScriptJobState {
  /** Only credential-free, bounded values are stored in the public projection. */
  private state: IScriptJobSnapshot;

  /** Create the starting observation without serializing request options. */
  public constructor(
    id: string,
    ownerId: string,
    private token: string = "",
  ) {
    this.state = {
      id,
      ownerId,
      phase: "starting",
      metadataTruncated: false,
      earliestCursor: 0,
      tailCursor: 0,
    };
  }

  /** Refuse regressions, and ignore late process observations after terminal. */
  public advance(phase: "running" | "draining"): void {
    if (this.state.phase === "terminal") return;
    if (phase === "running" && this.state.phase !== "starting")
      throw new Error("blendia: launcher phase cannot move backwards.");
    this.state.phase = phase;
  }

  /** Private execution errors are replaced with a fixed finding; child diagnostics remain in the journal. */
  public complete(execution: IScriptExecutionResult): void {
    if (this.state.phase === "terminal")
      throw new Error("blendia: job is already terminal.");
    this.state.phase = "terminal";
    this.state.outcome = execution.outcome;
    const result: IScriptExecutionResult["result"] = execution.result;
    if ("stagedPath" in result) {
      const text: ITextMacroResult = {
        ...result,
        sourcePath: this.sanitize(result.sourcePath),
        stagedPath: this.sanitize(result.stagedPath),
        origin: this.sanitize(result.origin),
        cleanupError:
          result.cleanupError === undefined
            ? undefined
            : this.sanitize(result.cleanupError),
      };
      this.state.result = text;
    } else this.state.result = { code: result.code, signal: result.signal };
    if (execution.outcome !== "exited")
      this.state.diagnostic =
        execution.outcome === "launch-failed"
          ? "Script preparation or launcher creation failed; inspect project paths and prerequisites. No scene rollback is implied."
          : "Launcher termination or pipe completion is uncertain; descendants may remain active. No retry or rollback was performed.";
  }

  /** Return detached metadata so readers cannot mutate lifecycle state. */
  public inspect(
    earliestCursor: number = 0,
    tailCursor: number = 0,
  ): IScriptJobSnapshot {
    return {
      ...this.state,
      result:
        this.state.result === undefined ? undefined : { ...this.state.result },
      earliestCursor,
      tailCursor,
    };
  }

  /** Drop the credential after terminal record ownership ends. */
  public release(): void {
    this.token = "";
  }

  /** Mark display truncation explicitly; filesystem cleanup never consumes this projection. */
  private sanitize(value: string): string {
    const redacted: string =
      this.token.length === 0
        ? value
        : value
            .split(this.token)
            .join("[REDACTED]".includes(this.token) ? "" : "[REDACTED]");
    if (Buffer.byteLength(redacted, "utf8") <= 4096) return redacted;
    this.state.metadataTruncated = true;
    let result: string = "";
    let size: number = 0;
    for (const character of redacted) {
      const length: number = Buffer.byteLength(character, "utf8");
      if (size + length > 4080) break;
      result += character;
      size += length;
    }
    return result + "[truncated]";
  }
}
