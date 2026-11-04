import assert from "node:assert/strict";

import type { IScriptLogEntry } from "../../../../../packages/runtime/src/IScriptLogEntry";
import { ScriptJobState } from "../../../../../packages/runtime/src/internal/ScriptJobState";
import { ScriptLog } from "../../../../../packages/runtime/src/internal/ScriptLog";
import { prepareConnectionEnvironment } from "../../../../../packages/runtime/src/internal/prepareConnectionEnvironment";

/**
 * Align inherited child credentials, capture redaction, and fresh headless isolation.
 *
 * Scenarios:
 * 1. Credentials follow the actual platform's environment key rules in a detached copy.
 * 2. Windows lexical priority includes empty and undefined first aliases; POSIX preserves unrelated case variants.
 * 3. Explicit fields override independently, including port zero and an empty token.
 * 4. Fresh headless preparation removes inherited credentials before explicit fields are applied.
 * 5. The canonical selected canary is hidden by the real captured log and public job metadata owners.
 *
 * @evidence contracts/testing.md#behavioral-verification Call the production helper used by ScriptJob, project launch, and owned headless launch; observe platform credential selection, copied environment ownership, explicit overrides, inherited removal, and real journal/state redaction without launching a child.
 * @evidence contracts/testing.md#independent-expectations Node's Windows child-environment contract selects the lexicographically first case-insensitive key, including an undefined first key that suppresses later aliases; POSIX keys remain case-sensitive. Explicit defined fields replace only their credential, and a fresh owned bridge must receive no inherited credential.
 * @evidence contracts/testing.md#distinguishing-cases Cover absent, canonical, mixed-case, duplicate, empty and undefined values on the actual platform, independently omitted override fields, zero/empty overrides, inherited clearing with and without explicit replacement, caller/global nonmutation, and split canary redaction; actual child delivery and Blender lifecycle remain host observations.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this named first-party case against the internal production helper and actual ScriptLog/ScriptJobState consumers; only local environment objects and harmless canary buffers are used, with no process mutation, fake launcher, mock globals, compiler probe, or test-only export.
 */
export function test_connection_environment(): void {
  // Compare inherited state only as a boolean so assertion output cannot expose credentials.
  const inheritedBefore: string = JSON.stringify(process.env);
  const empty: NodeJS.ProcessEnv = Object.freeze({});
  const emptyCopy: NodeJS.ProcessEnv = prepareConnectionEnvironment(empty);
  assert.deepEqual(emptyCopy, {});
  assert.notEqual(emptyCopy, empty);

  const unrelated: NodeJS.ProcessEnv = {
    BLENDIA_UNIT_VALUE: "caller-owned",
    BLENDIA_UNIT_EMPTY: "",
    BLENDIA_UNIT_UNDEFINED: undefined,
    BLENDIA_TOKEN_SUFFIX: "different-variable",
  };
  const token: string = "canary-connection-한🔐";
  const caller: NodeJS.ProcessEnv = Object.freeze({
    ...unrelated,
    blendia_token: "lowercase-token",
    Blendia_Token: token,
    blendia_port: "9999",
    Blendia_Port: "4312",
  });
  const original: NodeJS.ProcessEnv = { ...caller };
  const selected: NodeJS.ProcessEnv = prepareConnectionEnvironment(caller);
  assert.deepEqual(
    selected,
    process.platform === "win32"
      ? { ...unrelated, BLENDIA_TOKEN: token, BLENDIA_PORT: "4312" }
      : caller,
  );
  assert.notEqual(selected, caller);
  assert.deepEqual(caller, original);
  selected.BLENDIA_UNIT_VALUE = "copy-only";
  assert.equal(caller.BLENDIA_UNIT_VALUE, "caller-owned");

  const canonical: NodeJS.ProcessEnv = Object.freeze({
    ...unrelated,
    BLENDIA_PORT: "4312",
    BLENDIA_TOKEN: token,
  });
  assert.deepEqual(prepareConnectionEnvironment(canonical), canonical);
  assert.deepEqual(prepareConnectionEnvironment(canonical, {}), canonical);
  assert.deepEqual(
    prepareConnectionEnvironment(canonical, {
      port: undefined,
      token: undefined,
    }),
    canonical,
  );
  assert.deepEqual(prepareConnectionEnvironment(canonical, { port: 0 }), {
    ...canonical,
    BLENDIA_PORT: "0",
  });
  assert.deepEqual(prepareConnectionEnvironment(canonical, { token: "" }), {
    ...canonical,
    BLENDIA_TOKEN: "",
  });

  const suppressed: NodeJS.ProcessEnv = Object.freeze({
    ...caller,
    BLENDIA_TOKEN: undefined,
    BLENDIA_PORT: undefined,
  });
  assert.deepEqual(
    prepareConnectionEnvironment(suppressed),
    process.platform === "win32" ? unrelated : caller,
  );
  const blank: NodeJS.ProcessEnv = Object.freeze({
    ...caller,
    BLENDIA_TOKEN: "",
    BLENDIA_PORT: "",
  });
  assert.deepEqual(
    prepareConnectionEnvironment(blank),
    process.platform === "win32"
      ? { ...unrelated, BLENDIA_TOKEN: "", BLENDIA_PORT: "" }
      : blank,
  );

  const inherited: NodeJS.ProcessEnv = Object.freeze({
    ...caller,
    BLENDIA_TOKEN: token,
    BLENDIA_PORT: "4312",
  });
  const cleared: NodeJS.ProcessEnv =
    process.platform === "win32" ? unrelated : caller;
  assert.deepEqual(
    prepareConnectionEnvironment(inherited, undefined, true),
    cleared,
  );
  assert.deepEqual(
    prepareConnectionEnvironment(inherited, { port: 0, token: "" }, true),
    { ...cleared, BLENDIA_PORT: "0", BLENDIA_TOKEN: "" },
  );
  assert.deepEqual(caller, original);
  assert.deepEqual(canonical, {
    ...unrelated,
    BLENDIA_PORT: "4312",
    BLENDIA_TOKEN: token,
  });

  const captured: NodeJS.ProcessEnv = prepareConnectionEnvironment(
    process.platform === "win32" ? caller : canonical,
  );
  assert.equal(captured.BLENDIA_TOKEN, token);
  const log: ScriptLog = new ScriptLog(captured.BLENDIA_TOKEN);
  log.append("stdout", Buffer.from("before canary-connection-"));
  log.append("stdout", Buffer.from("한🔐 after"));
  log.finish("stdout");
  const visible: string = log
    .read()
    .entries.map((entry: IScriptLogEntry): string => entry.text)
    .join("");
  assert.ok(visible.startsWith("before "));
  assert.ok(visible.endsWith(" after"));
  assert.equal(visible.includes(token), false);

  const state: ScriptJobState = new ScriptJobState(
    "canary-job",
    "canary-owner",
    captured.BLENDIA_TOKEN,
  );
  state.complete({
    outcome: "exited",
    result: {
      code: 0,
      signal: null,
      sourcePath: `/safe/${token}/scene.ts`,
      stagedPath: `/safe/${token}/staged.ts`,
      origin: `safe ${token} end`,
      staging: "retained",
    },
  });
  assert.equal(JSON.stringify(state.inspect()).includes(token), false);
  assert.equal(JSON.stringify(process.env) === inheritedBefore, true);
}
