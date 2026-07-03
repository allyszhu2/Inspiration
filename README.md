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
- **Yours** — everything lives in your browser (IndexedDB), works offline after first load, and can be exported/imported as a JSON backup from the ⋯ menu.

Designed like paper: warm ivory, ink, a terracotta accent; serif for the collected words, sans for the chrome. Works as a home-screen app on iOS/Android (Share → Add to Home Screen).

## Develop

```bash
npm install
npm run dev
```

## Deploy on Vercel

This is a zero-config Next.js app:

1. Go to [vercel.com/new](https://vercel.com/new) and import this GitHub repository.
2. Framework preset: **Next.js** (auto-detected). No environment variables needed.
3. Deploy.

Because all data is stored on-device, there is no backend, database, or auth to configure.

## A note on your data

Data is per-device and per-browser. Export a backup (⋯ → Export backup) periodically, and use Import to move your collection to a new device.
