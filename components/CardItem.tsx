"use client";

import type { Card } from "@/lib/types";
import { domainOf, formatShortDate } from "@/lib/utils";
import { LinkIcon, StarIcon } from "./Icons";
import { useImage } from "./useImage";

interface CardItemProps {
  card: Card;
  onOpen: (card: Card) => void;
  onTag: (tag: string) => void;
}

function Attribution({ card }: { card: Card }) {
  if (!card.source) return null;
  return (
    <div className="attribution">
      — <b>{card.source}</b>
    </div>
  );
}

function Tags({ card, onTag }: { card: Card; onTag: (tag: string) => void }) {
  if (card.tags.length === 0) return null;
  return (
    <div className="tag-row">
      {card.tags.map((t) => (
        <button
          key={t}
          className="tag"
          onClick={(e) => {
            e.stopPropagation();
            onTag(t);
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export function CardItem({ card, onOpen, onTag }: CardItemProps) {
  const thumb = useImage(card.imageId, "thumb");

  return (
    <article className="card" onClick={() => onOpen(card)}>
      {card.inMemory && (
        <span className="memory-mark" title="In memory stack">
          <StarIcon size={15} filled />
        </span>
      )}

      {card.type === "image" && (
        <>
          <div className="card-image">
            {thumb && <img src={thumb} alt={card.text.slice(0, 80) || "Saved image"} />}
          </div>
          {(card.text || card.source) && (
            <div className="card-image-caption">
              {card.text || card.source}
            </div>
          )}
        </>
      )}

      {card.type === "quote" && (
        <div className="card-body">
          <div className="card-quote-text">{card.text}</div>
          <Attribution card={card} />
        </div>
      )}

      {card.type === "link" && (
        <div className="card-body">
          <span className="card-link-domain">
            <LinkIcon size={12} /> {domainOf(card.url)}
          </span>
          <div className="card-note-text">{card.text || card.url}</div>
          <Attribution card={card} />
        </div>
      )}

      {card.type === "note" && (
        <div className="card-body">
          <div className="card-note-text">{card.text}</div>
          <Attribution card={card} />
        </div>
      )}

      <Tags card={card} onTag={onTag} />
    </article>
  );
}

export function ListRow({ card, onOpen, onTag }: CardItemProps) {
  const thumb = useImage(card.imageId, "thumb");

  return (
    <div className="list-row" onClick={() => onOpen(card)}>
      {card.type === "image" && thumb && (
        <img className="list-thumb" src={thumb} alt="" />
      )}
      <div className="list-main">
        <div className="list-text">
          {card.type === "quote" ? `“${card.text}”` : card.text || card.url}
        </div>
        <div className="list-meta">
          <span className="type-label">{card.type}</span>
          {card.source && <span>{card.source}</span>}
          {card.type === "link" && <span>{domainOf(card.url)}</span>}
          <span>{formatShortDate(card.createdAt)}</span>
          {card.inMemory && (
            <span className="star">
              <StarIcon size={12} filled />
            </span>
          )}
          {card.tags.slice(0, 3).map((t) => (
            <button
              key={t}
              className="tag"
              onClick={(e) => {
                e.stopPropagation();
                onTag(t);
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
