import { describe, it, expect } from "vitest";
import { shouldRedirectToToday, shouldRedirectToHome } from "./redirect";
import type { JournalDay } from "@/types";

const day: JournalDay = {
  id: "d1",
  date: "2026-07-12",
  itemCount: 1,
  totalWords: 3,
  items: [],
};

describe("shouldRedirectToToday (/journal home)", () => {
  it("redirects into the day view when a day exists for today", () => {
    expect(shouldRedirectToToday(day, false)).toBe(true);
  });
  it("does not redirect while the query is still loading", () => {
    expect(shouldRedirectToToday(undefined, false)).toBe(false);
  });
  it("does not redirect when there is no day for today", () => {
    expect(shouldRedirectToToday(null, false)).toBe(false);
  });
  it("stays on home when the user deliberately came back (forceHome)", () => {
    expect(shouldRedirectToToday(day, true)).toBe(false);
  });
});

describe("shouldRedirectToHome (/journal/today)", () => {
  it("bounces to home when there is no entry today", () => {
    expect(shouldRedirectToHome(null, false)).toBe(true);
  });
  it("stays while loading", () => {
    expect(shouldRedirectToHome(undefined, true)).toBe(false);
  });
  it("stays when a day exists", () => {
    expect(shouldRedirectToHome(day, false)).toBe(false);
  });
});
