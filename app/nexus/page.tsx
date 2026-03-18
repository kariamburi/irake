import { Suspense } from "react";
import NexusClient from "./NexusClient";

export const dynamic = "force-dynamic";

function NexusFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      Loading Nexus...
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<NexusFallback />}>
      <NexusClient />
    </Suspense>
  );
}