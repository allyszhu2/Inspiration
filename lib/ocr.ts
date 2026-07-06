import { preprocessForOcr } from "./preprocess";

/**
 * In-browser OCR via tesseract.js. The worker + language data are fetched
 * lazily on first use, so the main bundle stays light.
 *
 * Raw camera photos are unreadable to Tesseract (EXIF-rotated, huge,
 * unevenly lit), so the image is preprocessed first — see lib/preprocess.ts.
 */
export async function recognizeText(
  image: Blob,
  onProgress?: (fraction: number) => void
): Promise<string> {
  onProgress?.(0.02);
  const [cleaned, { createWorker }] = await Promise.all([
    preprocessForOcr(image),
    import("tesseract.js"),
  ]);
  onProgress?.(0.1);

  // All OCR assets are self-hosted under /tesseract (see scripts/copy-tesseract-assets.mjs),
  // so recognition needs no CDN and works offline.
  const worker = await createWorker("eng", 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract",
    langPath: "/tesseract/lang",
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(0.15 + m.progress * 0.85);
      }
    },
  });
  try {
    // Camera photos carry no DPI metadata; without this Tesseract guesses,
    // often badly enough to skip lines entirely.
    await worker.setParameters({ user_defined_dpi: "300" });
    const { data } = await worker.recognize(cleaned, {}, {
      text: true,
      blocks: true,
    });
    return cleanOcrText(filterByConfidence(data));
  } finally {
    await worker.terminate();
  }
}

/**
 * Rebuild the text from Tesseract's word tree, dropping words it wasn't
 * confident about — shadows, specks, and page edges come back as garbage
 * tokens with low confidence, while real words score high.
 */
function filterByConfidence(data: {
  text: string;
  blocks?:
    | {
        paragraphs: {
          lines: { words: { text: string; confidence: number }[] }[];
        }[];
      }[]
    | null;
}): string {
  if (!data.blocks) return data.text;
  const MIN_CONFIDENCE = 40;
  return data.blocks
    .flatMap((block) => block.paragraphs)
    .map((para) =>
      para.lines
        .map((line) =>
          line.words
            .filter((w) => w.confidence >= MIN_CONFIDENCE)
            .map((w) => w.text)
            .join(" ")
        )
        .filter(Boolean)
        .join("\n")
    )
    .filter(Boolean)
    .join("\n\n");
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
    // A "paragraph" of one or two characters is a leftover speck, not prose.
    .filter((para) => para.replace(/[^\p{L}\p{N}]/gu, "").length > 2)
    .join("\n\n");
}
