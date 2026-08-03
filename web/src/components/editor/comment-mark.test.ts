import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { CommentMark, anchorIdsInDoc, rangeHasComment } from "./comment-mark";

let editor: Editor | null = null;

function makeEditor(content: string): Editor {
  editor = new Editor({
    extensions: [StarterKit.configure({ trailingNode: false, link: false, underline: false }), CommentMark],
    content,
  });
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("CommentMark", () => {
  // The whole feature rests on this: the anchor lives in the note HTML, so it
  // has to survive every parse/serialize round trip the content makes.
  it("round-trips data-comment-id through parse and serialize", () => {
    const html = '<p>before <mark data-comment-id="anchor-1">highlighted</mark> after</p>';
    const out = makeEditor(html).getHTML();

    expect(out).toContain('data-comment-id="anchor-1"');
    expect(out).toContain("highlighted");
  });

  it("does not adopt a plain <mark> as a comment anchor", () => {
    // Pasting highlighted text from a web page must not create a dangling
    // anchor that opens an empty thread.
    const ed = makeEditor("<p>a <mark>pasted highlight</mark> b</p>");
    expect(anchorIdsInDoc(ed)).toEqual([]);
  });

  it("reports anchors in document order", () => {
    const ed = makeEditor(
      '<p><mark data-comment-id="second-written">one</mark></p>' +
        '<p><mark data-comment-id="first-written">two</mark></p>'
    );
    expect(anchorIdsInDoc(ed)).toEqual(["second-written", "first-written"]);
  });

  it("setComment marks the selection and unsetCommentById removes exactly that anchor", () => {
    const ed = makeEditor(
      '<p><mark data-comment-id="keep">aaa</mark> <mark data-comment-id="drop">bbb</mark></p>'
    );
    expect(anchorIdsInDoc(ed)).toEqual(["keep", "drop"]);

    ed.commands.unsetCommentById("drop");

    expect(anchorIdsInDoc(ed)).toEqual(["keep"]);
    expect(ed.getHTML()).toContain('data-comment-id="keep"');
    expect(ed.getHTML()).not.toContain('data-comment-id="drop"');
    // Only the highlight goes — the text it covered stays put.
    expect(ed.getText()).toContain("bbb");
  });

  it("unsetCommentById reports false when the anchor is not in the document", () => {
    const ed = makeEditor("<p>no highlights here</p>");
    expect(ed.commands.unsetCommentById("missing")).toBe(false);
  });

  it("rangeHasComment detects an existing highlight so overlaps can be refused", () => {
    const ed = makeEditor('<p>ab<mark data-comment-id="x">cd</mark>ef</p>');
    const size = ed.state.doc.content.size;

    expect(rangeHasComment(ed, 1, size - 1)).toBe(true);
    // The trailing "ef" alone carries no mark.
    expect(rangeHasComment(ed, size - 3, size - 1)).toBe(false);
  });

  // inclusive:false is what stops a highlight silently swallowing new prose and
  // drifting away from the quoted text stored on the comment row.
  it("does not extend the highlight when typing at its trailing edge", () => {
    const ed = makeEditor('<p><mark data-comment-id="a">word</mark></p>');
    // End of "word" — position 1 is the paragraph start, +4 for the text.
    ed.commands.setTextSelection(5);
    ed.commands.insertContent("XY");

    const html = ed.getHTML();
    expect(html).toContain(">word</mark>");
    expect(html).not.toContain(">wordXY</mark>");
  });

  it("pending ranges are decorations only, so they never touch the document", () => {
    const ed = makeEditor("<p>some text here</p>");
    const before = ed.getHTML();

    ed.commands.setPendingComment(1, 5);

    expect(ed.getHTML()).toBe(before);
    expect(anchorIdsInDoc(ed)).toEqual([]);
  });

  it("resolve and active state never rewrite the note HTML", () => {
    const ed = makeEditor('<p><mark data-comment-id="a">x</mark></p>');
    const before = ed.getHTML();

    ed.commands.setResolvedComments(["a"]);
    ed.commands.setActiveComment("a");

    expect(ed.getHTML()).toBe(before);
  });
});
