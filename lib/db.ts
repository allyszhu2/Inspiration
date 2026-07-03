import type { Card, StoredImage } from "./types";

const DB_NAME = "inspiration";
const DB_VERSION = 1;
const CARDS = "cards";
const IMAGES = "images";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CARDS)) {
        db.createObjectStore(CARDS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(IMAGES)) {
        db.createObjectStore(IMAGES, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export function getAllCards(): Promise<Card[]> {
  return tx<Card[]>(CARDS, "readonly", (s) => s.getAll());
}

export function putCard(card: Card): Promise<IDBValidKey> {
  return tx(CARDS, "readwrite", (s) => s.put(card));
}

export async function deleteCard(card: Card): Promise<void> {
  await tx(CARDS, "readwrite", (s) => s.delete(card.id));
  if (card.imageId) {
    await tx(IMAGES, "readwrite", (s) => s.delete(card.imageId!));
  }
}

export function putImage(image: StoredImage): Promise<IDBValidKey> {
  return tx(IMAGES, "readwrite", (s) => s.put(image));
}

export function getImage(id: string): Promise<StoredImage | undefined> {
  return tx<StoredImage | undefined>(IMAGES, "readonly", (s) => s.get(id));
}

export function getAllImages(): Promise<StoredImage[]> {
  return tx<StoredImage[]>(IMAGES, "readonly", (s) => s.getAll());
}

/** Request durable storage so the browser doesn't evict the collection. */
export function requestPersistence(): void {
  if (typeof navigator !== "undefined" && navigator.storage?.persist) {
    navigator.storage.persist().catch(() => {});
  }
}
