import { BlenderAdmissionStoppedError } from "./BlenderAdmissionStoppedError";

/** Stop new actual-engine admissions after uncertainty while allowing ordinary independent assertion failures to aggregate. */
export class BlenderEngineAdmission {
  /** First uncertain lifetime wins; this suite never resets or retries it. */
  private static uncertainStage: string | undefined;

  /** Refuse a new native process or owned script without modifying retained files. */
  public static assertOpen(): void {
    if (this.uncertainStage !== undefined)
      throw new BlenderAdmissionStoppedError(this.uncertainStage);
  }

  /** Retain the first stage that could still own a native process or private storage. */
  public static stop(stage: string): void {
    this.uncertainStage ??= stage;
  }
}
