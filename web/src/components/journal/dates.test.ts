import { describe, it, expect, vi, afterEach } from "vitest";
import { parseLocalDate, relativeDayLabel, formatDayHeading } from "./dates";

describe("parseLocalDate", () => {
  it("parses a wire date as a local calendar day (no UTC shift)", () => {
    const d = parseLocalDate("2026-07-12");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // July (0-indexed)
    expect(d.getDate()).toBe(12);
  });
});

describe("relativeDayLabel", () => {
  afterEach(() => vi.useRealTimers());

  it("labels the current day 'Today'", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 12, 9, 0, 0));
    expect(relativeDayLabel("2026-07-12")).toBe("Today");
  });
  it("labels the previous day 'Yesterday'", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 12, 9, 0, 0));
    expect(relativeDayLabel("2026-07-11")).toBe("Yesterday");
  });
  it("returns null for older days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 12, 9, 0, 0));
    expect(relativeDayLabel("2026-07-05")).toBeNull();
  });
});

describe("formatDayHeading", () => {
  it("renders a human-readable heading", () => {
    expect(formatDayHeading("2026-07-12")).toContain("July");
    expect(formatDayHeading("2026-07-12")).toContain("12");
  });
});
