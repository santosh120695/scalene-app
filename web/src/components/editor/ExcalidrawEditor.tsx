import { useRef } from "react";
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";

interface SceneData {
  elements: readonly unknown[];
  appState: Record<string, unknown>;
}

interface Props {
  initialData?: SceneData;
  onSave: (data: { sceneData: SceneData; thumbnail: string }) => void;
}

const AUTOSAVE_DELAY_MS = 800;

// Excalidraw's live AppState carries session/collaboration-only fields
// (collaborators: Map, followedBy: Set, fileHandle, ...) that don't survive a
// JSON round-trip to the backend and back — a Map serializes to "{}" over the
// wire, and Excalidraw crashes trying to .forEach() that plain object on the
// next load. Only persist the handful of fields worth restoring.
const PERSISTED_APP_STATE_KEYS = [
  "viewBackgroundColor",
  "scrollX",
  "scrollY",
  "zoom",
  "gridSize",
  "gridStep",
  "gridModeEnabled",
] as const;

function pickPersistedAppState(
  appState: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  if (!appState) return picked;
  for (const key of PERSISTED_APP_STATE_KEYS) {
    if (key in appState) picked[key] = appState[key];
  }
  return picked;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Full-page Excalidraw canvas with debounced autosave — analogous to
// RichTextEditor's onBlur save, but Excalidraw has no blur event so we debounce
// onChange instead.
export function ExcalidrawEditor({ initialData, onSave }: Props) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  async function save() {
    const api = apiRef.current;
    if (!api) return;
    const elements = api.getSceneElements();
    const appState = api.getAppState();
    const sceneData: SceneData = {
      elements,
      appState: pickPersistedAppState(appState),
    };

    let thumbnail = "";
    if (elements.length > 0) {
      const blob = await exportToBlob({
        elements,
        appState,
        files: api.getFiles(),
        mimeType: "image/png",
        getDimensions: () => ({ width: 400, height: 300 }),
      });
      thumbnail = await blobToDataUrl(blob);
    }
    onSave({ sceneData, thumbnail });
  }

  function scheduleSave() {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, AUTOSAVE_DELAY_MS);
  }

  return (
    <div className="h-full w-full">
      <Excalidraw
        excalidrawAPI={(api) => (apiRef.current = api)}
        initialData={{
          elements: initialData?.elements as never,
          appState: pickPersistedAppState(initialData?.appState) as never,
        }}
        onChange={scheduleSave}
      />
    </div>
  );
}
