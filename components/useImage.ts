"use client";

import { useEffect, useState } from "react";
import { getImage } from "@/lib/db";

/** Load a stored image blob and expose it as an object URL. */
export function useImage(
  imageId: string | undefined,
  kind: "full" | "thumb" = "thumb"
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!imageId) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    getImage(imageId).then((img) => {
      if (!img || cancelled) return;
      objectUrl = URL.createObjectURL(img[kind]);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageId, kind]);

  return url;
}
