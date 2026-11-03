/** A later engine group was not admitted because an earlier native lifetime remains uncertain. */
export class BlenderAdmissionStoppedError extends Error {
  /** Preserve a fixed stage label without exposing private configuration or credentials. */
  public constructor(stage: string) {
    super(
      `New native work was not admitted after uncertain observation of ${stage}. Retained files and outputs were preserved.`,
    );
    this.name = "BlenderAdmissionStoppedError";
  }
}
