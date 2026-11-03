import { constants } from "node:fs";
import type { Stats } from "node:fs";
import { access, open, stat } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { TextDecoder } from "node:util";

import type { IProjectDoctorOptions } from "./IProjectDoctorOptions";
import type { IProjectDoctorReport } from "./IProjectDoctorReport";

/**
 * Report current Node, public launcher metadata, and project-resolution facts without executing user or tool code.
 *
 * The owning runtime's ttsc/package.json supplies bin.ttsx, matching the launcher's dependency context. Project SDK and TypeScript metadata are resolved from cwd. An omitted project reports the nearest tsconfig candidate, not proof that ttsx selects it or that its extends/plugins are valid.
 *
 * execution stays not-tested: no compiler/import probe, subprocess, Go build, network access, plugin setup, environment change, or cache cleanup occurs. Native first-use preparation can still take minutes or fail even when every inspected file exists.
 */
export async function doctorProject(
  options: IProjectDoctorOptions = {},
): Promise<IProjectDoctorReport> {
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options) ||
    (options.cwd !== undefined &&
      (typeof options.cwd !== "string" ||
        options.cwd.length === 0 ||
        options.cwd.includes("\0"))) ||
    (options.project !== undefined &&
      (typeof options.project !== "string" ||
        options.project.length === 0 ||
        options.project.includes("\0")))
  )
    throw new Error("blendia: doctor requires valid cwd and project paths.");
  const cwd: string = path.resolve(options.cwd ?? process.cwd());
  try {
    if (!(await stat(cwd)).isDirectory()) throw new Error("not a directory");
    await access(cwd, constants.R_OK);
  } catch {
    throw new Error(
      "blendia: doctor cwd must be a readable existing directory.",
    );
  }
  const report: IProjectDoctorReport = {
    nodeExecutable: process.execPath,
    nodeVersion: process.version,
    cwd,
    requestedProjectPath:
      options.project === undefined ? null : path.resolve(cwd, options.project),
    tsconfigPath: null,
    tsconfigStatus: "not-located",
    ttscPackagePath: null,
    ttscVersion: null,
    ttsxPath: null,
    ttsxReadable: false,
    sdkPackagePath: null,
    typescriptPackagePath: null,
    typescriptVersion: null,
    issues: [],
    execution: "not-tested",
  };

  /** Read only bounded JSON metadata, returning no original error or file contents on failure. */
  async function readMetadata(
    filePath: string,
  ): Promise<Record<string, unknown> | null> {
    let handle: FileHandle | null = null;
    try {
      handle = await open(filePath, constants.O_RDONLY);
      const info: Stats = await handle.stat();
      if (!info.isFile() || info.size > 65536) return null;
      const bytes: Buffer = Buffer.alloc(65537);
      let used: number = 0;
      while (used < bytes.length) {
        const count: number = (
          await handle.read(bytes, used, bytes.length - used, null)
        ).bytesRead;
        if (count === 0) break;
        used += count;
      }
      if (used > 65536) return null;
      const value: unknown = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(
          bytes.subarray(0, used),
        ),
      );
      return value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
    } catch {
      return null;
    } finally {
      if (handle !== null) {
        try {
          await handle.close();
        } catch {
          report.issues.push("METADATA_CLOSE_FAILED");
        }
      }
    }
  }

  /** Observe readability without parsing tsconfig syntax, loading plugins, or resolving extends. */
  async function readConfig(
    filePath: string,
    explicit: boolean,
  ): Promise<boolean> {
    try {
      const info: Stats = await stat(filePath);
      report.tsconfigPath = filePath;
      if (!info.isFile()) {
        report.tsconfigStatus = explicit
          ? "explicit-unreadable"
          : "candidate-unreadable";
        report.issues.push("TSCONFIG_NOT_REGULAR");
      } else {
        try {
          await access(filePath, constants.R_OK);
          report.tsconfigStatus = explicit
            ? "explicit-readable"
            : "candidate-readable";
        } catch {
          report.tsconfigStatus = explicit
            ? "explicit-unreadable"
            : "candidate-unreadable";
          report.issues.push("TSCONFIG_UNREADABLE");
        }
      }
      return true;
    } catch (error) {
      if (
        error !== null &&
        typeof error === "object" &&
        "code" in error &&
        (error.code === "ENOENT" || error.code === "ENOTDIR")
      )
        return false;
      report.tsconfigPath = filePath;
      report.tsconfigStatus = explicit
        ? "explicit-unreadable"
        : "candidate-unreadable";
      report.issues.push("TSCONFIG_UNREADABLE");
      return true;
    }
  }

  if (report.requestedProjectPath !== null) {
    if (!(await readConfig(report.requestedProjectPath, true))) {
      report.tsconfigStatus = "explicit-missing";
      report.issues.push("TSCONFIG_MISSING");
    }
  } else {
    let directory: string = cwd;
    while (!(await readConfig(path.join(directory, "tsconfig.json"), false))) {
      const parent: string = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
    if (report.tsconfigPath === null)
      report.issues.push("TSCONFIG_NOT_LOCATED");
  }

  const runtimeRequire: NodeJS.Require = createRequire(__filename);
  try {
    report.ttscPackagePath = runtimeRequire.resolve("ttsc/package.json");
    const metadata: Record<string, unknown> | null = await readMetadata(
      report.ttscPackagePath,
    );
    if (metadata === null) report.issues.push("TTSC_METADATA_UNAVAILABLE");
    else {
      if (
        typeof metadata.version === "string" &&
        metadata.version.length <= 128
      )
        report.ttscVersion = metadata.version;
      else report.issues.push("TTSC_VERSION_UNAVAILABLE");
      const bin: unknown = metadata.bin;
      if (
        bin !== null &&
        typeof bin === "object" &&
        !Array.isArray(bin) &&
        "ttsx" in bin &&
        typeof bin.ttsx === "string" &&
        bin.ttsx.length !== 0 &&
        !bin.ttsx.includes("\0")
      ) {
        report.ttsxPath = path.resolve(
          path.dirname(report.ttscPackagePath),
          bin.ttsx,
        );
        try {
          report.ttsxReadable = (await stat(report.ttsxPath)).isFile();
          if (report.ttsxReadable)
            await access(report.ttsxPath, constants.R_OK);
        } catch {
          report.ttsxReadable = false;
        }
        if (!report.ttsxReadable) report.issues.push("TTSX_UNREADABLE");
      } else report.issues.push("TTSX_BIN_UNAVAILABLE");
    }
  } catch {
    report.issues.push("TTSC_METADATA_UNAVAILABLE");
  }

  const projectRequire: NodeJS.Require = createRequire(
    path.join(cwd, "package.json"),
  );
  try {
    report.sdkPackagePath = projectRequire.resolve("@blendia/sdk/package.json");
    if (!(await stat(report.sdkPackagePath)).isFile())
      throw new Error("not metadata");
    await access(report.sdkPackagePath, constants.R_OK);
  } catch {
    report.sdkPackagePath = null;
    report.issues.push("PROJECT_SDK_UNAVAILABLE");
  }
  try {
    report.typescriptPackagePath = projectRequire.resolve(
      "typescript/package.json",
    );
    const metadata: Record<string, unknown> | null = await readMetadata(
      report.typescriptPackagePath,
    );
    if (
      metadata !== null &&
      typeof metadata.version === "string" &&
      metadata.version.length <= 128
    )
      report.typescriptVersion = metadata.version;
    else report.issues.push("PROJECT_TYPESCRIPT_METADATA_UNAVAILABLE");
  } catch {
    report.issues.push("PROJECT_TYPESCRIPT_UNAVAILABLE");
  }
  return report;
}
