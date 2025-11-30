// app/admin/tools/seed-market/page.tsx
"use client";

import { seedMarketTaxonomy } from "@/lib/seedMarketTaxonomy";
import React, { useState } from "react";


export default function SeedMarketPage() {
  const [status, setStatus] = useState<null | string>(null);
  const [running, setRunning] = useState(false);

  const handleSeed = async () => {
    if (running) return;
    setRunning(true);
    setStatus("Seeding...");
    try {
      await seedMarketTaxonomy();
      setStatus("✅ Done! Check Firestore collections: market_types & market_categories.");
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Failed: ${err?.message ?? "Unknown error"}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Seed Market Taxonomy</h1>
      <p className="text-sm text-gray-600">
        This will scan <code>MARKET_CATALOG</code> and create/merge documents in:
        <br />
        <code>market_types</code> and <code>market_categories</code>.
      </p>
      <button
        onClick={handleSeed}
        disabled={running}
        className="px-4 py-2 rounded bg-emerald-600 text-white text-sm disabled:opacity-60"
      >
        {running ? "Running..." : "Run seeding"}
      </button>
      {status && <p className="text-sm mt-2">{status}</p>}
    </div>
  );
}
