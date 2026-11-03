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
 * 5. Machine flags stay before script boundaries; discovery probes and doctor paths require explicit valid options.
 *
 * @evidence contracts/testing.md#behavioral-verification Invoke the production parser consumed by bin.ts and assert literal help, saved-file, Text, machine, discovery, and doctor options and refusals; script tails survive unchanged and absent jsonl stays omitted.
 * @evidence contracts/testing.md#independent-expectations The documented saved-entry boundary, Text required paths, origin exception, machine separator, and explicit 100-through-5000-ms probe contract determine literal expectations independently of the parser's loop.
 * @evidence contracts/testing.md#distinguishing-cases Cover frozen argv, path and origin distinctions, duplicates, missing values, machine flags on both sides of script boundaries, probe bounds and consent, and doctor paths; filesystem staging, discovery I/O, and framing have separate owners.
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
    ["sessions", "--help"],
    ["sessions", "-h"],
    ["doctor", "--help"],
    ["doctor", "-h"],
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

  assert.equal(Object.hasOwn(simple, "jsonl"), false);
  assert.equal(Object.hasOwn(minimalText, "jsonl"), false);
  const machine: IBlendiaCommand = parseBlendiaCommand([
    "run",
    "--jsonl",
    "--cwd",
    "project",
    "scene.ts",
    "--",
    "--jsonl",
  ]);
  assert.ok(machine.kind === "run");
  assert.equal(machine.jsonl, true);
  assert.equal(machine.options.cwd, "project");
  assert.deepEqual(machine.options.args, ["--jsonl"]);
  const machineText: IBlendiaCommand = parseBlendiaCommand([
    ...textPrefix,
    "--jsonl",
    "--",
    "--jsonl",
    "",
    "--",
  ]);
  assert.ok(machineText.kind === "run-text");
  assert.equal(machineText.jsonl, true);
  assert.deepEqual(machineText.options.args, ["--jsonl", "", "--"]);
  for (const input of [
    ["run", "scene.ts", "--jsonl"],
    [...textPrefix, "--", "--jsonl"],
  ]) {
    const tail: IBlendiaCommand = parseBlendiaCommand(input);
    assert.ok(tail.kind === "run" || tail.kind === "run-text");
    assert.equal(Object.hasOwn(tail, "jsonl"), false);
    assert.deepEqual(tail.options.args, ["--jsonl"]);
  }

  const sessions: IBlendiaCommand = parseBlendiaCommand([
    "sessions",
    "--directory",
    "session space",
  ]);
  assert.ok(sessions.kind === "sessions");
  assert.equal(sessions.options.directory, "session space");
  assert.equal(sessions.options.probe, undefined);
  assert.equal(sessions.options.probeTimeoutMs, undefined);
  for (const timeout of [100, 5000]) {
    const probe: IBlendiaCommand = parseBlendiaCommand(
      Object.freeze([
        "sessions",
        "--probe-timeout-ms",
        String(timeout),
        "--directory",
        "세션 space",
        "--probe",
      ]),
    );
    assert.ok(probe.kind === "sessions");
    assert.equal(probe.options.directory, "세션 space");
    assert.equal(probe.options.probe, true);
    assert.equal(probe.options.probeTimeoutMs, timeout);
  }
  const defaultProbe: IBlendiaCommand = parseBlendiaCommand([
    "sessions",
    "--probe",
    "--directory",
    ".",
  ]);
  assert.ok(defaultProbe.kind === "sessions");
  assert.equal(defaultProbe.options.probe, true);
  assert.equal(defaultProbe.options.probeTimeoutMs, undefined);

  assert.deepEqual(parseBlendiaCommand(["doctor"]), {
    kind: "doctor",
    options: { cwd: undefined, project: undefined },
  });
  const doctor: IBlendiaCommand = parseBlendiaCommand(
    Object.freeze([
      "doctor",
      "--project",
      "config/tsconfig.json",
      "--cwd",
      "프로젝트 space",
    ]),
  );
  assert.ok(doctor.kind === "doctor");
  assert.equal(doctor.options.cwd, "프로젝트 space");
  assert.equal(doctor.options.project, "config/tsconfig.json");

  const invalidControl: readonly (readonly string[])[] = [
    ["run", "--jsonl"],
    ["run", "--jsonl", "--jsonl", "scene.ts"],
    [...textPrefix, "--jsonl", "--jsonl"],
    ["sessions"],
    ["sessions", "--directory"],
    ["sessions", "--directory", ""],
    ["sessions", "--directory", "-private"],
    ["sessions", "--directory", ".", "--directory", "other"],
    ["sessions", "--directory", ".", "--probe", "--probe"],
    ["sessions", "--directory", ".", "--probe-timeout-ms", "100"],
    ["sessions", "--directory", ".", "--probe", "--probe-timeout-ms"],
    [
      "sessions",
      "--directory",
      ".",
      "--probe",
      "--probe-timeout-ms",
      "100",
      "--probe-timeout-ms",
      "200",
    ],
    ["sessions", "--directory", ".", "--jsonl"],
    ["sessions", "--directory", ".", "--", "tail"],
    ["sessions", "--help", "extra"],
    ["doctor", "--cwd"],
    ["doctor", "--project", ""],
    ["doctor", "--cwd", "   "],
    ["doctor", "--project", "-config.json"],
    ["doctor", "--cwd", ".", "--cwd", "other"],
    ["doctor", "--project", "a.json", "--project", "b.json"],
    ["doctor", "--probe"],
    ["doctor", "--jsonl"],
    ["doctor", "--help", "extra"],
  ];
  for (const input of invalidControl)
    assert.throws((): IBlendiaCommand => parseBlendiaCommand(input), Error);
  for (const timeout of [
    "99",
    "5001",
    "1.5",
    "1e3",
    "9007199254740992",
    "NaN",
    "   ",
  ])
    assert.throws(
      (): IBlendiaCommand =>
        parseBlendiaCommand([
          "sessions",
          "--directory",
          ".",
          "--probe",
          "--probe-timeout-ms",
          timeout,
        ]),
      Error,
    );
}
