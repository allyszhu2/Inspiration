export type CardType = "quote" | "image" | "link" | "note";

export interface MemoryState {
  /** Leitner box level, 0..5 */
  level: number;
  /** timestamp (ms) when this card is next due for review */
  due: number;
  /** total successful recalls */
  recalled: number;
  /** total misses */
  lapses: number;
}

export interface Card {
  id: string;
  type: CardType;
  /** Quote text, note body, image caption / OCR text, or link note */
  text: string;
  /** Where it came from — book, author, publication, person */
  source: string;
  /** For link cards */
  url: string;
  tags: string[];
  /** Key into the images store, for image cards */
  imageId?: string;
  createdAt: number;
  /** Whether this card is in the memory stack */
  inMemory: boolean;
  memory: MemoryState;
}

export interface StoredImage {
  id: string;
  full: Blob;
  thumb: Blob;
}

export type ViewMode = "grid" | "list" | "timeline";

export const freshMemory = (): MemoryState => ({
  level: 0,
  due: Date.now(),
  recalled: 0,
  lapses: 0,
});
