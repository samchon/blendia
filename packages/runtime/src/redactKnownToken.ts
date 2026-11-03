/**
 * Replace complete occurrences without allowing a marker to reconstruct the token at either boundary.
 *
 * The replacement is one Unicode scalar absent from the token, so no token can cross or occur inside it. Prefer a visible block; its spelling is deliberately not part of the API contract. An extraordinary token containing every usable scalar suppresses the whole value rather than choosing an unsafe replacement. This is known-token removal, not general secret detection; callers must include any final suffix before redaction or only truncate the returned prefix afterward.
 */
export function redactKnownToken(value: string, token: string): string {
  if (token.length === 0) return value;

  let marker: string = "█";
  if (token.includes(marker)) {
    const characters: Set<string> = new Set(token);
    marker = "";
    for (let scalar: number = 0x20; scalar <= 0x10ffff; scalar++) {
      if (scalar >= 0xd800 && scalar <= 0xdfff) continue;
      const candidate: string = String.fromCodePoint(scalar);
      if (!characters.has(candidate)) {
        marker = candidate;
        break;
      }
    }
    if (marker.length === 0) return "";
  }
  return value.split(token).join(marker);
}
