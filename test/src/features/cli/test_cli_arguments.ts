import { type IBlendiaCommand, parseBlendiaCommand } from "blendia";
import assert from "node:assert/strict";

/**
 * Preserve the launcher/script argument boundary while rejecting ambiguous launcher inputs.
 *
 * Scenarios:
 * 1. Help and ordinary entries retain their defined meanings.
 * 2. Launcher path pairs precede the entry; every later script argument survives unchanged.
 * 3. Missing, repeated, unknown, and blank launcher operands fail without mutating argv.
 * 4. Text commands require their three path pairs, allow dash-prefixed origin labels, and preserve the explicit separator's tail.
 *
 * @evidence contracts/testing.md#behavioral-verification Invoke the production parser consumed by bin.ts and assert literal help, saved-file and Text options, tail values, and refusals; optional absent fields may remain undefined.
 * @evidence contracts/testing.md#independent-expectations The documented saved-entry boundary, Text required path pairs, origin-label exception, and explicit separator determine literal expectations independently of the parser's loop or returned snapshots.
 * @evidence contracts/testing.md#distinguishing-cases Cover option order, frozen argv, required Text paths, dash-prefixed origin versus path operands, duplicate and missing values, empty tails, and later separators; filesystem staging and transport framing have separate owners.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this named CLI unit; it exercises existing first-party argument parsing without processes, package assertions, or upstream checks.
 */
export function test_cli_arguments(): void {
  for (const argv of [
    [],
    ["--help"],
    ["-h"],
    ["run", "--help"],
    ["run", "-h"],
    ["run-text", "--help"],
    ["run-text", "-h"],
  ])
    assert.deepEqual(parseBlendiaCommand(argv), { kind: "help" });

  const simple: IBlendiaCommand = parseBlendiaCommand(["run", "scene.ts"]);
  assert.ok(simple.kind === "run");
  assert.equal(simple.options.entry, "scene.ts");
  assert.equal(simple.options.cwd, undefined);
  assert.equal(simple.options.project, undefined);
  assert.deepEqual(simple.options.args ?? [], []);

  const argv: readonly string[] = Object.freeze([
    "run",
    "--project",
    "configs/project.json",
    "--cwd",
    "my project",
    "scene.ts",
    "--",
    "--help",
    "--project",
    "script.json",
    "",
    "--",
    "tail",
  ]);
  const configured: IBlendiaCommand = parseBlendiaCommand(argv);
  assert.ok(configured.kind === "run");
  assert.equal(configured.options.entry, "scene.ts");
  assert.equal(configured.options.cwd, "my project");
  assert.equal(configured.options.project, "configs/project.json");
  assert.deepEqual(configured.options.args, [
    "--help",
    "--project",
    "script.json",
    "",
    "--",
    "tail",
  ]);

  const reordered: IBlendiaCommand = parseBlendiaCommand([
    "run",
    "--cwd",
    ".",
    "--project",
    "tsconfig.json",
    "./-scene.ts",
    "--",
    "--",
    "--cwd",
    "script-owned",
  ]);
  assert.ok(reordered.kind === "run");
  assert.equal(reordered.options.entry, "./-scene.ts");
  assert.equal(reordered.options.cwd, ".");
  assert.equal(reordered.options.project, "tsconfig.json");
  assert.deepEqual(reordered.options.args, ["--", "--cwd", "script-owned"]);

  const directTail: IBlendiaCommand = parseBlendiaCommand([
    "run",
    "scene.ts",
    "--help",
    "--",
    "",
  ]);
  assert.ok(directTail.kind === "run");
  assert.deepEqual(directTail.options.args, ["--help", "--", ""]);

  const invalid: readonly (readonly string[])[] = [
    ["unknown"],
    ["--help", "extra"],
    ["run"],
    ["run", "--help", "extra"],
    ["run", ""],
    ["run", "   "],
    ["run", "-scene.ts"],
    ["run", "--unknown", "scene.ts"],
    ["run", "--cwd=.", "scene.ts"],
    ["run", "--cwd"],
    ["run", "--project"],
    ["run", "--cwd", ""],
    ["run", "--project", "   "],
    ["run", "--cwd", "--project", "p.json", "scene.ts"],
    ["run", "--project", "-p.json", "scene.ts"],
    ["run", "--cwd", "."],
    ["run", "--cwd", ".", "--cwd", "other", "scene.ts"],
    ["run", "--project", "a.json", "--project", "b.json", "scene.ts"],
  ];
  for (const input of invalid)
    assert.throws((): IBlendiaCommand => parseBlendiaCommand(input), Error);

  const textPrefix: readonly string[] = [
    "run-text",
    "--cwd",
    "project space",
    "--source-path",
    "macros/scene.ts",
    "--input-file",
    "private input.txt",
  ];
  const minimalText: IBlendiaCommand = parseBlendiaCommand(textPrefix);
  assert.ok(minimalText.kind === "run-text");
  assert.equal(minimalText.inputFile, "private input.txt");
  assert.equal(minimalText.options.cwd, "project space");
  assert.equal(minimalText.options.sourcePath, "macros/scene.ts");
  assert.equal(minimalText.options.project, undefined);
  assert.equal(minimalText.options.origin, undefined);
  assert.deepEqual(minimalText.options.args ?? [], []);

  const textArgv: readonly string[] = Object.freeze([
    "run-text",
    "--input-file",
    "inputs/활성 text.utf8",
    "--origin",
    "--help",
    "--source-path",
    "macros/장면.ts",
    "--project",
    "config/tsconfig.json",
    "--cwd",
    "프로젝트 space",
    "--",
    "--",
    "--cwd",
    "script-owned",
    "--origin",
    "",
    "한글",
  ]);
  const configuredText: IBlendiaCommand = parseBlendiaCommand(textArgv);
  assert.ok(configuredText.kind === "run-text");
  assert.equal(configuredText.inputFile, "inputs/활성 text.utf8");
  assert.equal(configuredText.options.cwd, "프로젝트 space");
  assert.equal(configuredText.options.sourcePath, "macros/장면.ts");
  assert.equal(configuredText.options.project, "config/tsconfig.json");
  assert.equal(configuredText.options.origin, "--help");
  assert.deepEqual(configuredText.options.args, [
    "--",
    "--cwd",
    "script-owned",
    "--origin",
    "",
    "한글",
  ]);

  const emptyTextTail: IBlendiaCommand = parseBlendiaCommand([
    ...textPrefix,
    "--",
  ]);
  assert.ok(emptyTextTail.kind === "run-text");
  assert.deepEqual(emptyTextTail.options.args ?? [], []);

  const invalidText: readonly (readonly string[])[] = [
    ["run-text"],
    ["run-text", "--help", "extra"],
    ["run-text", "--source-path", "scene.ts", "--input-file", "input.txt"],
    ["run-text", "--cwd", "project", "--input-file", "input.txt"],
    ["run-text", "--cwd", "project", "--source-path", "scene.ts"],
    ["run-text", "--", ...textPrefix.slice(1)],
    [...textPrefix, "unexpected.ts"],
    [...textPrefix, "--unknown", "value"],
    [...textPrefix, "--cwd=other"],
    [...textPrefix, "--help"],
    [...textPrefix, "--cwd", "other"],
    [...textPrefix, "--source-path", "other.ts"],
    [...textPrefix, "--input-file", "other.txt"],
    [...textPrefix, "--project", "a.json", "--project", "b.json"],
    [...textPrefix, "--origin", "Text", "--origin", "Other"],
    [
      "run-text",
      "--source-path",
      "scene.ts",
      "--input-file",
      "input.txt",
      "--cwd",
    ],
    [
      "run-text",
      "--cwd",
      "project",
      "--input-file",
      "input.txt",
      "--source-path",
    ],
    [
      "run-text",
      "--cwd",
      "project",
      "--source-path",
      "scene.ts",
      "--input-file",
    ],
    [...textPrefix, "--project"],
    [...textPrefix, "--origin"],
    [
      "run-text",
      "--source-path",
      "scene.ts",
      "--input-file",
      "input.txt",
      "--cwd",
      "",
    ],
    [
      "run-text",
      "--cwd",
      "project",
      "--input-file",
      "input.txt",
      "--source-path",
      "   ",
    ],
    [
      "run-text",
      "--cwd",
      "project",
      "--source-path",
      "scene.ts",
      "--input-file",
      "",
    ],
    [...textPrefix, "--project", "   "],
    [...textPrefix, "--origin", ""],
    [
      "run-text",
      "--source-path",
      "scene.ts",
      "--input-file",
      "input.txt",
      "--cwd",
      "--project",
    ],
    [
      "run-text",
      "--cwd",
      "project",
      "--input-file",
      "input.txt",
      "--source-path",
      "-scene.ts",
    ],
    [
      "run-text",
      "--cwd",
      "project",
      "--source-path",
      "scene.ts",
      "--input-file",
      "-input.txt",
    ],
    [...textPrefix, "--project", "-config.json"],
    [...textPrefix, "--origin", "--"],
  ];
  for (const input of invalidText)
    assert.throws((): IBlendiaCommand => parseBlendiaCommand(input), Error);
}
