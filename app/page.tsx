"use client";

import dynamic from "next/dynamic";

// The whole app is client-side (IndexedDB, camera, OCR), so skip SSR.
const App = dynamic(() => import("@/components/App"), { ssr: false });

export default function Page() {
  return <App />;
}
