// Shims for @tiptap/extension-collaboration and @tiptap/y-tiptap (the yjs
// binding, formerly imported as y-prosemirror in v2).
//
// @tiptap/extension-drag-handle statically imports a handful of symbols from
// the yjs/collaboration stack, but only uses them on the collaborative code
// path: `isChangeOrigin(tr)` gates the y-sync branch, and the position-mapping
// helpers bail out early whenever `ySyncPluginKey.getState(state)` is falsy.
// This app has no realtime collaboration, so that state is always absent and
// none of the real logic ever runs. Aliasing the two packages to these shims
// (see vite.config.ts / vitest.config.ts) keeps the ~100KB yjs stack out of the
// bundle while satisfying the imports.

import { PluginKey } from "@tiptap/pm/state";

// --- @tiptap/extension-collaboration ---
// A change "origin" is a remote yjs sync transaction; with no collab, never.
export function isChangeOrigin(): boolean {
  return false;
}

// --- y-prosemirror ---
// A plugin key that is never registered, so `.getState(state)` returns
// undefined and the drag-handle's collab position mapping short-circuits.
export const ySyncPluginKey = new PluginKey("y-sync");

export function absolutePositionToRelativePosition(): unknown {
  return null;
}

export function relativePositionToAbsolutePosition(): number {
  return 0;
}
