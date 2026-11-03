import { type IBlendiaCommand, parseBlendiaCommand } from "blendia";
import assert from "node:assert/strict";

/**
 * Preserve the launcher/script argument boundary while rejecting ambiguous launcher inputs.
 *
 * Scenarios:
 * 1. Help and ordinary entries retain their defined meanings.
 * 2. Launcher path pairs precede the entry; every later script argument survives unchanged.
 * 3. Missing, repeated, unknown, and blank launcher operands fail without mutating argv.
 *
 * @evidence contracts/testing.md#behavioral-verification Invoke the production parser consumed by bin.ts and assert literal help, options, tail values, and refusals; optional absent fields may remain undefined.
 * @evidence contracts/testing.md#independent-expectations The documented prefix-only grammar and one immediate separator determine literal expected values, independently of the parser's loop or returned snapshots.
 * @evidence contracts/testing.md#distinguishing-cases Cover both path-pair orders, frozen argv, dash-prefixed script arguments, later separators, empty tails, and malformed prefixes; transport framing belongs to the SDK case.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this named CLI unit; it exercises existing first-party argument parsing without processes, package assertions, or upstream checks.
 */
export function test_cli_arguments(): void {
  for (const argv of [[], ["--help"], ["-h"], ["run", "--help"], ["run", "-h"]])
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
    assert.throws(() => parseBlendiaCommand(input), Error);
}
