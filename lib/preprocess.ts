/**
 * Image preprocessing for OCR. Phone photos of book pages arrive rotated
 * (EXIF), huge, and unevenly lit — all of which wreck Tesseract. This
 * produces the clean input it needs: orientation-corrected, downscaled,
 * grayscaled, and adaptively thresholded to pure black-on-white.
 */

/** Longest edge fed to the OCR engine. Bigger is slower, not more accurate. */
const OCR_MAX_EDGE = 2000;

/**
 * Decode a photo with EXIF orientation applied. Camera photos are stored
 * sideways with a rotation flag; Tesseract's decoder ignores the flag, so
 * we must bake the rotation in here. Older Safari doesn't accept the
 * imageOrientation option — fall back to plain decode.
 */
export async function decodeOriented(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return createImageBitmap(file);
  }
}

/**
 * Bradley adaptive threshold: each pixel is compared against the mean of a
 * window around it (via an integral image), so page shadows and uneven
 * lighting don't smear the text the way a single global threshold would.
 */
function adaptiveThreshold(
  gray: Uint8ClampedArray,
  width: number,
  height: number
): void {
  const integral = new Uint32Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += gray[y * width + x];
      integral[(y + 1) * (width + 1) + (x + 1)] =
        integral[y * (width + 1) + (x + 1)] + rowSum;
    }
  }

  const half = Math.max(8, Math.floor(Math.min(width, height) / 16));
  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - half);
    const y2 = Math.min(height - 1, y + half);
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - half);
      const x2 = Math.min(width - 1, x + half);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        integral[(y2 + 1) * (width + 1) + (x2 + 1)] -
        integral[y1 * (width + 1) + (x2 + 1)] -
        integral[(y2 + 1) * (width + 1) + x1] +
        integral[y1 * (width + 1) + x1];
      // 12% below the local mean → ink; otherwise paper.
      gray[y * width + x] =
        gray[y * width + x] * count <= sum * 0.88 ? 0 : 255;
    }
  }
}

/**
 * Remove salt-and-pepper specks left by thresholding sensor noise: a black
 * pixel with at most one black neighbor is noise, not ink.
 */
function despeckle(
  gray: Uint8ClampedArray,
  width: number,
  height: number
): void {
  const src = new Uint8ClampedArray(gray);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (src[i] !== 0) continue;
      let black = 0;
      black += src[i - width - 1] === 0 ? 1 : 0;
      black += src[i - width] === 0 ? 1 : 0;
      black += src[i - width + 1] === 0 ? 1 : 0;
      black += src[i - 1] === 0 ? 1 : 0;
      black += src[i + 1] === 0 ? 1 : 0;
      black += src[i + width - 1] === 0 ? 1 : 0;
      black += src[i + width] === 0 ? 1 : 0;
      black += src[i + width + 1] === 0 ? 1 : 0;
      if (black <= 1) gray[i] = 255;
    }
  }
}

/** Produce the cleaned black-and-white image Tesseract actually reads. */
export async function preprocessForOcr(file: Blob): Promise<Blob> {
  const bitmap = await decodeOriented(file);
  const scale = Math.min(1, OCR_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, w, h);
  const rgba = imageData.data;
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] =
      0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  }

  adaptiveThreshold(gray, w, h);
  despeckle(gray, w, h);

  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = gray[i];
    rgba[i * 4 + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encode failed"))),
      "image/png"
    );
  });
}
