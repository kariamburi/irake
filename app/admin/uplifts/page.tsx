// app/admin/donations/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  documentId,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  text: "#0F172A",
  dim: "#6B7280",
  hair: "#E5E7EB",
};

type DonationRow = {
  id: string;
  deedId?: string;
  creatorId?: string;
  donorId?: string;
  amount?: number;
  currency?: string;
  status?: string;
  createdAt?: any;
  paidAt?: any;
  grossAmountUsdMinor?: number;
  platformShareUsdMinor?: number;
  creatorShareNetUsdMinor?: number;
};

type DonationFilter = "all" | "pending" | "succeeded" | "failed";

type UserLite = {
  handle?: string; // "@skya"
  handleLower?: string; // "skya"
  username?: string;
  photoURL?: string;
  imageUrl?: string;
  photo?: string;
  firstName?: string;
  surname?: string;
  lastName?: string;
};

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function handleSlug(handle?: string) {
  if (!handle) return "";
  return String(handle).replace(/^@+/, "").trim();
}

function initialsFrom(handle?: string, uid?: string) {
  const base = handleSlug(handle) || (uid ? uid.slice(0, 2) : "U");
  return base.slice(0, 2).toUpperCase();
}

function formatMoneyMinor(n?: number, currency?: string) {
  if (!n || n <= 0) return "—";
  const unit = n / 100;
  const label = currency === "KES" ? "KSh" : currency || "";
  return `${label} ${unit.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`.trim();
}

function formatDate(ts: any) {
  if (!ts) return "—";
  if (ts.toDate) return ts.toDate().toLocaleString();
  return String(ts);
}

function statusPill(status?: string) {
  const s = String(status || "unknown").toLowerCase();
  const bg =
    s === "succeeded" ? "#DCFCE7" : s === "pending" ? "#FEF9C3" : "#FEE2E2";
  const fg =
    s === "succeeded" ? "#15803D" : s === "pending" ? "#92400E" : "#B91C1C";
  return { s, bg, fg };
}

function UserChip({
  uid,
  user,
}: {
  uid?: string;
  user?: UserLite | null;
}) {
  if (!uid) return <span className="text-[11px] text-gray-400">—</span>;

  const photo = user?.photoURL || user?.imageUrl || user?.photo || null;
  const handle = user?.handle || user?.username || null;
  const slug = user?.handleLower || handleSlug(handle || "");
  const href = slug ? `/${slug}` : null;
  const initials = initialsFrom(handle || undefined, uid);

  const Avatar = (
    <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
      {photo ? (
        <Image
          src={photo}
          alt={handle || uid}
          width={32}
          height={32}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );

  const Handle = handle ? (
    href ? (
      <Link
        href={href}
        className="text-xs font-semibold text-emerald-700 hover:underline truncate"
        title={handle}
      >
        {handle}
      </Link>
    ) : (
      <span className="text-xs font-semibold text-slate-800 truncate">{handle}</span>
    )
  ) : (
    <span className="text-xs font-semibold text-slate-800 truncate">
      {uid.slice(0, 6)}…
    </span>
  );

  const Body = (
    <div className="flex flex-col min-w-0">
      {Handle}
      <span className="text-[10px] text-slate-400 font-mono truncate">{uid}</span>
    </div>
  );

  return (
    <div className="flex items-center gap-2 min-w-0">
      {href ? <Link href={href}>{Avatar}</Link> : Avatar}
      {Body}
    </div>
  );
}

export default function AdminDonationsPage() {
  const [rows, setRows] = useState<DonationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<DonationFilter>("all");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // pagination (manual “Load more”)
  const [cursor, setCursor] = useState<any | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // users cache for creator/donor chips
  const [usersMap, setUsersMap] = useState<Record<string, UserLite>>({});

  const makeBaseQuery = useCallback(() => {
    const base = collection(db, "donations");

    if (filter === "pending" || filter === "succeeded") {
      return query(
        base,
        where("status", "==", filter),
        orderBy("createdAt", "desc"),
        limit(30)
      );
    }

    return query(base, orderBy("createdAt", "desc"), limit(30));
  }, [filter]);

  // live load first page
  useEffect(() => {
    setLoading(true);
    setCursor(null);
    setHasMore(true);

    const q = makeBaseQuery();

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as DonationRow[];

        setRows(next);
        setCursor(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
        setHasMore(snap.docs.length >= 30);
        setLoading(false);
      },
      (err) => {
        console.error("donations snapshot error", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [makeBaseQuery]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);

      const base = collection(db, "donations");
      let qMore;

      if (filter === "pending" || filter === "succeeded") {
        qMore = query(
          base,
          where("status", "==", filter),
          orderBy("createdAt", "desc"),
          startAfter(cursor),
          limit(30)
        );
      } else {
        qMore = query(base, orderBy("createdAt", "desc"), startAfter(cursor), limit(30));
      }

      const snap = await getDocs(qMore);
      const next = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as DonationRow[];

      setRows((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...next.filter((x) => !seen.has(x.id))];
      });

      setCursor(snap.docs.length ? snap.docs[snap.docs.length - 1] : cursor);
      setHasMore(snap.docs.length >= 30);
    } catch (err) {
      console.error("load more uplifts error", err);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, filter, hasMore, loadingMore]);

  const deletePending = useCallback(async (row: DonationRow) => {
    const st = String(row.status || "").toLowerCase();
    if (st !== "pending") return;

    const ok = window.confirm(
      `Delete this pending uplift?\n\nID: ${row.id}\n\nThis cannot be undone.`
    );
    if (!ok) return;

    try {
      setDeletingId(row.id);
      await deleteDoc(doc(db, "donations", row.id));
      setRows((prev) => prev.filter((x) => x.id !== row.id));
    } catch (err) {
      console.error("delete pending uplift error", err);
      alert("Failed to delete. Check console / permissions.");
    } finally {
      setDeletingId(null);
    }
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = rows;

    // "failed" bucket is any status that's not pending/succeeded
    if (filter === "failed") {
      list = list.filter((r) => {
        const s = String(r.status || "").toLowerCase();
        return s && s !== "pending" && s !== "succeeded";
      });
    }

    if (!q) return list;

    return list.filter((r) => {
      const hay = [r.id, r.deedId, r.creatorId, r.donorId, r.status, r.currency]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [rows, filter, search]);

  // ✅ fetch users for creatorId + donorId (batched)
  useEffect(() => {
    const ids = Array.from(
      new Set(
        filtered
          .flatMap((r) => [r.creatorId, r.donorId])
          .filter(Boolean) as string[]
      )
    );

    const missing = ids.filter((id) => !usersMap[id]);
    if (missing.length === 0) return;

    let cancelled = false;

    (async () => {
      try {
        const nextMap: Record<string, UserLite> = {};
        for (const group of chunk(missing, 10)) {
          const qy = query(collection(db, "users"), where(documentId(), "in", group));
          const snap = await getDocs(qy);
          snap.forEach((d) => {
            nextMap[d.id] = (d.data() as any) || {};
          });
        }
        if (!cancelled && Object.keys(nextMap).length) {
          setUsersMap((prev) => ({ ...prev, ...nextMap }));
        }
      } catch (e) {
        console.error("Fetch users for donations page failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  const FilterChip = ({ label, value }: { label: string; value: DonationFilter }) => {
    const active = filter === value;
    return (
      <button
        type="button"
        onClick={() => setFilter(value)}
        className="inline-flex items-center gap-2 rounded-full border px-3 h-9 text-[11px] font-extrabold transition"
        style={{
          borderColor: active ? EKARI.forest : EKARI.hair,
          color: active ? EKARI.forest : EKARI.text,
          background: active ? "rgba(35,63,57,0.06)" : "#fff",
        }}
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{
            background:
              value === "pending"
                ? "#F59E0B"
                : value === "succeeded"
                  ? "#16A34A"
                  : value === "failed"
                    ? "#DC2626"
                    : EKARI.dim,
          }}
        />
        {label}
      </button>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-sm border border-slate-200 w-fit mb-2">
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: EKARI.forest }}
            >
              ⓔ
            </span>
            <span
              className="text-[11px] font-semibold tracking-[0.16em] uppercase"
              style={{ color: EKARI.dim }}
            >
              Admin • Uplifts
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold" style={{ color: EKARI.text }}>
            Uplifts
          </h1>
          <p className="text-sm" style={{ color: EKARI.dim }}>
            View all uplifts. You can delete only{" "}
            <span className="font-semibold">pending</span> items.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/overview"
            className="inline-flex items-center justify-center rounded-full border px-4 h-10 text-xs font-extrabold hover:bg-gray-50"
            style={{ borderColor: EKARI.hair, color: EKARI.text }}
          >
            ← Back to overview
          </Link>
        </div>
      </div>

      {/* Controls */}
      <div
        className="rounded-2xl border bg-white p-3 md:p-4 shadow-sm"
        style={{ borderColor: EKARI.hair }}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip label="All" value="all" />
            <FilterChip label="Pending" value="pending" />
            <FilterChip label="Succeeded" value="succeeded" />
            <FilterChip label="Failed" value="failed" />
          </div>

          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 rounded-full border px-3 h-10 bg-white"
              style={{ borderColor: EKARI.hair }}
            >
              <span className="text-[11px]" style={{ color: EKARI.dim }}>
                Search
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="id, deedId, creatorId, donorId…"
                className="outline-none text-sm w-[220px] md:w-[280px]"
                style={{ color: EKARI.text }}
              />
            </div>
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="inline-flex items-center justify-center rounded-full border px-4 h-10 text-xs font-extrabold hover:bg-gray-50"
                style={{ borderColor: EKARI.hair, color: EKARI.text }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl border shadow-sm bg-white overflow-hidden"
        style={{ borderColor: EKARI.hair }}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="text-left px-4 py-3 font-semibold">Uplift</th>
                <th className="text-left px-2 py-3 font-semibold">Creator</th>
                <th className="text-left px-2 py-3 font-semibold">Donor</th>
                <th className="text-left px-2 py-3 font-semibold">Amount</th>
                <th className="text-left px-2 py-3 font-semibold">Status</th>
                <th className="text-left px-2 py-3 font-semibold">Created</th>
                <th className="text-left px-2 py-3 font-semibold">Paid</th>
                <th className="text-left px-2 py-3 font-semibold">USD splits</th>
                <th className="text-right px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    No uplifts found.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => {
                  const { s, bg, fg } = statusPill(d.status);
                  const canDelete = s === "pending";
                  const deleting = deletingId === d.id;

                  const gross = d.grossAmountUsdMinor ? d.grossAmountUsdMinor / 100 : null;
                  const platform = d.platformShareUsdMinor ? d.platformShareUsdMinor / 100 : null;
                  const creatorUsd = d.creatorShareNetUsdMinor ? d.creatorShareNetUsdMinor / 100 : null;

                  const creatorUser = d.creatorId ? usersMap[d.creatorId] : null;
                  const donorUser = d.donorId ? usersMap[d.donorId] : null;

                  return (
                    <tr
                      key={d.id}
                      className="border-t text-gray-700 hover:bg-gray-50"
                      style={{ borderColor: EKARI.hair }}
                    >
                      <td className="px-4 py-3">
                        <div className="font-mono text-[11px]">{d.id}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          Deed: {d.deedId?.slice(0, 12) ?? "—"}
                        </div>
                      </td>

                      <td className="px-2 py-3">
                        <UserChip uid={d.creatorId} user={creatorUser} />
                      </td>

                      <td className="px-2 py-3">
                        <UserChip uid={d.donorId} user={donorUser} />
                      </td>

                      <td className="px-2 py-3">
                        <div className="font-extrabold text-[12px]">
                          {formatMoneyMinor(d.amount, d.currency)}
                        </div>
                        <div className="text-[11px] text-gray-500">{d.currency || "—"}</div>
                      </td>

                      <td className="px-2 py-3">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ backgroundColor: bg, color: fg }}
                        >
                          {d.status || "unknown"}
                        </span>
                      </td>

                      <td className="px-2 py-3 text-[11px] text-gray-500">
                        {formatDate(d.createdAt)}
                      </td>

                      <td className="px-2 py-3 text-[11px] text-gray-500">
                        {formatDate(d.paidAt)}
                      </td>

                      <td className="px-2 py-3 text-[11px] text-gray-500">
                        <div>
                          Gross:{" "}
                          <span className="font-semibold" style={{ color: EKARI.text }}>
                            {gross == null
                              ? "—"
                              : `USD ${gross.toLocaleString("en-KE", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`}
                          </span>
                        </div>
                        <div>
                          Creator:{" "}
                          <span className="font-semibold" style={{ color: EKARI.text }}>
                            {creatorUsd == null
                              ? "—"
                              : `USD ${creatorUsd.toLocaleString("en-KE", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`}
                          </span>
                        </div>
                        <div>
                          Platform:{" "}
                          <span className="font-semibold text-emerald-700">
                            {platform == null
                              ? "—"
                              : `USD ${platform.toLocaleString("en-KE", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => deletePending(d)}
                            disabled={deleting}
                            className="inline-flex items-center justify-center rounded-full border px-3 h-9 text-[11px] font-extrabold transition disabled:opacity-60"
                            style={{
                              borderColor: "#FCA5A5",
                              color: "#991B1B",
                              background: "#FEF2F2",
                            }}
                          >
                            {deleting ? "Deleting…" : "Delete"}
                          </button>
                        ) : (
                          <span className="text-[11px] text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-4 py-3 border-t"
          style={{ borderColor: EKARI.hair }}
        >
          <div className="text-[11px]" style={{ color: EKARI.dim }}>
            Showing{" "}
            <span className="font-semibold" style={{ color: EKARI.text }}>
              {filtered.length}
            </span>{" "}
            row(s)
            {filter !== "all" ? ` • filter: ${filter}` : ""}
            {search ? " • search applied" : ""}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadMore}
              disabled={!hasMore || loadingMore}
              className="inline-flex items-center justify-center rounded-full border px-4 h-10 text-xs font-extrabold hover:bg-gray-50 disabled:opacity-60"
              style={{ borderColor: EKARI.hair, color: EKARI.text }}
            >
              {loadingMore ? "Loading…" : hasMore ? "Load more" : "No more"}
            </button>
          </div>
        </div>
      </div>

      <div className="text-[11px]" style={{ color: EKARI.dim }}>
        Tip: If you want “failed” to be strict server-side, we can map your exact failure statuses
        and query them explicitly.
      </div>
    </div>
  );
}