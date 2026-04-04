import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { redactIgnoredBlocks } from "./redactor.js";

describe("redactIgnoredBlocks", () => {
  it("passes through content with no markers", () => {
    const input = "line 1\nline 2\nline 3";
    assert.equal(redactIgnoredBlocks(input), input);
  });

  it("redacts a block between start and end markers (// style)", () => {
    const input = [
      "before",
      "// @wk-ignore-start",
      "secret line 1",
      "secret line 2",
      "// @wk-ignore-end",
      "after",
    ].join("\n");

    const result = redactIgnoredBlocks(input);
    assert.ok(result.includes("before"));
    assert.ok(result.includes("after"));
    assert.ok(!result.includes("secret"));
    assert.ok(result.includes("[redacted: 4 lines — @wk-ignore]"));
  });

  it("redacts a block with # comment style", () => {
    const input = [
      "before",
      "# @wk-ignore-start",
      "hidden = true",
      "# @wk-ignore-end",
      "after",
    ].join("\n");

    const result = redactIgnoredBlocks(input);
    assert.ok(!result.includes("hidden"));
    assert.ok(result.includes("[redacted: 3 lines — @wk-ignore]"));
  });

  it("redacts a block with HTML comment style", () => {
    const input = [
      "before",
      "<!-- @wk-ignore-start -->",
      "<div>secret</div>",
      "<!-- @wk-ignore-end -->",
      "after",
    ].join("\n");

    const result = redactIgnoredBlocks(input);
    assert.ok(!result.includes("secret"));
    assert.ok(result.includes("[redacted: 3 lines — @wk-ignore]"));
  });

  it("handles unclosed marker by redacting to EOF", () => {
    const input = [
      "before",
      "// @wk-ignore-start",
      "line 1",
      "line 2",
      "line 3",
    ].join("\n");

    const result = redactIgnoredBlocks(input);
    assert.ok(result.includes("before"));
    assert.ok(!result.includes("line 1"));
    assert.ok(result.includes("(unclosed marker)"));
    assert.ok(result.includes("[redacted: 4 lines"));
  });

  it("handles multiple separate blocks", () => {
    const input = [
      "top",
      "// @wk-ignore-start",
      "hidden1",
      "// @wk-ignore-end",
      "middle",
      "// @wk-ignore-start",
      "hidden2",
      "// @wk-ignore-end",
      "bottom",
    ].join("\n");

    const result = redactIgnoredBlocks(input);
    assert.ok(result.includes("top"));
    assert.ok(result.includes("middle"));
    assert.ok(result.includes("bottom"));
    assert.ok(!result.includes("hidden1"));
    assert.ok(!result.includes("hidden2"));
    // Two separate redaction placeholders
    const matches = result.match(/\[redacted:/g);
    assert.equal(matches?.length, 2);
  });

  it("handles single-line block (start and end on same concept)", () => {
    const input = [
      "before",
      "// @wk-ignore-start",
      "// @wk-ignore-end",
      "after",
    ].join("\n");

    const result = redactIgnoredBlocks(input);
    assert.ok(result.includes("[redacted: 2 lines — @wk-ignore]"));
  });

  it("returns empty string for empty input", () => {
    assert.equal(redactIgnoredBlocks(""), "");
  });
});
