import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Loader2 } from "lucide-react";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// Serve the pdf.js worker as a bundled asset (Vite-friendly).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const options = {
  cMapUrl: "/cmaps/",
  cMapPacked: true,
};

export function PdfViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [width, setWidth] = useState(600);
  const [error, setError] = useState(false);

  // Track the container width so pages render crisp and fit the column.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(Math.min(el.clientWidth, 1200));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="scroll-thin flex max-h-[78vh] flex-col items-center gap-4 overflow-y-auto border-0 border-[var(--border)] bg-surface-sunken px-0 sm:rounded-xl sm:border sm:p-4"
    >
      {error ? (
        <div className="flex flex-col items-center gap-2 py-10 text-[13px] text-ink-muted">
          <p>Couldn't render this PDF.</p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-brand hover:underline"
          >
            Open it in a new tab
          </a>
        </div>
      ) : (
        <Document
          file={url}
          options={options}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          onLoadError={() => setError(true)}
          loading={
            <div className="flex items-center gap-2 py-10 text-[13px] text-ink-muted">
              <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />{" "}
              Loading PDF…
            </div>
          }
        >
          {Array.from({ length: numPages }, (_, i) => (
            <Page
              key={i}
              pageNumber={i + 1}
              width={width}
              className="mb-4 overflow-hidden shadow-none [&:last-child]:mb-0 sm:rounded-md sm:shadow-item"
              renderTextLayer
              renderAnnotationLayer
            />
          ))}
        </Document>
      )}
    </div>
  );
}
