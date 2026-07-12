import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { JournalDayCard } from "@/types";

// Controllable mock state for the journal hooks.
const state = vi.hoisted(() => ({
  days: [] as JournalDayCard[],
  isLoading: false,
}));

vi.mock("@/hooks/useJournal", () => ({
  useJournalDays: () => ({ data: state.days, isLoading: state.isLoading }),
  useCreateJournalItem: () => ({ mutate: vi.fn(), isPending: false }),
  useJournalPreferences: () => ({ data: {} }),
  useJournalTemplates: () => ({ data: [] }),
}));

import { JournalHome } from "./JournalHome";

describe("JournalHome", () => {
  beforeEach(() => {
    state.days = [];
    state.isLoading = false;
  });

  it("shows the write-today action and the empty state with no days", () => {
    render(<JournalHome onEnterToday={() => {}} />);
    expect(screen.getByText(/write today/i)).toBeInTheDocument();
    expect(screen.getByText(/no entries yet/i)).toBeInTheDocument();
  });

  it("renders day cards with counts from the API", () => {
    state.days = [
      {
        id: "d1",
        date: "2026-07-01",
        itemCount: 2,
        totalWords: 40,
        latestItem: { id: "i1", title: "Study log", contentPreview: "hi" },
      },
    ];
    render(<JournalHome onEnterToday={() => {}} />);
    expect(screen.getByText(/2 entries/i)).toBeInTheDocument();
    expect(screen.getByText(/40 words/i)).toBeInTheDocument();
    expect(screen.getByText("Study log")).toBeInTheDocument();
    expect(screen.queryByText(/no entries yet/i)).not.toBeInTheDocument();
  });
});
