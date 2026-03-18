import { Suspense } from "react";
import SavedEventsClient from "./SavedEventsClient";

export const dynamic = "force-dynamic";

function SavedEventsFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      Loading saved events...
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<SavedEventsFallback />}>
      <SavedEventsClient />
    </Suspense>
  );
}