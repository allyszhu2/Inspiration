/**
 * Client sync engine. IndexedDB remains the source of truth for the UI
 * (instant, offline); this pushes locally-changed cards to the server and
 * merges remote changes back, last-write-wins by updatedAt.
 */
import * as db from "./db";
import type { Card } from "./types";

const KEY_PASSCODE = "inspiration.sync.passcode";
const KEY_LAST = "inspiration.sync.last";
const KEY_PENDING = "inspiration.sync.pending";
const KEY_IMAGES = "inspiration.sync.images";

function readSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<string>): void {
  localStorage.setItem(key, JSON.stringify([...set]));
}

export function getPasscode(): string {
  return localStorage.getItem(KEY_PASSCODE) || "";
}

export function isSyncEnabled(): boolean {
  return getPasscode() !== "";
}

export function enableSync(passcode: string): void {
  localStorage.setItem(KEY_PASSCODE, passcode);
}

export function disableSync(): void {
  localStorage.removeItem(KEY_PASSCODE);
  localStorage.removeItem(KEY_LAST);
}

export function lastSyncedAt(): number {
  return Number(localStorage.getItem(KEY_LAST) || 0);
}

/** Call whenever a card changes locally so the next sync pushes it. */
export function markPending(cardId: string): void {
  const pending = readSet(KEY_PENDING);
  pending.add(cardId);
  writeSet(KEY_PENDING, pending);
}

/** Mark every non-deleted card pending — used after a backup import. */
export async function markAllPending(): Promise<void> {
  const all = await db.getAllCards();
  writeSet(KEY_PENDING, new Set(all.map((c) => c.id)));
}

async function uploadImages(passcode: string, imageId: string): Promise<void> {
  const img = await db.getImage(imageId);
  if (!img) return;
  for (const kind of ["full", "thumb"] as const) {
    const res = await fetch(`/api/image/${imageId}?kind=${kind}`, {
      method: "PUT",
      headers: { "x-sync-passcode": passcode, "content-type": "image/jpeg" },
      body: img[kind],
    });
    if (!res.ok) throw new Error(`Image upload failed (${res.status})`);
  }
}

/** Best-effort: a failed download must never abort the sync — missing
 * images are retried on every later sync until they arrive. The thumbnail
 * is regenerated locally from the full image, so display quality never
 * depends on what happens to be stored remotely. */
async function downloadImages(passcode: string, imageId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/image/${imageId}?kind=full`, {
      headers: { "x-sync-passcode": passcode },
    });
    if (!res.ok) return false;
    const full = await res.blob();
    const { resizeThumb } = await import("./images");
    await db.putImage({ id: imageId, full, thumb: await resizeThumb(full) });
    return true;
  } catch {
    return false;
  }
}

export interface SyncResult {
  pushed: number;
  pulled: number;
}

let inFlight: Promise<SyncResult> | null = null;

export function syncNow(): Promise<SyncResult> {
  // Collapse concurrent calls (auto-sync timer + manual button).
  if (!inFlight) {
    inFlight = doSync().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function doSync(): Promise<SyncResult> {
  const passcode = getPasscode();
  if (!passcode) throw new Error("Sync is not set up");

  const since = lastSyncedAt();
  const pending = readSet(KEY_PENDING);
  const all = await db.getAllCards();
  const byId = new Map(all.map((c) => [c.id, c]));
  const toPush = all.filter((c) => pending.has(c.id));
  const pushedStamp = new Map(toPush.map((c) => [c.id, c.updatedAt]));

  // Images first, so no card ever references an image the server lacks.
  const syncedImages = readSet(KEY_IMAGES);
  for (const card of toPush) {
    if (card.deleted || !card.imageId || syncedImages.has(card.imageId)) continue;
    await uploadImages(passcode, card.imageId);
    syncedImages.add(card.imageId);
    writeSet(KEY_IMAGES, syncedImages);
  }

  const res = await fetch("/api/sync", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-sync-passcode": passcode,
    },
    body: JSON.stringify({ since, cards: toPush }),
  });
  if (res.status === 401) throw new Error("Wrong passcode");
  if (!res.ok) {
    const msg = await res
      .json()
      .then((b) => b.error as string)
      .catch(() => null);
    throw new Error(msg || `Sync failed (${res.status})`);
  }
  const { cards: remote, now } = (await res.json()) as {
    cards: Card[];
    now: number;
  };

  let pulled = 0;
  for (const card of remote) {
    const local = byId.get(card.id);
    if (local && local.updatedAt >= card.updatedAt) continue;
    if (card.deleted) {
      if (local?.imageId) await db.deleteImage(local.imageId);
      await db.putCard(card);
    } else {
      await db.putCard(card);
    }
    pulled++;
  }

  // Fetch every image any live card is missing — not just newly-pulled
  // cards — so a download that failed on an earlier sync self-heals.
  for (const card of await db.getAllCards()) {
    if (card.deleted || !card.imageId) continue;
    if (await db.getImage(card.imageId)) continue;
    if (await downloadImages(passcode, card.imageId)) {
      syncedImages.add(card.imageId);
      writeSet(KEY_IMAGES, syncedImages);
      pulled++;
    }
  }

  // Clear pending only for cards unchanged since we snapshotted them, so
  // edits made mid-sync still push next time.
  const fresh = new Map((await db.getAllCards()).map((c) => [c.id, c]));
  const nextPending = readSet(KEY_PENDING);
  for (const [id, stamp] of pushedStamp) {
    if (fresh.get(id)?.updatedAt === stamp) nextPending.delete(id);
  }
  writeSet(KEY_PENDING, nextPending);
  localStorage.setItem(KEY_LAST, String(now));

  return { pushed: toPush.length, pulled };
}
