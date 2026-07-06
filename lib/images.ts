import { decodeOriented } from "./preprocess";

/** Resize an image file to a JPEG blob whose longest edge is `maxEdge` px. */
export async function resizeImage(file: Blob, maxEdge: number): Promise<Blob> {
  const bitmap = await decodeOriented(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
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
