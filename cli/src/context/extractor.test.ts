import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractSection, extractTopSection } from "./extractor.js";

const SAMPLE_MD = `# Title

## Description
This is the description content.
It spans multiple lines.

## Criteria
- Criterion one
- Criterion two

### Sub Heading A
Content A here.
More content A.

### Sub Heading B
Content B here.

## Decisions
Some decisions.
`;

describe("extractSection", () => {
  it("finds ### section by heading", () => {
    const result = extractSection(SAMPLE_MD, "Sub Heading A");
    assert.notEqual(result, null);
    assert.ok(result!.includes("Content A here."));
    assert.ok(result!.includes("More content A."));
  });

  it("stops at the next ### heading", () => {
    const result = extractSection(SAMPLE_MD, "Sub Heading A");
    assert.notEqual(result, null);
    assert.ok(!result!.includes("Content B here."));
  });

  it("returns null for missing section", () => {
    const result = extractSection(SAMPLE_MD, "Nonexistent");
    assert.equal(result, null);
  });

  it("works when heading already includes ###", () => {
    const result = extractSection(SAMPLE_MD, "### Sub Heading B");
    assert.notEqual(result, null);
    assert.ok(result!.includes("Content B here."));
  });
});

describe("extractTopSection", () => {
  it("finds ## section", () => {
    const result = extractTopSection(SAMPLE_MD, "Description");
    assert.notEqual(result, null);
    assert.ok(result!.includes("This is the description content."));
  });

  it("stops at next ## section", () => {
    const result = extractTopSection(SAMPLE_MD, "Description");
    assert.notEqual(result, null);
    assert.ok(!result!.includes("Criterion one"));
  });

  it("returns null for missing section", () => {
    const result = extractTopSection(SAMPLE_MD, "Nonexistent");
    assert.equal(result, null);
  });

  it("includes ### sub-sections within the ## section", () => {
    const result = extractTopSection(SAMPLE_MD, "Criteria");
    assert.notEqual(result, null);
    assert.ok(result!.includes("Criterion one"));
    assert.ok(result!.includes("Sub Heading A"));
    assert.ok(result!.includes("Content A here."));
  });
});
