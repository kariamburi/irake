"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import { IoAdd, IoTrashOutline, IoCreateOutline } from "react-icons/io5";

/* ---------- Brand ---------- */
const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  hair: "#E5E7EB",
  text: "#0F172A",
  dim: "#6B7280",
  danger: "#B42318",
};

type TaxGroup = {
  id: string;
  title: string;
  items: string[];
  order?: number;
  active?: boolean;
};

type TabKey = "interests" | "roles";

/* ---------- Helper: slug from title ---------- */
function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/* ---------- Helper: parse items (textarea) ---------- */
function parseItems(raw: string): string[] {
  return raw
    .split(/[\n,]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ---------- Helper: stringify items for textarea ---------- */
function stringifyItems(items: string[]): string {
  return items.join("\n");
}

export default function TaxonomyAdminPage() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<TabKey>("interests");

  const [interestGroups, setInterestGroups] = useState<TaxGroup[]>([]);
  const [roleGroups, setRoleGroups] = useState<TaxGroup[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [itemsText, setItemsText] = useState("");
  const [order, setOrder] = useState<string>("");
  const [active, setActive] = useState(true);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Optional: only allow your admin user
  const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID || "";

  const allowed =
    !loading &&
    user &&
    (ADMIN_UID ? user.uid === ADMIN_UID : true); // if no ADMIN_UID, any logged-in user can access

  /* ---------- Subscribe to Firestore ---------- */
  useEffect(() => {
    const q1 = query(
      collection(db, "interest_groups"),
      orderBy("order", "asc")
    );
    const unsub1 = onSnapshot(q1, (snap) => {
      const rows: TaxGroup[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        rows.push({
          id: d.id,
          title: data.title ?? "",
          items: data.items ?? [],
          order: data.order ?? 0,
          active: data.active ?? true,
        });
      });
      setInterestGroups(rows);
    });

    const q2 = query(collection(db, "role_groups"), orderBy("order", "asc"));
    const unsub2 = onSnapshot(q2, (snap) => {
      const rows: TaxGroup[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        rows.push({
          id: d.id,
          title: data.title ?? "",
          items: data.items ?? [],
          order: data.order ?? 0,
          active: data.active ?? true,
        });
      });
      setRoleGroups(rows);
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  const currentGroups = tab === "interests" ? interestGroups : roleGroups;
  const collectionName = tab === "interests" ? "interest_groups" : "role_groups";

  /* ---------- Select group for editing ---------- */
  function startNew() {
    setSelectedId(null);
    setTitle("");
    setItemsText("");
    setOrder(String((currentGroups[currentGroups.length - 1]?.order ?? 0) + 1));
    setActive(true);
    setMsg(null);
    setError(null);
  }

  function startEdit(group: TaxGroup) {
    setSelectedId(group.id);
    setTitle(group.title ?? "");
    setItemsText(stringifyItems(group.items ?? []));
    setOrder(
      group.order != null && !Number.isNaN(group.order)
        ? String(group.order)
        : ""
    );
    setActive(group.active ?? true);
    setMsg(null);
    setError(null);
  }

  /* ---------- Save (add / update) ---------- */
  async function save() {
    if (!allowed) return;
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    const items = parseItems(itemsText);
    if (items.length === 0) {
      setError("Add at least one item.");
      return;
    }
    const orderNum = order ? Number(order) : 0;

    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const id = selectedId || slugifyTitle(title.trim());
      await setDoc(
        doc(db, collectionName, id),
        {
          title: title.trim(),
          items,
          order: orderNum,
          active,
        },
        { merge: true }
      );
      setMsg("Saved successfully.");
      if (!selectedId) {
        // if new, keep selected to allow further edits
        setSelectedId(id);
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to save.");
    } finally {
      setBusy(false);
    }
  }

  /* ---------- Delete ---------- */
  async function remove(id: string) {
    if (!allowed) return;
    const ok = window.confirm("Delete this group permanently?");
    if (!ok) return;

    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await deleteDoc(doc(db, collectionName, id));
      if (selectedId === id) {
        startNew();
      }
      setMsg("Deleted.");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to delete.");
    } finally {
      setBusy(false);
    }
  }

  /* ---------- UI ---------- */
  const headerTitle =
    tab === "interests" ? "Interest groups" : "Role groups";

  return (
    <main
      className="min-h-screen w-full flex items-center justify-center px-4 py-6"
      style={{ backgroundColor: EKARI.sand }}
    >
      <div
        className="w-full max-w-5xl rounded-2xl border p-4 md:p-6 grid grid-cols-1 md:grid-cols-[1.2fr,1fr] gap-6"
        style={{ borderColor: EKARI.hair, backgroundColor: "#FFFFFF" }}
      >
        {/* Left: list + tabs */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h1
              className="text-lg md:text-xl font-black"
              style={{ color: EKARI.text }}
            >
              Taxonomy Admin
            </h1>
            <span className="text-[11px] font-semibold px-2 py-1 rounded-full border"
              style={{ borderColor: EKARI.hair, color: EKARI.dim }}
            >
              {user?.email || user?.uid}
            </span>
          </div>

          {/* Tabs */}
          <div className="mb-3 flex gap-2">
            <button
              className="rounded-full px-3 py-1.5 text-xs md:text-sm font-bold border"
              style={{
                borderColor: tab === "interests" ? EKARI.forest : EKARI.hair,
                background: tab === "interests" ? EKARI.forest : "#fff",
                color: tab === "interests" ? "#fff" : EKARI.text,
              }}
              onClick={() => {
                setTab("interests");
                startNew();
              }}
            >
              Interests
            </button>
            <button
              className="rounded-full px-3 py-1.5 text-xs md:text-sm font-bold border"
              style={{
                borderColor: tab === "roles" ? EKARI.forest : EKARI.hair,
                background: tab === "roles" ? EKARI.forest : "#fff",
                color: tab === "roles" ? "#fff" : EKARI.text,
              }}
              onClick={() => {
                setTab("roles");
                startNew();
              }}
            >
              Roles
            </button>
          </div>

          {!allowed ? (
            <p className="text-sm" style={{ color: EKARI.danger }}>
              {loading
                ? "Checking your account…"
                : "You are not allowed to access this page."}
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <div
                  className="text-sm font-semibold"
                  style={{ color: EKARI.dim }}
                >
                  {headerTitle} ({currentGroups.length})
                </div>
                <button
                  type="button"
                  onClick={startNew}
                  className="flex items-center gap-1 text-xs font-bold rounded-full border px-3 py-1.5"
                  style={{
                    borderColor: EKARI.forest,
                    color: EKARI.forest,
                    background: "#fff",
                  }}
                >
                  <IoAdd size={14} />
                  New group
                </button>
              </div>

              <div className="flex-1 overflow-auto border rounded-xl p-2"
                style={{ borderColor: EKARI.hair, maxHeight: 450 }}
              >
                {currentGroups.length === 0 ? (
                  <div
                    className="text-xs md:text-sm text-center py-6"
                    style={{ color: EKARI.dim }}
                  >
                    No groups found. Use “New group” to create one.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {currentGroups.map((g) => {
                      const selected = g.id === selectedId;
                      return (
                        <li
                          key={g.id}
                          className="flex items-center justify-between rounded-lg border px-2 py-1.5 text-xs md:text-sm"
                          style={{
                            borderColor: selected ? EKARI.forest : EKARI.hair,
                            background: selected ? "#F0FDF4" : "#fff",
                          }}
                        >
                          <button
                            type="button"
                            className="flex flex-col items-start flex-1 text-left"
                            onClick={() => startEdit(g)}
                          >
                            <span
                              className="font-semibold"
                              style={{ color: EKARI.text }}
                            >
                              {g.title}
                            </span>
                            <span
                              className="text-[11px] mt-0.5"
                              style={{ color: EKARI.dim }}
                            >
                              {g.items.length} items • order {g.order ?? 0} •{" "}
                              {g.active ? "active" : "inactive"}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(g.id)}
                            className="ml-2 p-1 rounded-full hover:bg-red-50"
                          >
                            <IoTrashOutline size={16} color={EKARI.danger} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: editor */}
        <div className="flex flex-col">
          <h2
            className="text-sm font-bold mb-2"
            style={{ color: EKARI.text }}
          >
            {selectedId ? "Edit group" : "New group"}
          </h2>

          <div className="space-y-3 text-sm">
            <div>
              <div
                className="text-[12px] font-semibold mb-1"
                style={{ color: EKARI.dim }}
              >
                Title
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{
                  borderColor: EKARI.hair,
                  background: "#F6F7FB",
                  color: EKARI.text,
                }}
                placeholder={
                  tab === "interests"
                    ? "e.g. Crops & Products"
                    : "e.g. Primary Producer"
                }
              />
            </div>

            <div>
              <div
                className="text-[12px] font-semibold mb-1"
                style={{ color: EKARI.dim }}
              >
                Items (one per line or comma-separated)
              </div>
              <textarea
                value={itemsText}
                onChange={(e) => setItemsText(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm min-h-[140px]"
                style={{
                  borderColor: EKARI.hair,
                  background: "#F6F7FB",
                  color: EKARI.text,
                }}
                placeholder={
                  tab === "interests"
                    ? "Maize\nTomato\nPotato\n…"
                    : "Farmer\nBeekeeper\nAggregator\n…"
                }
              />
              <div
                className="mt-1 text-[11px]"
                style={{ color: EKARI.dim }}
              >
                We’ll split on new lines or commas.
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <div
                  className="text-[12px] font-semibold mb-1"
                  style={{ color: EKARI.dim }}
                >
                  Order
                </div>
                <input
                  value={order}
                  onChange={(e) => setOrder(e.target.value.replace(/[^\d]/g, ""))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    borderColor: EKARI.hair,
                    background: "#F6F7FB",
                    color: EKARI.text,
                  }}
                  placeholder="1"
                />
              </div>

              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                  <span style={{ color: EKARI.text }}>Active</span>
                </label>
              </div>
            </div>

            {msg && (
              <div
                className="mt-1 rounded-lg px-3 py-2 text-xs"
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
                className="mt-1 rounded-lg px-3 py-2 text-xs"
                style={{
                  backgroundColor: "#FEF2F2",
                  color: "#B91C1C",
                  border: "1px solid #FECACA",
                }}
              >
                {error}
              </div>
            )}

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={!allowed || busy}
                className="flex-1 rounded-xl py-2.5 font-extrabold text-white flex items-center justify-center gap-1 text-sm active:scale-[0.98] transition"
                style={{
                  backgroundColor: EKARI.gold,
                  opacity: busy || !allowed ? 0.7 : 1,
                }}
              >
                <IoCreateOutline size={16} />
                {busy ? "Saving…" : "Save group"}
              </button>
              <button
                type="button"
                onClick={startNew}
                disabled={busy}
                className="rounded-xl py-2.5 px-4 font-extrabold text-sm border"
                style={{
                  borderColor: EKARI.hair,
                  color: EKARI.text,
                  background: "#fff",
                  opacity: busy ? 0.7 : 1,
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
