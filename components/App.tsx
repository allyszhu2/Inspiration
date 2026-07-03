"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { exportBackup, importBackup } from "@/lib/backup";
import * as db from "@/lib/db";
import { resizeImage } from "@/lib/images";
import type { Card, CardType, ViewMode } from "@/lib/types";
import {
  dailyPick,
  isDue,
  matchesQuery,
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
import MemoryMode from "./MemoryMode";
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
  const importInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    db.requestPersistence();
    db.getAllCards().then((all) => {
      setCards(all.sort((a, b) => b.createdAt - a.createdAt));
      setLoaded(true);
    });
    const savedView = localStorage.getItem("inspiration.view") as ViewMode | null;
    if (savedView === "grid" || savedView === "list" || savedView === "timeline") {
      setView(savedView);
    }
    setDailyDismissed(
      localStorage.getItem("inspiration.dailyDismissed") ===
        new Date().toDateString()
    );
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

  async function addCard(card: Card, imageFile: Blob | null) {
    if (imageFile) {
      const imageId = uid();
      const [full, thumb] = await Promise.all([
        resizeImage(imageFile, 1600),
        resizeImage(imageFile, 480),
      ]);
      await db.putImage({ id: imageId, full, thumb });
      card = { ...card, imageId };
    }
    await db.putCard(card);
    setCards((prev) => [card, ...prev]);
    setShowAdd(false);
    showToast(card.inMemory ? "Saved to collection & memory stack" : "Saved");
  }

  async function updateCard(card: Card) {
    await db.putCard(card);
    setCards((prev) => prev.map((c) => (c.id === card.id ? card : c)));
    setDetail((d) => (d && d.id === card.id ? card : d));
  }

  async function removeCard(card: Card) {
    await db.deleteCard(card);
    setCards((prev) => prev.filter((c) => c.id !== card.id));
    setDetail(null);
    showToast("Deleted");
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
      const all = await db.getAllCards();
      setCards(all.sort((a, b) => b.createdAt - a.createdAt));
      showToast(`Imported ${count} cards`);
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
        <GridView cards={filtered} onOpen={setDetail} onTag={(t) => setQuery(`#${t}`)} />
      ) : view === "list" ? (
        <ListView cards={filtered} onOpen={setDetail} onTag={(t) => setQuery(`#${t}`)} />
      ) : (
        <TimelineView cards={filtered} onOpen={setDetail} onTag={(t) => setQuery(`#${t}`)} />
      )}

      <button className="fab" onClick={() => setShowAdd(true)} aria-label="Add">
        <PlusIcon />
      </button>

      {showAdd && <AddSheet onSave={addCard} onClose={() => setShowAdd(false)} />}

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
