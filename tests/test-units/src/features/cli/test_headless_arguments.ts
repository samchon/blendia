import { type IBlendiaCommand, parseBlendiaCommand } from "blendia";
import assert from "node:assert/strict";

import type { IHeadlessProjectOptions } from "../../../../../packages/runtime/src/IHeadlessProjectOptions";
import type { IPreparedHeadlessProject } from "../../../../../packages/runtime/src/internal/IPreparedHeadlessProject";
import { prepareHeadlessProject } from "../../../../../packages/runtime/src/internal/prepareHeadlessProject";

/**
 * Keep explicit owned-Blender launcher options separate from the user's project arguments.
 *
 * Scenarios:
 * 1. Help and the minimal request require no implicit executable, extension, or timeout selection.
 * 2. Reordered paths and bounded deadlines preserve frozen Unicode input and script-owned tails.
 * 3. Repeated, unknown, missing, blank, and option-like launcher operands fail before an entry is admitted.
 * 4. Deadline values accept inclusive decimal bounds and reject fractional, unsafe, and out-of-range values.
 * 5. Explicit null deadlines from JavaScript callers fail in runtime admission before prerequisite filesystem access.
 * 6. Malformed and sparse JavaScript script arguments fail at admission before prerequisite filesystem access.
 *
 * @evidence contracts/testing.md#behavioral-verification Invoke the production command parser for headless arguments and the actual runtime preflight for explicit null deadlines and malformed script arguments; precise admission errors distinguish these refusals from later prerequisite-path failure without starting Blender or a project.
 * @evidence contracts/testing.md#independent-expectations Required paths and entry, unique pre-entry options, the single separator, decimal safe-integer range 100 through 3600000, defaults applying only to undefined, and explicit script arguments that are strings without NUL determine observations independently of parsing and preparation branches.
 * @evidence contracts/testing.md#distinguishing-cases Cover help, omitted defaults, frozen Unicode argv, deadline endpoints, malformed operands and numeric spelling, script tails, explicit null in each runtime deadline, and null/non-array/nonstring/NUL/sparse runtime arguments; process observation, cooperative shutdown, retention, and persistence remain actual-product checks.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this named case through the CLI parser and the existing production preflight import; malformed JavaScript deadline inputs need no child mocks, filesystem fixtures, lifecycle classifier, test-only export, or upstream test.
 */
export function test_headless_arguments(): void {
  assert.deepEqual(parseBlendiaCommand(["headless", "--help"]), {
    kind: "help",
  });
  assert.deepEqual(parseBlendiaCommand(["headless", "-h"]), { kind: "help" });
  const prefix: readonly string[] = [
    "headless",
    "--blender",
    "bin/blender",
    "--extension-directory",
    "extension root",
  ];
  const minimal: IBlendiaCommand = parseBlendiaCommand([...prefix, "scene.ts"]);
  assert.ok(minimal.kind === "headless");
  assert.equal(minimal.options.entry, "scene.ts");
  assert.equal(minimal.options.blenderExecutable, "bin/blender");
  assert.equal(minimal.options.extensionDirectory, "extension root");
  assert.equal(minimal.options.blendFile, undefined);
  assert.equal(minimal.options.cwd, undefined);
  assert.equal(minimal.options.project, undefined);
  assert.equal(minimal.options.startupTimeoutMs, undefined);
  assert.equal(minimal.options.shutdownTimeoutMs, undefined);
  assert.deepEqual(minimal.options.args, []);

  const argv: readonly string[] = Object.freeze([
    "headless",
    "--shutdown-timeout-ms",
    "100",
    "--project",
    "config/project.json",
    "--blend-file",
    "assets/원본 scene.blend",
    "--cwd",
    "프로젝트 space",
    "--extension-directory",
    "설치 extension",
    "--startup-timeout-ms",
    "3600000",
    "--blender",
    "native Blender/blender.exe",
    "./-scene.ts",
    "--",
    "--",
    "--blender",
    "script-owned",
    "--startup-timeout-ms",
    "not-a-number",
    "",
    "한글",
  ]);
  const configured: IBlendiaCommand = parseBlendiaCommand(argv);
  assert.ok(configured.kind === "headless");
  assert.equal(configured.options.entry, "./-scene.ts");
  assert.equal(
    configured.options.blenderExecutable,
    "native Blender/blender.exe",
  );
  assert.equal(configured.options.extensionDirectory, "설치 extension");
  assert.equal(configured.options.blendFile, "assets/원본 scene.blend");
  assert.equal(configured.options.cwd, "프로젝트 space");
  assert.equal(configured.options.project, "config/project.json");
  assert.equal(configured.options.startupTimeoutMs, 3600000);
  assert.equal(configured.options.shutdownTimeoutMs, 100);
  assert.deepEqual(configured.options.args, [
    "--",
    "--blender",
    "script-owned",
    "--startup-timeout-ms",
    "not-a-number",
    "",
    "한글",
  ]);
  const reversed: IBlendiaCommand = parseBlendiaCommand([
    ...prefix,
    "--startup-timeout-ms",
    "100",
    "--shutdown-timeout-ms",
    "3600000",
    "scene.ts",
    "--",
  ]);
  assert.ok(reversed.kind === "headless");
  assert.equal(reversed.options.startupTimeoutMs, 100);
  assert.equal(reversed.options.shutdownTimeoutMs, 3600000);
  assert.deepEqual(reversed.options.args, []);
  const directTail: IBlendiaCommand = parseBlendiaCommand([
    ...prefix,
    "scene.ts",
    "--help",
    "--",
    "",
  ]);
  assert.ok(directTail.kind === "headless");
  assert.deepEqual(directTail.options.args, ["--help", "--", ""]);

  const invalid: readonly (readonly string[])[] = [
    ["headless"],
    ["headless", "--help", "extra"],
    [...prefix],
    ["headless", "--blender", "blender", "scene.ts"],
    ["headless", "--extension-directory", "extension", "scene.ts"],
    ["headless", "--blender"],
    ["headless", "--extension-directory"],
    [
      "headless",
      "--blender",
      "",
      "--extension-directory",
      "extension",
      "scene.ts",
    ],
    [
      "headless",
      "--blender",
      "-executable",
      "--extension-directory",
      "extension",
      "scene.ts",
    ],
    [
      "headless",
      "--blender",
      "blender",
      "--extension-directory",
      "   ",
      "scene.ts",
    ],
    [
      "headless",
      "--blender",
      "blender",
      "--extension-directory",
      "--cwd",
      "project",
      "scene.ts",
    ],
    [...prefix, ""],
    [...prefix, "   "],
    [...prefix, "-scene.ts"],
    [...prefix, "--", "scene.ts"],
    [...prefix, "--jsonl", "scene.ts"],
    [...prefix, "--blender=other", "scene.ts"],
    [...prefix, "--unknown", "scene.ts"],
  ];
  for (const input of invalid)
    assert.throws((): IBlendiaCommand => parseBlendiaCommand(input), Error);
  for (const [flag, value] of [
    ["--blender", "another"],
    ["--extension-directory", "another"],
    ["--blend-file", "input.blend"],
    ["--cwd", "project"],
    ["--project", "tsconfig.json"],
    ["--startup-timeout-ms", "100"],
    ["--shutdown-timeout-ms", "100"],
  ])
    assert.throws(
      (): IBlendiaCommand =>
        parseBlendiaCommand([...prefix, flag, value, flag, value, "scene.ts"]),
      Error,
    );
  for (const flag of [
    "--blend-file",
    "--cwd",
    "--project",
    "--startup-timeout-ms",
    "--shutdown-timeout-ms",
  ]) {
    assert.throws(
      (): IBlendiaCommand => parseBlendiaCommand([...prefix, flag]),
      Error,
    );
    for (const value of ["", "   ", "--other"])
      assert.throws(
        (): IBlendiaCommand =>
          parseBlendiaCommand([...prefix, flag, value, "scene.ts"]),
        Error,
      );
  }
  for (const flag of ["--startup-timeout-ms", "--shutdown-timeout-ms"])
    for (const value of [
      "99",
      "3600001",
      "100.5",
      "1e3",
      "+100",
      "-100",
      "9007199254740992",
      "NaN",
      "Infinity",
    ])
      assert.throws(
        (): IBlendiaCommand =>
          parseBlendiaCommand([...prefix, flag, value, "scene.ts"]),
        Error,
      );

  // These malformed JavaScript options target runtime admission, not the string parser.
  const invalidDeadlines: readonly unknown[] = [
    {
      entry: "scene.ts",
      blenderExecutable: "blender",
      extensionDirectory: "extension",
      startupTimeoutMs: null,
    },
    {
      entry: "scene.ts",
      blenderExecutable: "blender",
      extensionDirectory: "extension",
      shutdownTimeoutMs: null,
    },
  ];
  for (const input of invalidDeadlines)
    assert.throws(
      (): IPreparedHeadlessProject =>
        prepareHeadlessProject(input as IHeadlessProjectOptions),
      {
        name: "Error",
        message:
          "blendia: headless observation deadlines must be integers from 100 through 3600000 ms.",
      },
    );

  // Sparse script arguments must fail before prerequisite lookup can replace the admission error.
  const sparseArgs: string[] = new Array<string>(1);
  const partialArgs: string[] = ["before", "missing", "after"];
  delete partialArgs[1];
  const invalidArgs: readonly unknown[] = [
    null,
    {},
    [undefined],
    ["bad\0argument"],
    sparseArgs,
    partialArgs,
  ];
  for (const args of invalidArgs) {
    const options: unknown = {
      entry: "scene.ts",
      blenderExecutable: "blender",
      extensionDirectory: "extension",
      args,
    };
    assert.throws(
      (): IPreparedHeadlessProject =>
        prepareHeadlessProject(options as IHeadlessProjectOptions),
      {
        name: "Error",
        message:
          "blendia: headless script arguments must be strings without NUL.",
      },
    );
  }
}
