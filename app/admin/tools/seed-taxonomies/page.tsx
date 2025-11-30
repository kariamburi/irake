// app/admin/seed-taxonomies/page.tsx
"use client";

import React, { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  INTEREST_GROUPS,
  ROLE_GROUPS,
} from "@/app/constants/constants";
import { useAuth } from "@/app/hooks/useAuth";

/* ---------- Optional: reuse EKARI palette ---------- */
const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  hair: "#E5E7EB",
  text: "#0F172A",
  dim: "#6B7280",
  danger: "#B42318",
};

/* ---------- Helper: slug from title ---------- */
function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export default function SeedTaxonomiesPage() {
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ⚠️ Optional: lock this down to your own UID
  const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID || ""; // or hard-code your uid

  const allowed =
    !loading &&
    user &&
    (ADMIN_UID ? user.uid === ADMIN_UID : true); // if ADMIN_UID not set, any logged-in user can run

  async function seed() {
    if (!allowed) {
      setError("Not allowed.");
      return;
    }
    setBusy(true);
    setMsg(null);
    setError(null);

    try {
      // 1) interest_groups
      await Promise.all(
        INTEREST_GROUPS.map((g, index) => {
          const id = slugifyTitle(g.title || `group_${index + 1}`);
          const ref = doc(db, "interest_groups", id);
          return setDoc(
            ref,
            {
              title: g.title,
              items: g.items,
              order: index + 1,
              active: true,
            },
            { merge: true } // idempotent
          );
        })
      );

      // 2) role_groups
      await Promise.all(
        ROLE_GROUPS.map((g, index) => {
          const id = slugifyTitle(g.title || `group_${index + 1}`);
          const ref = doc(db, "role_groups", id);
          return setDoc(
            ref,
            {
              title: g.title,
              items: g.items,
              order: index + 1,
              active: true,
            },
            { merge: true }
          );
        })
      );

      setMsg("✅ Seeded interest_groups and role_groups successfully.");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to seed taxonomies.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: EKARI.sand }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border p-5 shadow-sm"
        style={{ borderColor: EKARI.hair, backgroundColor: "#FFFFFF" }}
      >
        <h1
          className="text-xl font-black mb-1"
          style={{ color: EKARI.text }}
        >
          Seed Taxonomies
        </h1>
        <p className="text-sm mb-4" style={{ color: EKARI.dim }}>
          This will write{" "}
          <code className="px-1 rounded bg-gray-100 text-xs">
            interest_groups
          </code>{" "}
          and{" "}
          <code className="px-1 rounded bg-gray-100 text-xs">
            role_groups
          </code>{" "}
          into Firestore from your constants.
          <br />
          Safe to run multiple times (uses <strong>merge</strong>).
        </p>

        {loading ? (
          <p style={{ color: EKARI.dim }}>Checking your account…</p>
        ) : !user ? (
          <p style={{ color: EKARI.danger }}>
            Please log in to run this seeder.
          </p>
        ) : !allowed ? (
          <p style={{ color: EKARI.danger }}>
            Your account is not allowed to run this seeder.
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={seed}
              disabled={busy}
              className="w-full rounded-xl py-3 font-extrabold text-white active:scale-[0.98] transition"
              style={{
                backgroundColor: EKARI.gold,
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? "Seeding…" : "Seed interest & role groups"}
            </button>

            <p className="mt-2 text-xs" style={{ color: EKARI.dim }}>
              Make sure you’ve committed the latest{" "}
              <code>INTEREST_GROUPS</code> / <code>ROLE_GROUPS</code> in{" "}
              <code>/app/constants/constants.ts</code>.
            </p>
          </>
        )}

        {msg && (
          <div
            className="mt-3 rounded-lg px-3 py-2 text-sm"
            style={{
              backgroundColor: "#ECFDF3",
              color: "#166534",
              border: "1px solid #BBF7D0",
            }}
          >
            {msg}
          </div>
        )}
        {error && (
          <div
            className="mt-3 rounded-lg px-3 py-2 text-sm"
            style={{
              backgroundColor: "#FEF2F2",
              color: "#B91C1C",
              border: "1px solid #FECACA",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
