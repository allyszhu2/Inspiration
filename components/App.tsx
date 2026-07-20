"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { exportBackup, importBackup } from "@/lib/backup";
import * as db from "@/lib/db";
import { resizeFull, resizeThumb, upgradeThumbnails } from "@/lib/images";
import {
  isSyncEnabled,
  markAllPending,
  markPending,
  syncNow,
} from "@/lib/sync";
import { recognizeText } from "@/lib/ocr";
import type { Card, CardType, ViewMode } from "@/lib/types";
import { freshMemory } from "@/lib/types";
import {
  dailyPick,
  isDue,
  matchesQuery,
  parseQuickAdd,
  scheduleReview,
  uid,
} from "@/lib/utils";
import AddSheet from "./AddSheet";
import CardDetail from "./CardDetail";
import {
  CloseIcon,
  GridIcon,
  ListIcon,
  MoreIcon,
  PlusIcon,
  SearchIcon,
  SparkIcon,
  TimelineIcon,
} from "./Icons";
import MassImportSheet from "./MassImportSheet";
import QuickAdd from "./QuickAdd";
import MemoryMode from "./MemoryMode";
import SyncSheet from "./SyncSheet";
import { GridView, ListView, TimelineView } from "./Views";

const TYPE_FILTERS: { value: CardType | "all"; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "quote", label: "Quotes" },
  { value: "image", label: "Images" },
  { value: "link", label: "Links" },
  { value: "note", label: "Notes" },
];

export default function App() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<ViewMode>("grid");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<CardType | "all">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [detail, setDetail] = useState<Card | null>(null);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dailyDismissed, setDailyDismissed] = useState(false);
  const [toast, setToast] = useState("");
  const [showSync, setShowSync] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [syncOn, setSyncOn] = useState(false);
  const [syncing, setSyncing] = useState(false);
  // Bumped when thumbnails are regenerated so mounted images reload.
  const [thumbEpoch, setThumbEpoch] = useState(0);
  const importInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function reloadFromDb() {
    const all = await db.getAllCards();
    setCards(
      all.filter((c) => !c.deleted).sort((a, b) => b.createdAt - a.createdAt)
    );
  }

  /** Sync and refresh. Auto-syncs stay quiet; manual syncs report. */
  async function runSync(manual = false) {
    if (!isSyncEnabled()) return;
    setSyncing(true);
    try {
      const { pulled } = await syncNow();
      if (pulled > 0) await reloadFromDb();
      if (manual) {
        showToast(pulled > 0 ? `Synced — ${pulled} updated` : "Synced — up to date");
      }
    } catch (e) {
      if (manual) showToast(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  /** Debounced auto-sync after local edits. */
  function scheduleSync() {
    if (!isSyncEnabled()) return;
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => runSync(false), 2500);
  }

  useEffect(() => {
    db.requestPersistence();
    db.getAllCards().then((all) => {
      setCards(
        all.filter((c) => !c.deleted).sort((a, b) => b.createdAt - a.createdAt)
      );
      setLoaded(true);
      setSyncOn(isSyncEnabled());
      runSync(false);
      // Rebuild old low-res thumbnails in the background, then re-render.
      upgradeThumbnails().then(async () => {
        await reloadFromDb();
        setThumbEpoch((n) => n + 1);
      });
    });
    const savedView = localStorage.getItem("inspiration.view") as ViewMode | null;
    if (savedView === "grid" || savedView === "list" || savedView === "timeline") {
      setView(savedView);
    }
    setDailyDismissed(
      localStorage.getItem("inspiration.dailyDismissed") ===
        new Date().toDateString()
    );
    // Re-sync when the app comes back into view, so cards texted in or
    // added on another device appear as soon as you return.
    const onVisible = () => {
      if (document.visibilityState === "visible") runSync(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchView(v: ViewMode) {
    setView(v);
    localStorage.setItem("inspiration.view", v);
  }

  function showToast(msg: string) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  }

  async function persistCard(card: Card, imageFile: Blob | null): Promise<Card> {
    if (imageFile) {
      const imageId = uid();
      const [full, thumb] = await Promise.all([
        resizeFull(imageFile),
        resizeThumb(imageFile),
      ]);
      await db.putImage({ id: imageId, full, thumb });
      card = { ...card, imageId };
    }
    await db.putCard(card);
    markPending(card.id);
    return card;
  }

  async function addCard(card: Card, imageFile: Blob | null) {
    const saved = await persistCard(card, imageFile);
    setCards((prev) => [saved, ...prev]);
    setShowAdd(false);
    showToast(saved.inMemory ? "Saved to collection & memory stack" : "Saved");
    scheduleSync();
  }

  function blankCard(): Card {
    const now = Date.now();
    return {
      id: uid(),
      type: "note",
      text: "",
      source: "",
      url: "",
      tags: [],
      createdAt: now,
      updatedAt: now,
      inMemory: false,
      memory: freshMemory(),
    };
  }

  async function quickAddText(raw: string) {
    const parsed = parseQuickAdd(raw);
    if (!parsed.text && !parsed.url) return;
    const saved = await persistCard({ ...blankCard(), ...parsed }, null);
    setCards((prev) => [saved, ...prev]);
    showToast(`Saved as ${parsed.type}`);
    scheduleSync();
  }

  /** Dropped/pasted images become cards immediately; OCR fills the text in
   * behind the scenes so the drop never has to wait. */
  async function quickAddImages(files: File[]) {
    const saved: Card[] = [];
    for (const file of files) {
      saved.push(await persistCard({ ...blankCard(), type: "image" }, file));
    }
    setCards((prev) => [...[...saved].reverse(), ...prev]);
    showToast(
      saved.length === 1
        ? "Image saved — reading text…"
        : `${saved.length} images saved — reading text…`
    );
    scheduleSync();
    for (let i = 0; i < saved.length; i++) {
      try {
        const text = await recognizeText(files[i]);
        if (text) await updateCard({ ...saved[i], text });
      } catch {
        // unreadable photo: the card simply keeps an empty caption
      }
    }
  }

  async function addCards(items: { card: Card; imageFile: Blob | null }[]) {
    for (const item of items) {
      await persistCard(item.card, item.imageFile);
    }
    await reloadFromDb();
    setShowImport(false);
    showToast(`Imported ${items.length} card${items.length === 1 ? "" : "s"}`);
    scheduleSync();
  }

  async function updateCard(card: Card) {
    card = { ...card, updatedAt: Date.now() };
    await db.putCard(card);
    setCards((prev) => prev.map((c) => (c.id === card.id ? card : c)));
    setDetail((d) => (d && d.id === card.id ? card : d));
    markPending(card.id);
    scheduleSync();
  }

  async function removeCard(card: Card) {
    // Tombstone rather than hard delete, so the deletion syncs to other
    // devices. The image blobs are removed locally right away.
    await db.putCard({ ...card, deleted: true, updatedAt: Date.now() });
    if (card.imageId) await db.deleteImage(card.imageId);
    setCards((prev) => prev.filter((c) => c.id !== card.id));
    setDetail(null);
    showToast("Deleted");
    markPending(card.id);
    scheduleSync();
  }

  function reviewCard(card: Card, remembered: boolean) {
    void updateCard(scheduleReview(card, remembered));
  }

  async function handleExport() {
    setMenuOpen(false);
    const blob = await exportBackup();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `inspiration-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function handleImport(file: File | undefined) {
    if (!file) return;
    try {
      const count = await importBackup(file);
      await reloadFromDb();
      showToast(`Imported ${count} cards`);
      if (isSyncEnabled()) {
        await markAllPending();
        scheduleSync();
      }
    } catch {
      showToast("Import failed — not a valid backup");
    }
  }

  const filtered = useMemo(
    () =>
      cards.filter(
        (c) =>
          (typeFilter === "all" || c.type === typeFilter) &&
          matchesQuery(c, query)
      ),
    [cards, query, typeFilter]
  );

  const dueCount = useMemo(() => cards.filter((c) => isDue(c)).length, [cards]);
  const daily = useMemo(() => dailyPick(cards), [cards]);
  const filtering = query.trim() !== "" || typeFilter !== "all";

  function dismissDaily(e: React.MouseEvent) {
    e.stopPropagation();
    setDailyDismissed(true);
    localStorage.setItem("inspiration.dailyDismissed", new Date().toDateString());
  }

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="shell">
      <header className="masthead">
        <h1 className="wordmark">
          Inspiration<em>.</em>
        </h1>
        <span className="masthead-date">{today}</span>
      </header>

      <div className="toolbar">
        <QuickAdd onText={quickAddText} onImages={quickAddImages} />

        <div className="view-switch" role="group" aria-label="View">
          <button
            className={view === "grid" ? "active" : ""}
            onClick={() => switchView("grid")}
            aria-label="Grid view"
            title="Grid"
          >
            <GridIcon />
          </button>
          <button
            className={view === "list" ? "active" : ""}
            onClick={() => switchView("list")}
            aria-label="List view"
            title="List"
          >
            <ListIcon />
          </button>
          <button
            className={view === "timeline" ? "active" : ""}
            onClick={() => switchView("timeline")}
            aria-label="Timeline view"
            title="Timeline"
          >
            <TimelineIcon />
          </button>
        </div>

        <button
          className="icon-btn"
          onClick={() => setMemoryOpen(true)}
          aria-label="Memory practice"
          title="Memory practice"
        >
          <SparkIcon />
          {dueCount > 0 && <span className="badge">{dueCount}</span>}
        </button>

        <div style={{ position: "relative" }}>
          <button
            className={`icon-btn ${menuOpen ? "active" : ""}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="More"
          >
            <MoreIcon />
          </button>
          {menuOpen && (
            <div className="menu">
              {syncOn && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    runSync(true);
                  }}
                >
                  {syncing ? "Syncing…" : "Sync now"}
                </button>
              )}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setShowSync(true);
                }}
              >
                {syncOn ? "Sync settings…" : "Set up sync…"}
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setShowImport(true);
                }}
              >
                Mass import…
              </button>
              <button onClick={handleExport}>Export backup…</button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  importInput.current?.click();
                }}
              >
                Import backup…
              </button>
            </div>
          )}
        </div>
        <input
          ref={importInput}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            handleImport(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <div className="filter-row">
        <div className="search">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search words, sources, #tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="icon-btn"
              style={{ width: 26, height: 26, border: "none" }}
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <CloseIcon size={14} />
            </button>
          )}
        </div>
        <div className="chips">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              className={`chip ${typeFilter === f.value ? "active" : ""}`}
              onClick={() => setTypeFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {daily && !dailyDismissed && !filtering && (
        <div className="daily" onClick={() => setDetail(daily)}>
          <button
            className="daily-dismiss"
            onClick={dismissDaily}
            aria-label="Dismiss for today"
          >
            <CloseIcon size={15} />
          </button>
          <div className="kicker">Today’s resurfacing</div>
          <blockquote>
            {daily.text
              ? daily.text.length > 220
                ? daily.text.slice(0, 220) + "…"
                : daily.text
              : daily.source || daily.url}
          </blockquote>
          {daily.source && daily.text && (
            <div className="attribution">
              — <b>{daily.source}</b>
            </div>
          )}
        </div>
      )}

      {loaded && filtered.length === 0 ? (
        <div className="empty">
          <div className="fleuron">❧</div>
          {cards.length === 0 ? (
            <>
              <h2>Your creative home awaits</h2>
              <p>
                Photograph a book page, keep a quote, save a link. Everything
                you collect lives here — searchable, organized, and ready to
                resurface when you need it.
              </p>
            </>
          ) : (
            <>
              <h2>Nothing found</h2>
              <p>Try a different search, or clear the filters.</p>
            </>
          )}
        </div>
      ) : view === "grid" ? (
        <GridView key={thumbEpoch} cards={filtered} onOpen={setDetail} onTag={(t) => setQuery(`#${t}`)} />
      ) : view === "list" ? (
        <ListView key={thumbEpoch} cards={filtered} onOpen={setDetail} onTag={(t) => setQuery(`#${t}`)} />
      ) : (
        <TimelineView key={thumbEpoch} cards={filtered} onOpen={setDetail} onTag={(t) => setQuery(`#${t}`)} />
      )}

      <button className="fab" onClick={() => setShowAdd(true)} aria-label="Add">
        <PlusIcon />
      </button>

      {showAdd && <AddSheet onSave={addCard} onClose={() => setShowAdd(false)} />}

      {showImport && (
        <MassImportSheet onImport={addCards} onClose={() => setShowImport(false)} />
      )}

      {showSync && (
        <SyncSheet
          onClose={() => {
            setShowSync(false);
            setSyncOn(isSyncEnabled());
          }}
          onEnabled={async () => {
            setShowSync(false);
            setSyncOn(true);
            await markAllPending();
            runSync(true);
          }}
        />
      )}

      {detail && (
        <CardDetail
          card={detail}
          onUpdate={updateCard}
          onDelete={removeCard}
          onClose={() => setDetail(null)}
        />
      )}

      {memoryOpen && (
        <MemoryMode
          cards={cards}
          onReview={reviewCard}
          onClose={() => setMemoryOpen(false)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
