import { getAllCards, getAllImages, putCard, putImage } from "./db";
import { blobToDataURL, dataURLToBlob } from "./images";
import type { Card } from "./types";
import { freshMemory } from "./types";

interface BackupImage {
  id: string;
  full: string;
  thumb: string;
}

interface Backup {
  app: "inspiration";
  version: 1;
  exportedAt: number;
  cards: Card[];
  images: BackupImage[];
}

export async function exportBackup(): Promise<Blob> {
  const [cards, images] = await Promise.all([getAllCards(), getAllImages()]);
  const backup: Backup = {
    app: "inspiration",
    version: 1,
    exportedAt: Date.now(),
    cards: cards.filter((c) => !c.deleted),
    images: await Promise.all(
      images.map(async (img) => ({
        id: img.id,
        full: await blobToDataURL(img.full),
        thumb: await blobToDataURL(img.thumb),
      }))
    ),
  };
  return new Blob([JSON.stringify(backup)], { type: "application/json" });
}

/** Merge a backup file into the collection. Existing ids are overwritten. */
export async function importBackup(file: Blob): Promise<number> {
  const backup = JSON.parse(await file.text()) as Backup;
  if (backup.app !== "inspiration" || !Array.isArray(backup.cards)) {
    throw new Error("Not an Inspiration backup file");
  }
  for (const img of backup.images ?? []) {
    await putImage({
      id: img.id,
      full: await dataURLToBlob(img.full),
      thumb: await dataURLToBlob(img.thumb),
    });
  }
  for (const card of backup.cards) {
    await putCard({
      ...card,
      memory: card.memory ?? freshMemory(),
      updatedAt: card.updatedAt ?? card.createdAt ?? Date.now(),
    });
  }
  return backup.cards.length;
}
