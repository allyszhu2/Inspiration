"use client";

import { useState } from "react";
import {
  disableSync,
  enableSync,
  isSyncEnabled,
  getPasscode,
  lastSyncedAt,
} from "@/lib/sync";

interface SyncSheetProps {
  /** Called after enabling — the app runs a first sync. */
  onEnabled: () => void;
  onClose: () => void;
}

export default function SyncSheet({ onEnabled, onClose }: SyncSheetProps) {
  const [passcode, setPasscode] = useState(getPasscode());
  const enabled = isSyncEnabled();
  const last = lastSyncedAt();

  function save() {
    if (!passcode.trim()) return;
    enableSync(passcode.trim());
    onEnabled();
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2 className="sheet-title">Sync across devices</h2>

        <p style={{ color: "var(--ink-soft)", marginBottom: 16, fontSize: 14 }}>
          Enter the same passcode on each device and your collection stays in
          sync everywhere — cards, photos, and memory progress. Everything
          still works offline; changes catch up next time you’re online.
        </p>

        {enabled && (
          <p className="detail-date">
            {last
              ? `Last synced ${new Date(last).toLocaleString()}`
              : "Not synced yet"}
          </p>
        )}

        <div className="field">
          <label htmlFor="sync-passcode">Passcode</label>
          <input
            id="sync-passcode"
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="Your sync passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
          />
        </div>

        <div className="btn-row">
          {enabled && (
            <button
              className="btn btn-danger"
              onClick={() => {
                disableSync();
                onClose();
              }}
            >
              Turn off sync
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!passcode.trim()}
            onClick={save}
          >
            {enabled ? "Save & sync" : "Enable sync"}
          </button>
        </div>
      </div>
    </div>
  );
}
