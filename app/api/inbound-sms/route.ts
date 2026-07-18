import { createHmac, timingSafeEqual } from "node:crypto";
import { putImage, storeMode, writeCard } from "@/lib/server/store";
import type { Card } from "@/lib/types";
import { freshMemory } from "@/lib/types";
import { parseQuickAdd } from "@/lib/utils";

/**
 * Twilio inbound SMS/MMS webhook. Text the Twilio number and the message
 * becomes a card in the Blob store, appearing on every device at its next
 * sync. Quick-add conventions apply: leading " → quote, a URL → link,
 * otherwise a note; "==" separates text from source. MMS photos become
 * image cards.
 *
 * Cost design: receive-only. We never send a reply (the empty TwiML below),
 * so there are no outbound charges and no A2P campaign registration.
 */

const EMPTY_TWIML = new Response(
  '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
  { headers: { "content-type": "text/xml" } }
);

function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Twilio request signature: HMAC-SHA1 over the webhook URL plus the POST
 * params sorted by key and concatenated as key+value, keyed by the auth
 * token. https://www.twilio.com/docs/usage/security#validating-requests
 */
function isSignatureValid(
  req: Request,
  params: URLSearchParams,
  authToken: string
): boolean {
  const url = `https://${req.headers.get("host")}/api/inbound-sms`;
  const payload =
    url +
    [...params.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => k + v)
      .join("");
  const expected = createHmac("sha1", authToken)
    .update(payload)
    .digest("base64");
  return constantTimeEqual(expected, req.headers.get("x-twilio-signature") ?? "");
}

export async function POST(req: Request) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken || storeMode() === "none") {
    return Response.json(
      { error: "Texting isn’t configured — set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and connect a Blob store." },
      { status: 503 }
    );
  }

  const params = new URLSearchParams(await req.text());
  if (!isSignatureValid(req, params, authToken)) {
    return Response.json({ error: "Bad signature" }, { status: 403 });
  }

  // Only the allowlisted phone(s) may add cards; anyone else is silently
  // ignored (200 so Twilio doesn't retry — the text just goes nowhere).
  const from = params.get("From") ?? "";
  const allowed = (process.env.ALLOWED_SMS_FROM ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length > 0 && !allowed.includes(from)) {
    return EMPTY_TWIML;
  }

  // MessageSid-derived ids make webhook retries idempotent: a retry
  // overwrites the same card instead of duplicating it.
  const messageSid = (params.get("MessageSid") ?? params.get("SmsSid") ?? `t${Date.now()}`)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const body = (params.get("Body") ?? "").trim();
  const numMedia = Number(params.get("NumMedia") ?? 0);
  const now = Date.now();

  const blank = (): Omit<Card, "id" | "type"> => ({
    text: "",
    source: "",
    url: "",
    tags: [],
    createdAt: now,
    updatedAt: now,
    inMemory: false,
    memory: freshMemory(),
  });

  const cards: Card[] = [];

  for (let i = 0; i < numMedia; i++) {
    const mediaUrl = params.get(`MediaUrl${i}`);
    const mediaType = params.get(`MediaContentType${i}`) ?? "";
    if (!mediaUrl || !mediaType.startsWith("image/")) continue;
    const res = await fetch(mediaUrl, {
      headers: {
        authorization:
          "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
      },
    });
    if (!res.ok) continue;
    const bytes = await res.arrayBuffer();
    const imageId = `sms${messageSid}m${i}`;
    // MMS images are already carrier-compressed; one size serves both roles.
    await putImage(imageId, "full", bytes, mediaType);
    await putImage(imageId, "thumb", bytes, mediaType);
    cards.push({
      ...blank(),
      id: `sms${messageSid}-${i}`,
      type: "image",
      // The text accompanying the photo becomes the first card's caption.
      text: cards.length === 0 ? body : "",
      imageId,
    });
  }

  if (cards.length === 0 && body) {
    const parsed = parseQuickAdd(body);
    if (parsed.text || parsed.url) {
      cards.push({ ...blank(), id: `sms${messageSid}`, ...parsed });
    }
  }

  for (const card of cards) {
    await writeCard(card);
  }

  return EMPTY_TWIML;
}
