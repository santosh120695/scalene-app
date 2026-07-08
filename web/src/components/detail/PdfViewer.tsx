import { PDFViewer, ZoomMode } from "@embedpdf/react-pdf-viewer";

// EmbedPDF ships a complete viewer (toolbar, sidebar, thumbnails, search) and
// renders with PDFium/WASM under the hood — no pdf.js worker or cmap assets to
// wire up. It fills its parent, which must provide an explicit height.
export function PdfViewer({ url }: { url: string }) {
  return (
    <div className="h-full overflow-hidden bg-surface-sunken">
      <PDFViewer
        style={{ width: "100%", height: "100%" }}
        config={{
          src: url,
          // Fit the page to the viewer width by default so it fills the pane
          // instead of rendering at a fixed scale with side gutters.
          zoom: { defaultZoomLevel: ZoomMode.FitWidth },
          // Follow the app's light/dark mode, with the Warm Scholar accent.
          theme: {
            preference: "system",
            light: { accent: { primary: "#059669" } },
            dark: { accent: { primary: "#34d399" } },
          },
        }}
      />
    </div>
  );
}
