import { useCallback, useEffect, useRef } from "react";
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

// The item model stores an Excalidraw scene as `{ elements, appState }`, plus a
// base64 PNG `thumbnail` for the card preview. We keep those exact props so
// ItemDetailView's drawing pane, the API, and the card body are unchanged.
interface SceneData {
  elements: readonly unknown[];
  appState: Record<string, unknown>;
}

interface Props {
  initialData?: SceneData;
  onSave: (data: { sceneData: SceneData; thumbnail: string }) => void;
}

// Minimal shape of the fields we read off Excalidraw elements.
type ElementLike = { version?: number; isDeleted?: boolean };

const AUTOSAVE_DELAY_MS = 800;
const THUMBNAIL_MAX_PX = 512;

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// A cheap signature that changes when the scene content changes (elements added,
// removed, or edited — Excalidraw bumps each element's `version` on edit) but
// NOT on pure pan/zoom. Lets us skip saves that wouldn't change anything.
function signature(elements: readonly ElementLike[]): string {
  let v = 0;
  for (const el of elements) v += el.version ?? 0;
  return `${elements.length}:${v}`;
}

export function ExcalidrawEditor({ initialData, onSave }: Props) {
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastSig = useRef<string | null>(null);
  const didInit = useRef(false);

  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const handleChange = useCallback(
    (elements: readonly ElementLike[], appState: unknown, files: unknown) => {
      const live = elements.filter((el) => !el.isDeleted);
      const sig = signature(live);

      // Excalidraw fires onChange once on mount with the restored scene. Record
      // that as the baseline and don't save it — so opening a drawing (including
      // a legacy one whose elements Excalidraw can't restore) never clobbers it.
      if (!didInit.current) {
        didInit.current = true;
        lastSig.current = sig;
        return;
      }
      if (sig === lastSig.current) return; // nothing meaningful changed
      lastSig.current = sig;

      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        let thumbnail = "";
        if (live.length > 0) {
          try {
            const blob = await exportToBlob({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              elements: live as any,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              appState: {
                ...(appState as Record<string, unknown>),
                exportBackground: true,
                viewBackgroundColor: "#ffffff",
              } as any,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              files: files as any,
              mimeType: "image/png",
              maxWidthOrHeight: THUMBNAIL_MAX_PX,
              exportPadding: 16,
            });
            thumbnail = await blobToDataURL(blob);
          } catch {
            thumbnail = "";
          }
        }
        onSave({
          sceneData: { elements: live, appState: {} },
          thumbnail,
        });
      }, AUTOSAVE_DELAY_MS);
    },
    [onSave],
  );

  return (
    <div className="h-full w-full">
      <Excalidraw
        theme={isDark ? "dark" : "light"}
        initialData={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          elements: (initialData?.elements ?? []) as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          appState: (initialData?.appState ?? {}) as any,
          scrollToContent: true,
        }}
        onChange={handleChange}
      />
    </div>
  );
}
