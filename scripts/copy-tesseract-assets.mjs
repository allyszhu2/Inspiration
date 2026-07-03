// Copies tesseract.js worker, core wasm builds, and English language data
// from node_modules into public/ so OCR is fully self-hosted (no CDN).
// Runs automatically before `next build` and `next dev`.
import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "public", "tesseract");
mkdirSync(join(dest, "lang"), { recursive: true });

cpSync(
  join(root, "node_modules", "tesseract.js", "dist", "worker.min.js"),
  join(dest, "worker.min.js")
);

const coreDir = join(root, "node_modules", "tesseract.js-core");
for (const f of readdirSync(coreDir)) {
  if (f.startsWith("tesseract-core")) {
    cpSync(join(coreDir, f), join(dest, f));
  }
}

cpSync(
  join(root, "node_modules", "@tesseract.js-data", "eng", "4.0.0", "eng.traineddata.gz"),
  join(dest, "lang", "eng.traineddata.gz")
);

console.log("tesseract assets copied to public/tesseract");
