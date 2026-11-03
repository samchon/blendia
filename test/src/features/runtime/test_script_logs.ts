import assert from "node:assert/strict";

import type { IScriptLogEntry } from "../../../../packages/runtime/src/IScriptLogEntry";
import type { IScriptLogPage } from "../../../../packages/runtime/src/IScriptLogPage";
import { ScriptLog } from "../../../../packages/runtime/src/internal/ScriptLog";

/**
 * Preserve decoded, redacted output while making page boundaries and retention loss explicit.
 *
 * Scenarios:
 * 1. Every byte split preserves Unicode and hides a known token before publication.
 * 2. Stream tags, finish ownership, and returned entry copies remain independent.
 * 3. Byte and entry-count paging advance cursors without silently dropping retained data.
 * 4. Byte and entry-count retention report gaps; invalid reads never change the journal.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercise the journal actually consumed by ScriptJob, observing decoded text, stream tags, redaction, copied pages, cursors, bounds, and refusals without child processes or replaced methods.
 * @evidence contracts/testing.md#independent-expectations Literal UTF-8 text and the documented 2048-byte entries, 4096-byte minimum pages, 128-entry pages, 65536-byte retention, and 1024-entry retention determine expected output independently of private buffers.
 * @evidence contracts/testing.md#distinguishing-cases Cover every byte split of multibyte secrets, incomplete token prefixes, idempotent finish, append after finish, exact and exceeded bounds, old and future cursors, and immutable read results; actual pipe lifecycle belongs to product validation.
 * @evidence contracts/testing.md#execution-ownership DynamicExecutor discovers this named case against the production internal journal; all inputs are byte buffers and real journal calls, with no filesystem fixture, process mock, or test-only seam.
 */
export function test_script_logs(): void {
  const token: string = "credential-한🔐";
  const wire: Buffer = Buffer.from(`before ${token} after 한🔐`, "utf8");
  for (let cut: number = 1; cut < wire.byteLength; cut++) {
    const log: ScriptLog = new ScriptLog(token);
    log.append("stdout", wire.subarray(0, cut));
    const partial: string = log
      .read()
      .entries.map((entry: IScriptLogEntry): string => entry.text)
      .join("");
    assert.equal(partial.includes(token), false);
    log.append("stdout", wire.subarray(cut));
    log.finish("stdout");
    assert.equal(
      log
        .read()
        .entries.map((entry: IScriptLogEntry): string => entry.text)
        .join(""),
      "before [REDACTED] after 한🔐",
    );
  }

  const streams: ScriptLog = new ScriptLog("secret");
  streams.append("stdout", Buffer.from("out sec"));
  streams.append("stderr", Buffer.from("err secret"));
  streams.append("stdout", Buffer.from("ret!"));
  streams.finish("stdout");
  streams.finish("stderr");
  assert.deepEqual(streams.read().entries, [
    { cursor: 0, stream: "stdout", text: "out " },
    { cursor: 1, stream: "stderr", text: "err [REDACTED]" },
    { cursor: 2, stream: "stdout", text: "[REDACTED]!" },
  ]);
  const finished: IScriptLogPage = streams.read();
  streams.finish("stdout");
  assert.deepEqual(streams.read(), finished);
  assert.throws(
    (): void => streams.append("stdout", Buffer.from("late")),
    Error,
  );
  finished.entries[0].text = "caller mutation";
  assert.equal(streams.read().entries[0].text, "out ");

  const prefix: ScriptLog = new ScriptLog("secret");
  prefix.append("stdout", Buffer.from("sec"));
  assert.deepEqual(prefix.read().entries, []);
  prefix.finish("stdout");
  assert.equal(prefix.read().entries[0].text, "sec");

  const unicode: ScriptLog = new ScriptLog();
  unicode.append("stdout", Buffer.from("한".repeat(2000), "utf8"));
  unicode.finish("stdout");
  const unicodePage: IScriptLogPage = unicode.read(0, 4096);
  assert.ok(unicodePage.hasMore);
  assert.equal(
    unicodePage.entries
      .map((entry: IScriptLogEntry): string => entry.text)
      .join(""),
    "한".repeat(1364),
  );
  for (const entry of unicodePage.entries) {
    assert.ok(Buffer.byteLength(entry.text, "utf8") <= 2048);
    assert.equal(entry.text.includes("\ufffd"), false);
  }
  const unicodeRest: IScriptLogPage = unicode.read(
    unicodePage.nextCursor,
    4096,
  );
  assert.equal(
    unicodeRest.entries
      .map((entry: IScriptLogEntry): string => entry.text)
      .join(""),
    "한".repeat(636),
  );
  assert.equal(unicodeRest.hasMore, false);

  const counted: ScriptLog = new ScriptLog();
  for (let index: number = 0; index < 130; index++)
    counted.append("stdout", Buffer.from("x"));
  const firstPage: IScriptLogPage = counted.read();
  assert.equal(firstPage.entries.length, 128);
  assert.equal(firstPage.nextCursor, 128);
  assert.equal(firstPage.hasMore, true);
  assert.deepEqual(counted.read(128).entries, [
    { cursor: 128, stream: "stdout", text: "x" },
    { cursor: 129, stream: "stdout", text: "x" },
  ]);
  for (let index: number = 130; index < 1024; index++)
    counted.append("stdout", Buffer.from("x"));
  assert.equal(counted.earliestCursor, 0);
  counted.append("stdout", Buffer.from("x"));
  assert.equal(counted.earliestCursor, 1);
  assert.equal(counted.tailCursor, 1025);
  assert.equal(counted.read().gap, true);

  const bounded: ScriptLog = new ScriptLog();
  bounded.append("stdout", Buffer.from("a".repeat(65536)));
  assert.equal(bounded.earliestCursor, 0);
  bounded.append("stdout", Buffer.from("b".repeat(2048)));
  assert.equal(bounded.earliestCursor, 1);
  assert.equal(bounded.tailCursor, 33);
  const gap: IScriptLogPage = bounded.read(0, 4096);
  assert.equal(gap.gap, true);
  assert.equal(gap.earliestCursor, 1);
  assert.equal(gap.nextCursor, 3);
  assert.equal(gap.hasMore, true);
  assert.equal(
    gap.entries.map((entry: IScriptLogEntry): string => entry.text).join(""),
    "a".repeat(4096),
  );
  assert.deepEqual(bounded.read(33), {
    entries: [],
    earliestCursor: 1,
    nextCursor: 33,
    gap: false,
    hasMore: false,
  });

  const before: IScriptLogPage = bounded.read();
  for (const cursor of [
    -1,
    0.5,
    34,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ])
    assert.throws((): IScriptLogPage => bounded.read(cursor), Error);
  for (const budget of [4095, 16385, 4096.5, NaN, Infinity])
    assert.throws((): IScriptLogPage => bounded.read(0, budget), Error);
  assert.deepEqual(bounded.read(), before);
  bounded.finish("stdout");
  bounded.clear();
  assert.equal(bounded.tailCursor, 33);
  assert.deepEqual(bounded.read(0), {
    entries: [],
    earliestCursor: 33,
    nextCursor: 33,
    gap: true,
    hasMore: false,
  });
}
