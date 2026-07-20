import { decodeOriented } from "./preprocess";

/** Longest edge for the stored full-size image. */
export const FULL_MAX_EDGE = 2400;

/**
 * Thumbnails are sized by width, not longest edge: cards render images at
 * column width, so a tall screenshot capped by height would come out far
 * too narrow and look pixelated when stretched across a Retina column.
 */
const THUMB_MAX_WIDTH = 900;
const THUMB_MAX_HEIGHT = 2400;

export function resizeThumb(file: Blob): Promise<Blob> {
  return resizeImage(file, { maxWidth: THUMB_MAX_WIDTH, maxHeight: THUMB_MAX_HEIGHT });
}

export function resizeFull(file: Blob): Promise<Blob> {
  return resizeImage(file, { maxEdge: FULL_MAX_EDGE });
}

interface ResizeSpec {
  maxEdge?: number;
  maxWidth?: number;
  maxHeight?: number;
}

/** Resize an image file to a JPEG blob within the given bounds. */
export async function resizeImage(file: Blob, spec: ResizeSpec): Promise<Blob> {
  const bitmap = await decodeOriented(file);
  let scale = 1;
  if (spec.maxEdge) {
    scale = Math.min(scale, spec.maxEdge / Math.max(bitmap.width, bitmap.height));
  }
  if (spec.maxWidth) scale = Math.min(scale, spec.maxWidth / bitmap.width);
  if (spec.maxHeight) scale = Math.min(scale, spec.maxHeight / bitmap.height);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image encode failed"))),
      "image/jpeg",
      0.85
    );
  });
}

/**
 * One-time migration: thumbnails were originally capped at 480px on the
 * longest edge, which made tall screenshots blurry in the grid. Rebuild
 * every stored thumbnail from its full-size image at the current spec.
 */
export async function upgradeThumbnails(): Promise<void> {
  const FLAG = "inspiration.thumbs.v2";
  if (localStorage.getItem(FLAG)) return;
  const { getAllImages, putImage } = await import("./db");
  for (const image of await getAllImages()) {
    try {
      await putImage({ ...image, thumb: await resizeThumb(image.full) });
    } catch {
      // an undecodable image keeps its old thumb; never block the app on it
    }
  }
  localStorage.setItem(FLAG, "1");
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function dataURLToBlob(dataURL: string): Promise<Blob> {
  const res = await fetch(dataURL);
  return res.blob();
}
