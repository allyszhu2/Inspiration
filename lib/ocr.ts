/**
 * In-browser OCR via tesseract.js. The worker + language data are fetched
 * lazily on first use, so the main bundle stays light.
 */
export async function recognizeText(
  image: Blob,
  onProgress?: (fraction: number) => void
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  // All OCR assets are self-hosted under /tesseract (see scripts/copy-tesseract-assets.mjs),
  // so recognition needs no CDN and works offline.
  const worker = await createWorker("eng", 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract",
    langPath: "/tesseract/lang",
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(m.progress);
      }
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return cleanOcrText(data.text);
  } finally {
    await worker.terminate();
  }
}

/**
 * Book-page cleanup: rejoin words hyphenated across line breaks and unwrap
 * hard-wrapped lines into paragraphs, keeping true paragraph breaks.
 */
export function cleanOcrText(raw: string): string {
  return raw
    .replace(/-\n(?=\S)/g, "")
    .split(/\n{2,}/)
    .map((para) => para.replace(/\n/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}
