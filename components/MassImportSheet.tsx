"use client";

import { useRef, useState } from "react";
import { recognizeText } from "@/lib/ocr";
import type { Card } from "@/lib/types";
import { freshMemory } from "@/lib/types";
import { parseMassImport, uid } from "@/lib/utils";
import { PhotoIcon, StarIcon } from "./Icons";

export interface ImportItem {
  card: Card;
  imageFile: Blob | null;
}

interface MassImportSheetProps {
  onImport: (items: ImportItem[]) => Promise<void>;
  onClose: () => void;
}

function MemorizeToggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button className={`memorize-toggle ${on ? "on" : ""}`} onClick={onToggle}>
      <span className="star-ico">
        <StarIcon size={22} filled={on} />
      </span>
      <span>
        <b>Add these to the memory stack</b>
        <span>They’ll resurface as flashcards until you know them</span>
      </span>
    </button>
  );
}

export default function MassImportSheet({
  onImport,
  onClose,
}: MassImportSheetProps) {
  const [text, setText] = useState("");
  const [memorizeText, setMemorizeText] = useState(true);
  const [memorizePhotos, setMemorizePhotos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoProgress, setPhotoProgress] = useState<{
    current: number;
    total: number;
    fraction: number;
  } | null>(null);
  const filesInput = useRef<HTMLInputElement>(null);

  const parsed = parseMassImport(text);

  function baseCard(order: number, inMemory: boolean): Card {
    const stamp = Date.now() + order;
    return {
      id: uid(),
      type: "quote",
      text: "",
      source: "",
      url: "",
      tags: [],
      createdAt: stamp,
      updatedAt: stamp,
      inMemory,
      memory: freshMemory(),
    };
  }

  async function importText() {
    if (!parsed.length || busy) return;
    setBusy(true);
    try {
      await onImport(
        parsed.map((entry, i) => ({
          card: {
            ...baseCard(i, memorizeText),
            text: entry.text,
            source: entry.source,
          },
          imageFile: null,
        }))
      );
    } finally {
      setBusy(false);
    }
  }

  async function importPhotos(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length || busy) return;
    setBusy(true);
    try {
      const items: ImportItem[] = [];
      for (let i = 0; i < files.length; i++) {
        setPhotoProgress({ current: i + 1, total: files.length, fraction: i / files.length });
        let extracted = "";
        try {
          extracted = await recognizeText(files[i], (p) =>
            setPhotoProgress({
              current: i + 1,
              total: files.length,
              fraction: (i + p) / files.length,
            })
          );
        } catch {
          // an unreadable photo still becomes a card, just without text
        }
        items.push({
          card: {
            ...baseCard(i, memorizePhotos),
            type: "image",
            text: extracted,
          },
          imageFile: files[i],
        });
      }
      await onImport(items);
    } finally {
      setPhotoProgress(null);
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={busy ? undefined : onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2 className="sheet-title">Mass import</h2>

        <div className="field">
          <label htmlFor="mass-text">Paste quotes — one per line</label>
          <textarea
            id="mass-text"
            rows={7}
            placeholder={
              "Put == before the source, like this:\n\nIt is joy to be hidden but disaster not to be found. == D. W. Winnicott\nAppear weak when you are strong, and strong when you are weak. == Sun Tzu, The Art of War"
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <MemorizeToggle on={memorizeText} onToggle={() => setMemorizeText(!memorizeText)} />

        <div className="btn-row" style={{ marginBottom: 4 }}>
          <button
            className="btn btn-primary"
            disabled={!parsed.length || busy}
            onClick={importText}
          >
            {busy && !photoProgress
              ? "Importing…"
              : `Import ${parsed.length || ""} quote${parsed.length === 1 ? "" : "s"}`.replace("  ", " ")}
          </button>
        </div>

        <div className="divider" />

        <div className="field" style={{ marginBottom: 10 }}>
          <label>Photos — each becomes a card</label>
          <p className="import-note">
            Select several book pages at once; the text is read from each
            automatically.
          </p>
          <input
            ref={filesInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              importPhotos(e.target.files);
              e.target.value = "";
            }}
          />
          {photoProgress ? (
            <div className="ocr-status">
              <span>
                Reading photo {photoProgress.current} of {photoProgress.total}…
              </span>
              <div className="progress">
                <div
                  style={{ width: `${Math.round(photoProgress.fraction * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              className="upload-btn"
              disabled={busy}
              onClick={() => filesInput.current?.click()}
            >
              <PhotoIcon /> Choose images
            </button>
          )}
        </div>

        <MemorizeToggle
          on={memorizePhotos}
          onToggle={() => setMemorizePhotos(!memorizePhotos)}
        />

        <div className="btn-row">
          <button className="btn btn-ghost" disabled={busy} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
