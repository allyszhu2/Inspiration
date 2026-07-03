"use client";

import { useEffect, useRef, useState } from "react";
import { recognizeText } from "@/lib/ocr";
import type { Card, CardType } from "@/lib/types";
import { freshMemory } from "@/lib/types";
import { parseTags, uid } from "@/lib/utils";
import {
  CameraIcon,
  LinkIcon,
  NoteIcon,
  PhotoIcon,
  QuoteIcon,
  StarIcon,
} from "./Icons";

interface AddSheetProps {
  onSave: (card: Card, imageFile: Blob | null) => Promise<void>;
  onClose: () => void;
}

const TYPE_TABS: { type: CardType; label: string; icon: React.ReactNode }[] = [
  { type: "image", label: "Photo", icon: <CameraIcon /> },
  { type: "quote", label: "Quote", icon: <QuoteIcon /> },
  { type: "link", label: "Link", icon: <LinkIcon /> },
  { type: "note", label: "Note", icon: <NoteIcon /> },
];

export default function AddSheet({ onSave, onClose }: AddSheetProps) {
  const [type, setType] = useState<CardType>("image");
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [url, setUrl] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [memorize, setMemorize] = useState(false);
  const [file, setFile] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [ocrError, setOcrError] = useState(false);
  const [saving, setSaving] = useState(false);

  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const ocrRun = useRef(0);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleFile(f: File | undefined) {
    if (!f) return;
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
    // Run OCR automatically — book pages become searchable text.
    const run = ++ocrRun.current;
    setOcrError(false);
    setOcrProgress(0);
    try {
      const extracted = await recognizeText(f, (p) => {
        if (ocrRun.current === run) setOcrProgress(p);
      });
      if (ocrRun.current !== run) return;
      setOcrProgress(null);
      if (extracted) {
        setText((prev) => (prev.trim() ? prev : extracted));
      }
    } catch {
      if (ocrRun.current === run) {
        setOcrProgress(null);
        setOcrError(true);
      }
    }
  }

  const canSave =
    !saving &&
    (type === "image"
      ? file !== null
      : type === "link"
        ? url.trim() !== ""
        : text.trim() !== "");

  async function save() {
    if (!canSave) return;
    setSaving(true);
    const card: Card = {
      id: uid(),
      type,
      text: text.trim(),
      source: source.trim(),
      url: type === "link" ? url.trim() : "",
      tags: parseTags(tagsInput),
      createdAt: Date.now(),
      inMemory: memorize,
      memory: freshMemory(),
    };
    try {
      await onSave(card, type === "image" ? file : null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2 className="sheet-title">Add to your collection</h2>

        <div className="type-tabs">
          {TYPE_TABS.map((t) => (
            <button
              key={t.type}
              className={`type-tab ${type === t.type ? "active" : ""}`}
              onClick={() => setType(t.type)}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {type === "image" && (
          <>
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <input
              ref={libraryInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => handleFile(e.target.files?.[0])}
            />

            {previewUrl ? (
              <div className="upload-preview">
                <img src={previewUrl} alt="Preview" />
              </div>
            ) : (
              <div className="upload-zone">
                <button
                  className="upload-btn"
                  onClick={() => cameraInput.current?.click()}
                >
                  <CameraIcon /> Take photo
                </button>
                <button
                  className="upload-btn"
                  onClick={() => libraryInput.current?.click()}
                >
                  <PhotoIcon /> Choose image
                </button>
              </div>
            )}

            {previewUrl && ocrProgress === null && (
              <div className="ocr-status">
                <button
                  className="upload-btn"
                  onClick={() => libraryInput.current?.click()}
                >
                  Replace image
                </button>
                {ocrError && <span>Couldn’t read text from this image.</span>}
              </div>
            )}

            {ocrProgress !== null && (
              <div className="ocr-status">
                <span>Reading text…</span>
                <div className="progress">
                  <div style={{ width: `${Math.round(ocrProgress * 100)}%` }} />
                </div>
              </div>
            )}
          </>
        )}

        {type === "link" && (
          <div className="field">
            <label htmlFor="add-url">Link</label>
            <input
              id="add-url"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        )}

        <div className="field">
          <label htmlFor="add-text">
            {type === "quote"
              ? "Quote"
              : type === "image"
                ? "Extracted text / caption"
                : type === "link"
                  ? "Why it matters"
                  : "Note"}
          </label>
          <textarea
            id="add-text"
            placeholder={
              type === "quote"
                ? "The words worth keeping…"
                : type === "image"
                  ? "Text will appear here after the photo is read — edit freely."
                  : "What struck you about this?"
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="add-source">Source</label>
          <input
            id="add-source"
            type="text"
            placeholder="Book, author, publication…"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="add-tags">Tags</label>
          <input
            id="add-tags"
            type="text"
            placeholder="writing, craft, paris review (comma separated)"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
          />
        </div>

        <button
          className={`memorize-toggle ${memorize ? "on" : ""}`}
          onClick={() => setMemorize(!memorize)}
        >
          <span className="star-ico">
            <StarIcon size={22} filled={memorize} />
          </span>
          <span>
            <b>Add to memory stack</b>
            <span>Resurface this daily until you know it by heart</span>
          </span>
        </button>

        <div className="btn-row">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!canSave} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
