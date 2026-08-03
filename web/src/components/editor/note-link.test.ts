import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { NoteLink, noteLinkIdsInDoc } from "./note-link";
import { sanitizeHtml } from "@/lib/utils";

let editor: Editor | null = null;

// `withTextStyle` mirrors the real editor, which registers TextStyle everywhere
// and so has a competing bare `span` parse rule.
function makeEditor(content: string, withTextStyle = true): Editor {
  editor = new Editor({
    extensions: [
      StarterKit.configure({ trailingNode: false, link: false, underline: false }),
      ...(withTextStyle ? [TextStyle] : []),
      NoteLink,
    ],
    content,
  });
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

const link = (id: string, label = "Some note") =>
  `<p>see <span data-note-link-id="${id}">${label}</span> for more</p>`;

describe("NoteLink", () => {
  it("round-trips the target id and label through parse and serialize", () => {
    const out = makeEditor(link("abc-123", "Chapter 3")).getHTML();

    expect(out).toContain('data-note-link-id="abc-123"');
    expect(out).toContain("Chapter 3");
  });

  it("does not adopt an ordinary span as a note link", () => {
    // Pasting styled text from elsewhere must not create a link to nothing.
    const ed = makeEditor('<p>a <span>plain</span> <span style="color:red">red</span> b</p>');
    expect(noteLinkIdsInDoc(ed)).toEqual([]);
  });

  it("reports linked note ids in document order", () => {
    const ed = makeEditor(
      `<p><span data-note-link-id="second">b</span></p>` +
        `<p><span data-note-link-id="first">a</span></p>`,
    );
    expect(noteLinkIdsInDoc(ed)).toEqual(["second", "first"]);
  });

  it("removeNoteLinkById removes only the matching link", () => {
    const ed = makeEditor(
      `<p><span data-note-link-id="keep">K</span> and ` +
        `<span data-note-link-id="drop">D</span> end</p>`,
    );
    expect(noteLinkIdsInDoc(ed)).toEqual(["keep", "drop"]);

    expect(ed.commands.removeNoteLinkById("drop")).toBe(true);

    expect(noteLinkIdsInDoc(ed)).toEqual(["keep"]);
    // The prose around the removed chip is untouched.
    expect(ed.getText()).toContain("and");
    expect(ed.getText()).toContain("end");
  });

  it("removeNoteLinkById reports false when the link is not present", () => {
    const ed = makeEditor("<p>no links here</p>");
    expect(ed.commands.removeNoteLinkById("nope")).toBe(false);
  });

  it("insertNoteLink adds a chip plus a trailing text position", () => {
    const ed = makeEditor("<p>start</p>");
    ed.commands.setTextSelection(6);
    ed.commands.insertNoteLink({ targetId: "new-1", label: "Fresh note" });

    expect(noteLinkIdsInDoc(ed)).toEqual(["new-1"]);
    expect(ed.getHTML()).toContain("Fresh note");
  });

  it("falls back to 'Untitled note' when the target has no title yet", () => {
    // A freshly created sub-note has no title until its first block is written.
    const ed = makeEditor("<p>x</p>");
    ed.commands.insertNoteLink({ targetId: "blank-1", label: "" });
    expect(ed.getHTML()).toContain("Untitled note");
  });

  it("keeps a missing-target link in the document and flags it", () => {
    const ed = makeEditor(
      `<p><span data-note-link-id="gone" data-note-link-missing="true">Ghost</span></p>`,
    );
    const out = ed.getHTML();

    // The text stays so the sentence the user wrote still reads.
    expect(out).toContain("Ghost");
    expect(out).toContain('data-note-link-missing="true"');
  });

  // This is the assertion that pins the <span>-over-<a> decision. sanitizeHtml
  // stamps target="_blank" onto every <a href>, which on a read-only grid card
  // would open a new tab and full-reload the SPA. If someone switches the node
  // to an anchor, this fails.
  it("survives sanitizeHtml with no target attribute added", () => {
    const rendered = makeEditor(link("xyz-9", "Linked note")).getHTML();
    const clean = sanitizeHtml(rendered);

    expect(clean).toContain('data-note-link-id="xyz-9"');
    expect(clean).toContain("Linked note");
    expect(clean).not.toContain("target=");
    expect(clean).not.toContain("<a ");
  });

  // The compact journal composer round-trips note HTML but has no slash command.
  // If the node were gated to full editors, it would be silently dropped there.
  it("round-trips in an editor with no authoring extensions registered", () => {
    const ed = makeEditor(link("compact-1", "Kept"), false);
    expect(ed.getHTML()).toContain('data-note-link-id="compact-1"');
    expect(noteLinkIdsInDoc(ed)).toEqual(["compact-1"]);
  });
});
