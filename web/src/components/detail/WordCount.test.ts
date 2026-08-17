import { describe, it, expect } from "vitest";
import { countWords } from "./WordCount";

describe("countWords", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("the quick brown fox")).toBe(4);
  });

  it("treats an empty or whitespace-only note as zero", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   \n\t  ")).toBe(0);
  });

  it("does not inflate the count on runs of whitespace", () => {
    // getText() joins blocks with newlines, so this is the common shape.
    expect(countWords("first line\n\nsecond   line")).toBe(4);
  });

  it("ignores leading and trailing whitespace", () => {
    expect(countWords("  hello world  ")).toBe(2);
  });

  it("counts punctuation-attached tokens once", () => {
    expect(countWords("Hello, world! It's fine.")).toBe(4);
  });
});
