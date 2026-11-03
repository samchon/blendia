import assert from "node:assert/strict";

import type { IScriptJobSnapshot } from "../../../../packages/runtime/src/IScriptJobSnapshot";
import type { IScriptExecutionResult } from "../../../../packages/runtime/src/internal/IScriptExecutionResult";
import { ScriptJobState } from "../../../../packages/runtime/src/internal/ScriptJobState";

/**
 * Keep terminal observations monotonic and public metadata independent of private execution errors.
 *
 * Scenarios:
 * 1. Starting, running, draining, and terminal remain ordered despite late phase notifications.
 * 2. Nonzero ordinary exits remain exited; launch failures and uncertain termination stay distinct.
 * 3. Returned snapshots are copies, and Text metadata is redacted and bounded without breaking Unicode.
 *
 * @evidence contracts/testing.md#behavioral-verification Invoke the production state owner consumed by ScriptJob and observe phases, outcomes, copy ownership, bounded metadata, and sanitized public diagnostics without inventing a child process or lifecycle implementation.
 * @evidence contracts/testing.md#independent-expectations The accepted phase order, distinction between exit status and launch failure, private-error boundary, and 4096-byte public-field limit determine literal observations independently of the state object's private storage.
 * @evidence contracts/testing.md#distinguishing-cases Cover bootstrap failure, nonzero exit, uncertain termination, refused backward and repeated completion, ignored late events, caller mutation, and multibyte secret-bearing metadata; actual process EOF and cleanup remain manual product checks.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this named case against actual first-party ScriptJobState; its execution-result values are ordinary production inputs, with no process mocks, fixture launcher, or test-only API.
 */
export function test_script_job_state(): void {
  const state: ScriptJobState = new ScriptJobState("job", "owner");
  assert.equal(state.inspect().phase, "starting");
  state.advance("running");
  assert.equal(state.inspect().phase, "running");
  state.advance("draining");
  assert.throws((): void => state.advance("running"), Error);
  assert.equal(state.inspect().phase, "draining");
  const exited: IScriptExecutionResult = {
    outcome: "exited",
    result: { code: 1, signal: null },
  };
  state.complete(exited);
  const terminal: IScriptJobSnapshot = state.inspect(2, 5);
  assert.equal(terminal.id, "job");
  assert.equal(terminal.ownerId, "owner");
  assert.equal(terminal.phase, "terminal");
  assert.equal(terminal.outcome, "exited");
  assert.deepEqual(terminal.result, { code: 1, signal: null });
  assert.equal(terminal.diagnostic, undefined);
  assert.equal(terminal.earliestCursor, 2);
  assert.equal(terminal.tailCursor, 5);
  state.advance("running");
  state.advance("draining");
  assert.deepEqual(state.inspect(2, 5), terminal);
  assert.throws((): void => state.complete(exited), Error);
  assert.ok(terminal.result !== undefined);
  terminal.result.code = 42;
  terminal.phase = "starting";
  assert.equal(state.inspect().phase, "terminal");
  assert.equal(state.inspect().result?.code, 1);

  const token: string = "private-credential";
  const failed: ScriptJobState = new ScriptJobState("failed", "owner", token);
  failed.complete({
    outcome: "launch-failed",
    result: { code: null, signal: null },
    error: new Error(`private stack ${token}`),
  });
  assert.equal(failed.inspect().phase, "terminal");
  assert.equal(failed.inspect().outcome, "launch-failed");
  assert.equal(JSON.stringify(failed.inspect()).includes(token), false);
  assert.equal(
    JSON.stringify(failed.inspect()).includes("private stack"),
    false,
  );
  assert.ok(failed.inspect().diagnostic?.includes("No scene rollback"));

  const uncertain: ScriptJobState = new ScriptJobState(
    "uncertain",
    "owner",
    token,
  );
  uncertain.advance("draining");
  uncertain.complete({
    outcome: "unknown",
    result: { code: null, signal: null },
    error: new Error(token),
  });
  assert.equal(uncertain.inspect().outcome, "unknown");
  assert.ok(
    uncertain.inspect().diagnostic?.includes("descendants may remain active"),
  );
  assert.equal(JSON.stringify(uncertain.inspect()).includes(token), false);

  const text: ScriptJobState = new ScriptJobState("text", "owner", token);
  text.complete({
    outcome: "exited",
    result: {
      code: 0,
      signal: null,
      sourcePath: `/${token}/scene.ts`,
      stagedPath: `/${token}/staged.ts`,
      origin: `${token}${"한".repeat(2000)}`,
      staging: "retained",
      cleanupError: `unsafe ${token}`,
    },
  });
  const snapshot: IScriptJobSnapshot = text.inspect();
  assert.ok(snapshot.result !== undefined && "sourcePath" in snapshot.result);
  assert.equal(snapshot.result.sourcePath, "/[REDACTED]/scene.ts");
  assert.equal(snapshot.result.stagedPath, "/[REDACTED]/staged.ts");
  assert.equal(snapshot.result.cleanupError, "unsafe [REDACTED]");
  assert.equal(snapshot.result.staging, "retained");
  assert.equal(snapshot.metadataTruncated, true);
  assert.ok(Buffer.byteLength(snapshot.result.origin, "utf8") <= 4096);
  assert.ok(snapshot.result.origin.endsWith("[truncated]"));
  assert.equal(snapshot.result.origin.includes("\ufffd"), false);
  assert.equal(JSON.stringify(snapshot).includes(token), false);
}
