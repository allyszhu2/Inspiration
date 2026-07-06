import type { Card } from "./types";

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Leitner-style review intervals in days, by box level. */
export const REVIEW_INTERVALS_DAYS = [0, 1, 3, 7, 21, 60];

export function scheduleReview(card: Card, remembered: boolean): Card {
  const level = remembered
    ? Math.min(card.memory.level + 1, REVIEW_INTERVALS_DAYS.length - 1)
    : 0;
  const days = REVIEW_INTERVALS_DAYS[level];
  // "Again" cards come back in ten minutes; everything else at their interval.
  const due = remembered ? Date.now() + days * DAY_MS : Date.now() + 10 * 60 * 1000;
  return {
    ...card,
    memory: {
      level,
      due,
      recalled: card.memory.recalled + (remembered ? 1 : 0),
      lapses: card.memory.lapses + (remembered ? 0 : 1),
    },
  };
}

export function isDue(card: Card, now = Date.now()): boolean {
  return card.inMemory && card.memory.due <= now;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deterministic "card of the day" — same pick all day, changes at midnight. */
export function dailyPick(cards: Card[], date = new Date()): Card | null {
  if (cards.length === 0) return null;
  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  const sorted = [...cards].sort((a, b) => a.id.localeCompare(b.id));
  return sorted[hash % sorted.length];
}

export function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatMonth(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function formatShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function parseTags(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[,\n]/)
        .map((t) => t.trim().replace(/^#/, "").toLowerCase())
        .filter(Boolean)
    )
  );
}

/**
 * Parse mass-import text: every non-empty line is one card, and "=="
 * separates the quote from its source.
 *   It is joy to be hidden but disaster not to be found. == D. W. Winnicott
 */
export function parseMassImport(input: string): { text: string; source: string }[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const sep = line.indexOf("==");
      if (sep === -1) return { text: line, source: "" };
      return {
        text: line.slice(0, sep).trim(),
        source: line.slice(sep + 2).trim(),
      };
    })
    .filter((entry) => entry.text);
}

/** Case-insensitive search across text, source, tags, and url. Supports #tag terms. */
export function matchesQuery(card: Card, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const terms = q.split(/\s+/);
  const haystack = [card.text, card.source, card.url, card.tags.join(" ")]
    .join(" ")
    .toLowerCase();
  return terms.every((term) => {
    if (term.startsWith("#")) {
      const tag = term.slice(1);
      return card.tags.some((t) => t.includes(tag));
    }
    return haystack.includes(term);
  });
}
