"use client";

import { useState } from "react";
import { PlusIcon } from "./Icons";

interface QuickAddProps {
  /** Raw text submitted with Enter or the Save button. */
  onText: (raw: string) => void;
  /** Images dropped or pasted onto the box. */
  onImages: (files: File[]) => void;
}

export default function QuickAdd({ onText, onImages }: QuickAddProps) {
  const [value, setValue] = useState("");
  const [dragging, setDragging] = useState(false);

  function submit() {
    const raw = value.trim();
    if (!raw) return;
    onText(raw);
    setValue("");
  }

  function handleFiles(list: FileList | null | undefined) {
    const files = Array.from(list ?? []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length) onImages(files);
  }

  return (
    <div
      className={`quickadd ${dragging ? "dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <PlusIcon size={16} />
      <input
        type="text"
        aria-label="Quick add"
        placeholder='Add a thought, “a quote”, a link — or drop an image'
        title='Starts with " → quote · a URL → link · otherwise a note. Use == before the source. Drop or paste images.'
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        onPaste={(e) => {
          if (e.clipboardData.files.length) {
            e.preventDefault();
            handleFiles(e.clipboardData.files);
          }
        }}
      />
      {value.trim() !== "" && (
        <button className="quickadd-save" onClick={submit}>
          Save
        </button>
      )}
    </div>
  );
}
