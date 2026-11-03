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
 * 5. Arbitrary credentials cannot reappear inside replacement text or at either replacement boundary.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercise the journal actually consumed by ScriptJob, observing decoded text, stream tags, redaction, copied pages, cursors, bounds, and refusals without child processes or replaced methods.
 * @evidence contracts/testing.md#independent-expectations Safe literal surroundings and the absence of the known credential determine redaction expectations without copying a replacement marker; the documented UTF-8 byte, entry, page, and retention bounds independently determine paging observations.
 * @evidence contracts/testing.md#distinguishing-cases Cover every byte split of multibyte and marker-colliding secrets, both replacement boundaries, incomplete token prefixes, finish ownership, exact and exceeded bounds, old and future cursors, and immutable reads; actual pipe lifecycle belongs to product validation.
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
    const visible: string = log
      .read()
      .entries.map((entry: IScriptLogEntry): string => entry.text)
      .join("");
    assert.ok(visible.startsWith("before "));
    assert.ok(visible.endsWith(" after 한🔐"));
    assert.equal(visible.includes(token), false);
    assert.equal(visible.includes("\ufffd"), false);
  }

  const collisions: readonly (readonly [string, string])[] = [
    ["A[", "AA["],
    ["]B", "]BB"],
    ["REDACTED", "REDACTED"],
    ["truncated", "truncated"],
    ["█", "██"],
    ["█\ue000", "█\ue000"],
  ];
  for (const [secret, input] of collisions) {
    const bytes: Buffer = Buffer.from(`left🧭 ${input} right한`, "utf8");
    for (let cut: number = 0; cut <= bytes.byteLength; cut++) {
      const log: ScriptLog = new ScriptLog(secret);
      log.append("stdout", bytes.subarray(0, cut));
      assert.equal(
        log
          .read()
          .entries.map((entry: IScriptLogEntry): string => entry.text)
          .join("")
          .includes(secret),
        false,
      );
      log.append("stdout", bytes.subarray(cut));
      assert.equal(
        log
          .read()
          .entries.map((entry: IScriptLogEntry): string => entry.text)
          .join("")
          .includes(secret),
        false,
      );
      log.finish("stdout");
      const visible: string = log
        .read()
        .entries.map((entry: IScriptLogEntry): string => entry.text)
        .join("");
      assert.ok(visible.startsWith("left🧭 "));
      assert.ok(visible.endsWith(" right한"));
      assert.equal(visible.includes(secret), false);
      assert.equal(visible.includes("\ufffd"), false);
      for (const entry of log.read().entries)
        assert.ok(Buffer.byteLength(entry.text, "utf8") <= 2048);
    }
  }

  const streams: ScriptLog = new ScriptLog("secret");
  streams.append("stdout", Buffer.from("out sec"));
  streams.append("stderr", Buffer.from("err secret"));
  streams.append("stdout", Buffer.from("ret!"));
  streams.finish("stdout");
  streams.finish("stderr");
  const finished: IScriptLogPage = streams.read();
  assert.deepEqual(
    finished.entries.map((entry: IScriptLogEntry): string => entry.stream),
    ["stdout", "stderr", "stdout"],
  );
  assert.deepEqual(
    finished.entries.map((entry: IScriptLogEntry): number => entry.cursor),
    [0, 1, 2],
  );
  assert.equal(finished.entries[0].text, "out ");
  assert.ok(finished.entries[1].text.startsWith("err "));
  assert.ok(finished.entries[2].text.endsWith("!"));
  assert.equal(
    finished.entries
      .map((entry: IScriptLogEntry): string => entry.text)
      .join("")
      .includes("secret"),
    false,
  );
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
