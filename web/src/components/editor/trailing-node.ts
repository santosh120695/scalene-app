import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as PMNode, NodeType } from "@tiptap/pm/model";

// Keeps the document ending with an empty paragraph so there's always a spot to
// place the cursor and keep writing after a trailing block node (an image or a
// table would otherwise be the last thing in the doc, with nowhere to click).
export const TrailingNode = Extension.create({
  name: "trailingNode",

  addOptions() {
    return {
      node: "paragraph",
      // Don't append when the doc already ends with one of these.
      notAfter: ["paragraph"],
    };
  },

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey<boolean>(this.name);
    const notAfter = this.options.notAfter as string[];
    const disabled = Object.values(this.editor.schema.nodes).filter((n) =>
      notAfter.includes(n.name),
    );
    const nodeName = this.options.node as string;

    return [
      new Plugin<boolean>({
        key: pluginKey,
        appendTransaction: (_transactions, _oldState, state) => {
          if (!pluginKey.getState(state)) return;
          const type = state.schema.nodes[nodeName];
          if (!type) return;
          return state.tr.insert(state.doc.content.size, type.create());
        },
        state: {
          init: (_, state) => shouldInsert(state.doc.lastChild, disabled),
          apply: (tr, value) =>
            tr.docChanged ? shouldInsert(tr.doc.lastChild, disabled) : value,
        },
      }),
    ];
  },
});

// A trailing node should be inserted when the doc's last child is NOT one of the
// allowed trailing types (i.e. not already a paragraph).
function shouldInsert(last: PMNode | null, disabled: NodeType[]): boolean {
  if (!last) return true;
  return !disabled.some((t) => t === last.type);
}
