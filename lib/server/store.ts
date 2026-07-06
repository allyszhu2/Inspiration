/**
 * Server-side storage for sync. On Vercel this is Vercel Blob (the only
 * integration to set up); during local development it falls back to a
 * .sync-data/ directory so the whole flow works without any cloud config.
 *
 * Layout:
 *   cards/<id>/<updatedAt>.json — one file per card version. Unique paths
 *     sidestep CDN caching of overwrites; older versions are pruned after
 *     each write, and the largest <updatedAt> wins (last write wins).
 *   images/<imageId>/full.jpg, images/<imageId>/thumb.jpg — immutable.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Card } from "@/lib/types";

const FS_ROOT = path.join(process.cwd(), ".sync-data");

export function checkPasscode(req: Request): boolean {
  const expected = process.env.SYNC_PASSCODE || "ally";
  const got = req.headers.get("x-sync-passcode") || "";
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export function storeMode(): "blob" | "fs" | "none" {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (!process.env.VERCEL) return "fs";
  return "none";
}

export const isValidId = (id: string) => /^[a-z0-9-]{4,64}$/i.test(id);
export const isValidKind = (k: string): k is "full" | "thumb" =>
  k === "full" || k === "thumb";

async function blobSdk() {
  return import("@vercel/blob");
}

// ————— Cards —————

export async function writeCard(card: Card): Promise<void> {
  const pathname = `cards/${card.id}/${card.updatedAt}.json`;
  const body = JSON.stringify(card);
  if (storeMode() === "blob") {
    const { put, list, del } = await blobSdk();
    await put(pathname, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    const { blobs } = await list({ prefix: `cards/${card.id}/` });
    const stale = blobs.filter((b) => b.pathname !== pathname).map((b) => b.url);
    if (stale.length) await del(stale);
  } else {
    const dir = path.join(FS_ROOT, "cards", card.id);
    await fs.mkdir(dir, { recursive: true });
    const existing = await fs.readdir(dir);
    await fs.writeFile(path.join(dir, `${card.updatedAt}.json`), body);
    for (const f of existing) {
      if (f !== `${card.updatedAt}.json`) {
        await fs.rm(path.join(dir, f), { force: true });
      }
    }
  }
}

/**
 * All cards whose latest version reached the server after `since` (server
 * upload time, so device clock skew can't cause missed pulls).
 */
export async function listCardsSince(since: number): Promise<Card[]> {
  if (storeMode() === "blob") {
    const { list } = await blobSdk();
    const blobs = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: "cards/", cursor });
      blobs.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    const latest = new Map<string, { url: string; version: number; touched: number }>();
    for (const b of blobs) {
      const m = b.pathname.match(/^cards\/([^/]+)\/(\d+)\.json$/);
      if (!m) continue;
      const version = Number(m[2]);
      const uploaded = new Date(b.uploadedAt).getTime();
      const cur = latest.get(m[1]);
      const touched = Math.max(uploaded, cur?.touched ?? 0);
      if (!cur || version > cur.version) {
        latest.set(m[1], { url: b.url, version, touched });
      } else {
        cur.touched = touched;
      }
    }
    const changed = [...latest.values()].filter((e) => e.touched > since);
    return Promise.all(
      changed.map(async (e) => (await fetch(e.url)).json() as Promise<Card>)
    );
  }

  const dir = path.join(FS_ROOT, "cards");
  const ids = await fs.readdir(dir).catch(() => [] as string[]);
  const out: Card[] = [];
  for (const id of ids) {
    const cardDir = path.join(dir, id);
    const files = await fs.readdir(cardDir).catch(() => [] as string[]);
    let best: { file: string; version: number } | null = null;
    let touched = 0;
    for (const f of files) {
      const m = f.match(/^(\d+)\.json$/);
      if (!m) continue;
      const stat = await fs.stat(path.join(cardDir, f));
      touched = Math.max(touched, stat.mtimeMs);
      const version = Number(m[1]);
      if (!best || version > best.version) best = { file: f, version };
    }
    if (best && touched > since) {
      out.push(JSON.parse(await fs.readFile(path.join(cardDir, best.file), "utf8")));
    }
  }
  return out;
}

// ————— Images —————

export async function putImage(
  imageId: string,
  kind: "full" | "thumb",
  data: ArrayBuffer,
  contentType: string
): Promise<void> {
  if (storeMode() === "blob") {
    const { put } = await blobSdk();
    await put(`images/${imageId}/${kind}.jpg`, data, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
    });
  } else {
    const dir = path.join(FS_ROOT, "images", imageId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${kind}.jpg`), Buffer.from(data));
  }
}

/** Returns a redirect URL (blob) or raw bytes (fs), or null if absent. */
export async function getImage(
  imageId: string,
  kind: "full" | "thumb"
): Promise<{ url: string } | { data: Buffer } | null> {
  if (storeMode() === "blob") {
    const { list } = await blobSdk();
    const { blobs } = await list({ prefix: `images/${imageId}/${kind}.jpg` });
    return blobs.length ? { url: blobs[0].url } : null;
  }
  try {
    const data = await fs.readFile(path.join(FS_ROOT, "images", imageId, `${kind}.jpg`));
    return { data };
  } catch {
    return null;
  }
}

export async function deleteImages(imageId: string): Promise<void> {
  if (storeMode() === "blob") {
    const { list, del } = await blobSdk();
    const { blobs } = await list({ prefix: `images/${imageId}/` });
    if (blobs.length) await del(blobs.map((b) => b.url));
  } else {
    await fs.rm(path.join(FS_ROOT, "images", imageId), {
      recursive: true,
      force: true,
    });
  }
}
