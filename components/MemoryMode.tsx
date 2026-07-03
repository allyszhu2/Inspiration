"use client";

import { useMemo, useState } from "react";
import type { Card } from "@/lib/types";
import { isDue, shuffle } from "@/lib/utils";
import { CloseIcon } from "./Icons";
import { useImage } from "./useImage";

interface MemoryModeProps {
  cards: Card[];
  onReview: (card: Card, remembered: boolean) => void;
  onClose: () => void;
}

/** The prompt shown before reveal: source if we have one, else opening words. */
function hintFor(card: Card): string {
  if (card.source) return card.source;
  const words = card.text.split(/\s+/);
  return words.slice(0, 6).join(" ") + (words.length > 6 ? " …" : "");
}

function MemoryCardFace({
  card,
  revealed,
  onReveal,
}: {
  card: Card;
  revealed: boolean;
  onReveal: () => void;
}) {
  const image = useImage(card.imageId, "full");

  return (
    <div className="memory-card" onClick={revealed ? undefined : onReveal}>
      {!revealed ? (
        <>
          <div className="memory-prompt-label">Do you remember…</div>
          {card.type === "image" && image && !card.text ? (
            <img className="memory-answer-img" src={image} alt="" />
          ) : (
            <div className="memory-hint">{hintFor(card)}</div>
          )}
          <div className="memory-tap-note">Recall it, then tap to reveal</div>
        </>
      ) : (
        <>
          <div className="memory-prompt-label">
            {card.source ? `— ${card.source}` : "From your collection"}
          </div>
          {card.type === "image" && image && (
            <img className="memory-answer-img" src={image} alt="" />
          )}
          {card.text && <div className="memory-answer">{card.text}</div>}
        </>
      )}
    </div>
  );
}

export default function MemoryMode({
  cards,
  onReview,
  onClose,
}: MemoryModeProps) {
  // Build the deck once when the screen opens: due cards first, then the
  // rest of the memory stack for free practice.
  const deck = useMemo(() => {
    const memoryCards = cards.filter((c) => c.inMemory && (c.text || c.imageId));
    const due = memoryCards.filter((c) => isDue(c));
    const rest = memoryCards.filter((c) => !isDue(c));
    return { due: shuffle(due), practice: shuffle(rest) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [practicing, setPracticing] = useState(deck.due.length === 0);
  const active = practicing ? deck.practice : deck.due;
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [remembered, setRemembered] = useState(0);

  const card = active[index];
  const finished = !card;

  function grade(ok: boolean) {
    if (!practicing) onReview(card, ok);
    if (ok) setRemembered((n) => n + 1);
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  function startPractice() {
    setPracticing(true);
    setIndex(0);
    setRevealed(false);
    setRemembered(0);
  }

  const stackEmpty = deck.due.length === 0 && deck.practice.length === 0;

  return (
    <div className="memory-screen">
      <div className="memory-top">
        <span className="memory-count">
          {stackEmpty || finished
            ? "Memory"
            : `${practicing ? "Practice" : "Review"} · ${index + 1} of ${active.length}`}
        </span>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </div>

      <div className="memory-stage">
        {stackEmpty ? (
          <div className="memory-done">
            <div className="fleuron">❧</div>
            <h2>Nothing here yet</h2>
            <p>
              When you save something worth knowing by heart, mark
              “Add to memory stack” and it will resurface here.
            </p>
            <button className="btn btn-primary" onClick={onClose}>
              Back to collection
            </button>
          </div>
        ) : finished ? (
          <div className="memory-done">
            <div className="fleuron">❧</div>
            <h2>{practicing ? "Practice complete" : "All caught up"}</h2>
            <p>
              You remembered {remembered} of {active.length}.
              {!practicing && deck.practice.length > 0
                ? " Nothing else is due today."
                : ""}
            </p>
            {!practicing && deck.practice.length > 0 && (
              <button
                className="btn btn-primary"
                style={{ marginRight: 10 }}
                onClick={startPractice}
              >
                Keep practicing
              </button>
            )}
            <button className="btn btn-ghost" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <MemoryCardFace
            key={card.id}
            card={card}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
          />
        )}
      </div>

      {!finished && !stackEmpty && revealed && (
        <div className="memory-actions">
          <button className="memory-btn no" onClick={() => grade(false)}>
            Still learning
          </button>
          <button className="memory-btn yes" onClick={() => grade(true)}>
            I remembered
          </button>
        </div>
      )}
    </div>
  );
}
