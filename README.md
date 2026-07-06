# Inspiration.

A commonplace book for your creative practice — collect quotes, book pages, images, and links; organize them; and commit the best of them to memory.

Inspired by [*Your research practice is your creative practice*](https://artdirection.substack.com/p/your-research-practice-is-your-creative).

## What it does

- **Cards** — every piece of inspiration is a card: a quote, a photo, a link, or a note.
- **Photo → text (OCR)** — photograph a book page and the text is read in your browser (Tesseract) and attached to the card, fully searchable and editable. Nothing is uploaded anywhere.
- **Three views** — grid (pinboard), list (index), and timeline (a diary of what moved you, by month and day).
- **Search & tags** — full-text search across words, sources, and tags; `#tag` terms filter by tag.
- **Memory stack** — flag a card with *Add to memory stack* and it enters a flashcard rotation. A full-screen review mode shows you the source, you recall the words, reveal, and grade yourself. Spaced repetition (1 → 3 → 7 → 21 → 60 days) decides when it resurfaces.
- **Daily resurfacing** — one card from your collection greets you each day.
- **Cloud sync** — enter the same passcode on each device (⋯ → Set up sync) and cards, photos, and memory progress stay in sync everywhere via Vercel Blob. The device database remains the offline cache, so the app still opens instantly and works offline; changes catch up when you're back online. Deletes and edits propagate (last write wins).
- **Yours** — everything also lives in your browser (IndexedDB) and can be exported/imported as a JSON backup from the ⋯ menu.

Designed like paper: warm ivory, ink, a terracotta accent; serif for the collected words, sans for the chrome. Works as a home-screen app on iOS/Android (Share → Add to Home Screen).

## Develop

```bash
npm install
npm run dev
```

## Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import this GitHub repository. Framework preset: **Next.js** (auto-detected). Deploy.
2. **Enable sync (one step):** in the Vercel project dashboard, open **Storage → Create Database → Blob**, create a store, and connect it to the project (this injects `BLOB_READ_WRITE_TOKEN` automatically). Redeploy.
3. Optional: set a `SYNC_PASSCODE` environment variable to change the sync passcode (default: `ally`).

Then on each device: open the app → ⋯ menu → **Set up sync** → enter the passcode. Done.

During local development (`npm run dev`) sync uses a `.sync-data/` directory instead of Blob, so the whole flow works without any cloud configuration.

## A note on your data

Cards are stored on-device (IndexedDB) and mirrored to your Vercel Blob store when sync is on. The JSON export (⋯ → Export backup) remains a good periodic safety net.
