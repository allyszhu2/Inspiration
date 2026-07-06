import {
  checkPasscode,
  deleteImages,
  isValidId,
  listCardsSince,
  storeMode,
  writeCard,
} from "@/lib/server/store";
import type { Card } from "@/lib/types";

/**
 * One round trip does a full sync: the client pushes its locally-changed
 * cards, and receives every card that changed on the server since its last
 * sync (which includes what other devices pushed).
 */
export async function POST(req: Request) {
  if (!checkPasscode(req)) {
    return Response.json({ error: "Wrong passcode" }, { status: 401 });
  }
  if (storeMode() === "none") {
    return Response.json(
      { error: "Sync isn’t configured — connect a Blob store to this project in Vercel." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const since = typeof body.since === "number" ? body.since : 0;
  const incoming: Card[] = Array.isArray(body.cards)
    ? body.cards.filter((c: Card) => c && isValidId(String(c.id)))
    : [];

  // `now` is taken before any reads/writes so the client's next `since`
  // re-covers this sync's window; re-pulled cards merge idempotently.
  const now = Date.now();

  for (const card of incoming) {
    await writeCard(card);
    if (card.deleted && card.imageId && isValidId(card.imageId)) {
      await deleteImages(card.imageId);
    }
  }

  const cards = await listCardsSince(since);
  return Response.json({ cards, now });
}
