import { describe, it, expect } from "vitest";
import { groupThreads } from "./useComments";
import type { NoteComment } from "@/types";

let seq = 0;
function comment(over: Partial<NoteComment> & { anchorId: string }): NoteComment {
  seq += 1;
  return {
    id: `c${seq}`,
    itemId: "item-1",
    isThreadRoot: false,
    quotedText: "",
    userId: "u1",
    content: "text",
    resolvedAt: null,
    resolvedBy: null,
    // Ordering within a thread is by createdAt, so keep these monotonic.
    createdAt: `2026-01-01T00:00:${String(seq).padStart(2, "0")}Z`,
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("groupThreads", () => {
  it("groups by anchor, keeping the root separate from its replies", () => {
    const root = comment({ anchorId: "a", isThreadRoot: true, quotedText: "hello" });
    const reply = comment({ anchorId: "a", content: "me too" });

    const [thread] = groupThreads([reply, root], ["a"]);

    expect(thread.root.id).toBe(root.id);
    expect(thread.replies.map((r) => r.id)).toEqual([reply.id]);
    expect(thread.quotedText).toBe("hello");
    expect(thread.detached).toBe(false);
  });

  it("orders threads by their position in the document, not by creation time", () => {
    // Written second but highlighted earlier in the note.
    const later = comment({ anchorId: "second", isThreadRoot: true });
    const earlier = comment({ anchorId: "first", isThreadRoot: true });

    const threads = groupThreads([later, earlier], ["first", "second"]);

    expect(threads.map((t) => t.anchorId)).toEqual(["first", "second"]);
  });

  it("marks threads whose anchor is gone from the note as detached and sorts them last", () => {
    const live = comment({ anchorId: "live", isThreadRoot: true });
    const gone = comment({ anchorId: "gone", isThreadRoot: true, quotedText: "deleted text" });

    const threads = groupThreads([gone, live], ["live"]);

    expect(threads.map((t) => t.anchorId)).toEqual(["live", "gone"]);
    expect(threads[0].detached).toBe(false);
    expect(threads[1].detached).toBe(true);
    // The quoted passage is what makes a detached thread recoverable.
    expect(threads[1].quotedText).toBe("deleted text");
  });

  it("carries the root's resolve state to the thread", () => {
    const root = comment({
      anchorId: "a",
      isThreadRoot: true,
      resolvedAt: "2026-01-02T00:00:00Z",
    });

    const [thread] = groupThreads([root], ["a"]);

    expect(thread.resolvedAt).toBe("2026-01-02T00:00:00Z");
  });
});
