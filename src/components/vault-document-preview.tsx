import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileWarning, Loader2 } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

// Vite fingerprints these assets; fonts and decoders are fetched only when needed.
const pdfAssets = import.meta.glob<string>(
  "/node_modules/pdfjs-dist/{standard_fonts,cmaps,wasm}/*.{pfb,ttf,bcmap,wasm,js}",
  { eager: true, query: "?url", import: "default" },
);
class VaultPdfDataFactory {
  async fetch({ kind, filename }: { kind: string; filename: string }) {
    const folder = { cMapUrl: "cmaps", standardFontDataUrl: "standard_fonts", wasmUrl: "wasm" }[
      kind
    ];
    const asset = pdfAssets[`/node_modules/pdfjs-dist/${folder}/${filename}`];
    if (!asset) throw new Error("PDF asset unavailable");
    const response = await fetch(asset);
    if (!response.ok) throw new Error("PDF asset fetch failed");
    return new Uint8Array(await response.arrayBuffer());
  }
}

/** Loaded on demand. A separate canvas per render prevents stale pages sharing a canvas. */
export default function VaultDocumentPreview({ url, title }: { url: string; title: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState(false);
  const [rendering, setRendering] = useState(true);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const frame = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let task: ReturnType<typeof import("pdfjs-dist").getDocument> | undefined;
    setPdf(null);
    setError(false);
    setPageNumber(1);
    setRendering(true);
    (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      if (disposed) return;
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      task = pdfjs.getDocument({
        url,
        isEvalSupported: false,
        useSystemFonts: true,
        useWorkerFetch: false,
        BinaryDataFactory: VaultPdfDataFactory,
      });
      task.onPassword = () => {
        if (!disposed) {
          setError(true);
          setRendering(false);
        }
        void task?.destroy();
      };
      const document = await task.promise;
      if (!disposed) setPdf(document);
    })().catch(() => {
      if (!disposed) {
        setError(true);
        setRendering(false);
      }
    });
    return () => {
      disposed = true;
      void task?.destroy();
    };
  }, [url]);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdf || !size.width || !size.height) return;
    let disposed = false;
    let task: RenderTask | undefined;
    surface.current?.replaceChildren();
    setRendering(true);
    setError(false);
    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (disposed) return;
      const original = page.getViewport({ scale: 1 });
      const scale = Math.min(size.width / original.width, size.height / original.height);
      const viewport = page.getViewport({ scale });
      const ratio = Math.min(
        window.devicePixelRatio || 1,
        2,
        Math.sqrt(3_000_000 / (viewport.width * viewport.height)),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `${title}، صفحة ${pageNumber} من ${pdf.numPages}`);
      task = page.render({
        canvas,
        viewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      });
      await task.promise;
      if (!disposed) {
        surface.current?.replaceChildren(canvas);
        setRendering(false);
      }
    })().catch(() => {
      if (!disposed) {
        setError(true);
        setRendering(false);
      }
    });
    return () => {
      disposed = true;
      task?.cancel();
    };
  }, [pdf, pageNumber, size.width, size.height, title]);

  return (
    <div className="vault-pdf-preview">
      <div ref={frame} className="vault-pdf-frame" aria-busy={rendering}>
        <div ref={surface} className="vault-pdf-surface" />
        {rendering && !error && (
          <div className="vault-media-message" role="status">
            <Loader2 className="vault-spin" size={24} />
            <span>تجهيز المعاينة…</span>
          </div>
        )}
        {error && (
          <div className="vault-media-message" role="status">
            <FileWarning size={30} />
            <strong>تعذرت معاينة ملف PDF</strong>
            <span>يمكنك استخدام «فتح» أو «تحميل» لعرض الملف كاملاً.</span>
          </div>
        )}
      </div>
      {pdf && !error && (
        <nav className="vault-pdf-pagination" aria-label="صفحات الوثيقة">
          <button
            type="button"
            aria-label="الصفحة السابقة"
            disabled={pageNumber === 1}
            onClick={() => setPageNumber((page) => Math.max(1, page - 1))}
          >
            <ChevronRight size={18} />
          </button>
          <span role="status">
            {pageNumber} / {pdf.numPages}
          </span>
          <button
            type="button"
            aria-label="الصفحة التالية"
            disabled={pageNumber === pdf.numPages}
            onClick={() => setPageNumber((page) => Math.min(pdf.numPages, page + 1))}
          >
            <ChevronLeft size={18} />
          </button>
        </nav>
      )}
    </div>
  );
}
