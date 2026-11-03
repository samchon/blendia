/** First-party facade rejection with explicit effect information and no private cause. */
export class BlendiaMcpError extends Error {
  /** Stable model-visible category. */
  public readonly code: string;
  /** Whether this operation may already have effects. */
  public readonly effects: "none" | "possible";
  /** Construct only from controlled facade diagnostics. */
  public constructor(
    code: string,
    message: string,
    effects: "none" | "possible" = "none",
  ) {
    super(message);
    this.name = "BlendiaMcpError";
    this.code = code;
    this.effects = effects;
  }
}
