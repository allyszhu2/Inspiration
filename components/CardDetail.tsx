"use client";

import { useState } from "react";
import type { Card } from "@/lib/types";
import { domainOf, formatDay, parseTags } from "@/lib/utils";
import { LinkIcon, StarIcon } from "./Icons";
import { useImage } from "./useImage";

interface CardDetailProps {
  card: Card;
  onUpdate: (card: Card) => void;
  onDelete: (card: Card) => void;
  onClose: () => void;
}

export default function CardDetail({
  card,
  onUpdate,
  onDelete,
  onClose,
}: CardDetailProps) {
  const full = useImage(card.imageId, "full");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(card.text);
  const [source, setSource] = useState(card.source);
  const [url, setUrl] = useState(card.url);
  const [tagsInput, setTagsInput] = useState(card.tags.join(", "));
  const [confirmDelete, setConfirmDelete] = useState(false);

  function saveEdits() {
    onUpdate({
      ...card,
      text: text.trim(),
      source: source.trim(),
      url: url.trim(),
      tags: parseTags(tagsInput),
    });
    setEditing(false);
  }

  function toggleMemory() {
    onUpdate({ ...card, inMemory: !card.inMemory });
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        {card.type === "image" && full && (
          <div className="detail-image">
            <img src={full} alt={card.text.slice(0, 80) || "Saved image"} />
          </div>
        )}

        {editing ? (
          <>
            <div className="field">
              <label htmlFor="edit-text">Text</label>
              <textarea
                id="edit-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            {card.type === "link" && (
              <div className="field">
                <label htmlFor="edit-url">Link</label>
                <input
                  id="edit-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="edit-source">Source</label>
              <input
                id="edit-source"
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="edit-tags">Tags</label>
              <input
                id="edit-tags"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
            </div>
            <div className="btn-row">
              <button className="btn btn-ghost" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveEdits}>
                Save changes
              </button>
            </div>
          </>
        ) : (
          <>
            {card.type === "link" && card.url && (
              <p style={{ marginBottom: 12 }}>
                <a
                  href={card.url}
                  target="_blank"
                  rel="noreferrer"
                  className="card-link-domain"
                >
                  <LinkIcon size={12} /> {domainOf(card.url)}
                </a>
              </p>
            )}

            {card.text && (
              <div className="detail-quote">
                {card.type === "quote" ? `“${card.text}”` : card.text}
              </div>
            )}

            {card.source && (
              <div className="attribution" style={{ marginBottom: 14 }}>
                — <b>{card.source}</b>
              </div>
            )}

            {card.tags.length > 0 && (
              <div className="tag-row" style={{ padding: "0 0 14px" }}>
                {card.tags.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </div>
            )}

            <div className="detail-date">
              Collected {formatDay(card.createdAt)}
            </div>

            <button
              className={`memorize-toggle ${card.inMemory ? "on" : ""}`}
              onClick={toggleMemory}
            >
              <span className="star-ico">
                <StarIcon size={22} filled={card.inMemory} />
              </span>
              <span>
                <b>
                  {card.inMemory ? "In your memory stack" : "Add to memory stack"}
                </b>
                <span>
                  {card.inMemory
                    ? `Recalled ${card.memory.recalled} times · tap to remove`
                    : "Resurface this until you know it by heart"}
                </span>
              </span>
            </button>

            <div className="btn-row">
              {confirmDelete ? (
                <button
                  className="btn btn-danger"
                  onClick={() => onDelete(card)}
                >
                  Really delete?
                </button>
              ) : (
                <button
                  className="btn btn-danger"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button className="btn btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
