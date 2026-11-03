import fs from "node:fs";
import path from "node:path";

/** Copy the canonical license into the extension payload before distribution. */
export function prepareExtensionLicense(): void {
  fs.copyFileSync(
    path.resolve(__dirname, "../LICENSE"),
    path.resolve(__dirname, "../blender/extension/LICENSE"),
  );
}

prepareExtensionLicense();
