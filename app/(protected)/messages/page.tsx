// app/messages/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  Timestamp,
  DocumentSnapshot,
} from "firebase/firestore";
import { IoChevronForward, IoSearchOutline } from "react-icons/io5";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import SmartAvatar from "@/app/components/SmartAvatar";
import clsx from "clsx";

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  text: "#0F172A",
  dim: "#6B7280",
  hair: "#E5E7EB",
  sub: "#5C6B66",
};

type UserLite = {
  firstName?: string;
  surname?: string;
  handle?: string;
  photoURL?: string;
};

type LastMessage =
  | { type: "text"; text: string; from: string; to: string; createdAt: any }
  | { type: "image"; from: string; to: string; createdAt: any }
  | { type: "audio"; from: string; to: string; createdAt: any }
  | undefined;

type ThreadMirror = {
  threadId: string;
  peerId: string;
  unread?: number;
  updatedAt?: any;
};

type RowData = {
  threadId: string;
  peerId: string;
  peer: UserLite | null;
  lastMessage?: LastMessage;
  unread: number;
  updatedAt?: any;
};

function tsToDate(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts?.toDate === "function") return ts.toDate();
  if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000);
  if (ts instanceof Date) return ts;
  if (typeof ts === "number") return new Date(ts);
  return null;
}

function shortTime(ts: any) {
  const d = tsToDate(ts);
  if (!d) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (sameDay) {
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const hh = ((h + 11) % 12) + 1;
    return `${hh}:${m} ${ampm}`;
  }
  const mon = d.toLocaleString(undefined, { month: "short" });
  const day = d.getDate();
  return `${mon} ${day}`;
}

function previewOf(last?: LastMessage) {
  if (!last) return "";
  if (last.type === "text") return last.text || "";
  if (last.type === "image") return "📷 Photo";
  if (last.type === "audio") return "🎤 Voice message";
  return "";
}

/* ----------------------------- Page ----------------------------- */
export default function MessagesPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const router = useRouter();

  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [cursor, setCursor] = useState<DocumentSnapshot | null>(null);

  // UI state
  const [qStr, setQStr] = useState("");
  const [tab, setTab] = useState<"all" | "unread">("all");

  // caches to avoid extra reads
  const userCache = useRef<Map<string, UserLite | null>>(new Map());
  const threadCache = useRef<Map<string, LastMessage | undefined>>(new Map());

  const fetchPeer = useCallback(
    async (peerId: string) => {
      if (userCache.current.has(peerId)) return userCache.current.get(peerId)!;
      const snap = await getDoc(doc(db, "users", peerId));
      const data = (snap.exists() ? (snap.data() as any) : null) as UserLite | null;
      userCache.current.set(peerId, data);
      return data;
    },
    []
  );

  const fetchLastMessage = useCallback(
    async (threadId: string) => {
      if (threadCache.current.has(threadId)) return threadCache.current.get(threadId);
      const tSnap = await getDoc(doc(db, "threads", threadId));
      const data = tSnap.data() as any;
      const last: LastMessage | undefined = data?.lastMessage;
      threadCache.current.set(threadId, last);
      return last;
    },
    []
  );

  // initial + live list
  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    const qy = query(
      collection(db, "userThreads", uid, "threads"),
      orderBy("updatedAt", "desc"),
      limit(25)
    );
    const unsub = onSnapshot(qy, async (snap) => {
      setCursor(snap.docs.at(-1) ?? null);
      const base: RowData[] = await Promise.all(
        snap.docs.map(async (d) => {
          const m = d.data() as ThreadMirror;
          const [peer, lastMessage] = await Promise.all([
            fetchPeer(m.peerId),
            fetchLastMessage(m.threadId),
          ]);
          return {
            threadId: m.threadId,
            peerId: m.peerId,
            peer: peer ?? null,
            lastMessage,
            unread: m.unread ?? 0,
            updatedAt: (d.data() as any).updatedAt,
          };
        })
      );
      setRows(base);
      setLoading(false);
    });
    return () => unsub();
  }, [uid, fetchPeer, fetchLastMessage]);

  const loadMore = useCallback(async () => {
    if (!uid || !cursor || paging) return;
    setPaging(true);
    try {
      const qMore = query(
        collection(db, "userThreads", uid, "threads"),
        orderBy("updatedAt", "desc"),
        startAfter(cursor),
        limit(25)
      );
      const snap = await getDocs(qMore);
      setCursor(snap.docs.at(-1) ?? null);

      const extra: RowData[] = await Promise.all(
        snap.docs.map(async (d) => {
          const m = d.data() as ThreadMirror;
          const [peer, lastMessage] = await Promise.all([
            fetchPeer(m.peerId),
            fetchLastMessage(m.threadId),
          ]);
          return {
            threadId: m.threadId,
            peerId: m.peerId,
            peer: peer ?? null,
            lastMessage,
            unread: m.unread ?? 0,
            updatedAt: (d.data() as any).updatedAt,
          };
        })
      );
      setRows((prev) => [...prev, ...extra]);
    } finally {
      setPaging(false);
    }
  }, [uid, cursor, paging, fetchPeer, fetchLastMessage]);

  const openThread = (row: RowData) => {
    const peerName = row.peer?.firstName ?? "";
    const peerPhotoURL = row.peer?.photoURL ?? "";
    const peerHandle = row.peer?.handle ?? "";
    const q = new URLSearchParams({
      peerId: row.peerId,
      peerName,
      peerPhotoURL,
      peerHandle,
    });
    router.push(`/messages/${row.threadId}?${q.toString()}`);
  };

  /* ----------------------------- Derived UI data ----------------------------- */
  const filtered = useMemo(() => {
    const term = qStr.trim().toLowerCase();
    let list = rows;
    if (tab === "unread") list = list.filter((r) => (r.unread ?? 0) > 0);

    if (!term) return list;
    return list.filter((r) => {
      const name = r.peer?.firstName || "";
      const handle = r.peer?.handle || "";
      const last = previewOf(r.lastMessage) || "";
      return (
        name.toLowerCase().includes(term) ||
        handle.toLowerCase().includes(term) ||
        last.toLowerCase().includes(term)
      );
    });
  }, [rows, qStr, tab]);

  /* ----------------------------- UI ----------------------------- */

  // Shared ring color for focusable elements
  const ringStyle: React.CSSProperties = { ["--tw-ring-color" as any]: EKARI.forest };

  return (
    <AppShell>
      <div className="min-h-screen w-full" style={{ backgroundColor: EKARI.sand }}>
        {/* Sticky header */}
        <div
          className="sticky top-0 z-20 backdrop-blur border-b"
          style={{ backgroundColor: "rgba(255,255,255,0.85)", borderColor: EKARI.hair }}
        >
          <div className="h-14 px-4 flex items-center justify-between">
            <div className="font-black text-[18px]" style={{ color: EKARI.text }}>
              Messages
            </div>
            <button
              onClick={() => router.push("/search")}
              className="p-2 rounded-full transition hover:bg-black/5 focus:outline-none focus:ring-2"
              aria-label="Search"
              style={ringStyle}
            >
              <IoSearchOutline size={20} style={{ color: EKARI.text }} />
            </button>
          </div>

          {/* Filters & Search */}
          <div className="px-4 pb-3 space-y-2">
            <div className="flex items-center gap-2">
              <button
                className={clsx(
                  "h-8 px-3 rounded-full text-xs font-extrabold transition"
                )}
                onClick={() => setTab("all")}
                style={{
                  backgroundColor: tab === "all" ? EKARI.forest : "#F3F4F6",
                  color: tab === "all" ? EKARI.sand : EKARI.text,
                }}
              >
                All
              </button>
              <button
                className={clsx(
                  "h-8 px-3 rounded-full text-xs font-extrabold transition"
                )}
                onClick={() => setTab("unread")}
                style={{
                  backgroundColor: tab === "unread" ? EKARI.forest : "#F3F4F6",
                  color: tab === "unread" ? EKARI.sand : EKARI.text,
                }}
              >
                Unread
              </button>

              <span className="ml-auto text-xs" style={{ color: EKARI.dim }}>
                {rows.length} thread{rows.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="relative">
              <input
                value={qStr}
                onChange={(e) => setQStr(e.target.value)}
                placeholder="Search by name, handle, or message…"
                className="w-full h-10 rounded-xl px-3 pr-9 text-sm outline-none border focus:ring-2"
                aria-label="Filter messages"
                style={{
                  borderColor: EKARI.hair,
                  // tailwind ring color via CSS var
                  ["--tw-ring-color" as any]: EKARI.forest,
                }}
              />
              {qStr ? (
                <button
                  onClick={() => setQStr("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs hover:opacity-80"
                  aria-label="Clear search"
                  style={{ color: EKARI.dim }}
                >
                  ✕
                </button>
              ) : (
                <IoSearchOutline
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "#94A3B8" }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-16 flex items-center justify-center" style={{ color: EKARI.dim }}>

            <span className="ml-2">
              <BouncingBallLoader />
            </span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div
              className="mx-auto mb-3 h-12 w-12 rounded-full grid place-items-center"
              style={{ backgroundColor: "#F3F4F6", color: EKARI.text }}
            >
              💬
            </div>
            <div className="font-extrabold" style={{ color: EKARI.text }}>
              No conversations found
            </div>
            <div className="text-sm mt-1" style={{ color: EKARI.dim }}>
              {qStr ? "Try clearing the search or filters." : "Start a chat from a profile to see it here."}
            </div>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: EKARI.hair }}>
            {filtered.map((item) => {
              const name = item.peer?.firstName || item.peer?.handle || "User";
              const last = previewOf(item.lastMessage) || "Say hi";
              const when = shortTime(item.lastMessage?.createdAt ?? item.updatedAt);
              const hasUnread = (item.unread ?? 0) > 0;

              return (
                <li key={item.threadId}>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    className="w-full px-4 py-3 flex items-center gap-3 transition text-left hover:bg-black/5 focus:bg-black/5 focus:outline-none focus:ring-2"
                    onClick={() => openThread(item)}
                    aria-label={`Open chat with ${name}`}
                    style={ringStyle}
                  >
                    {/* Avatar + unread dot */}
                    <div className="relative">
                      <SmartAvatar
                        src={item.peer?.photoURL}
                        alt={name}
                        size={46}
                        className={clsx(hasUnread && "ring-2")}

                      />
                      {hasUnread && (
                        <span
                          className="absolute -right-0.5 -bottom-0.5 w-[12px] h-[12px] rounded-full border-2"
                          title="Unread"
                          style={{ backgroundColor: EKARI.forest, borderColor: EKARI.sand }}
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div
                          className={clsx(
                            "truncate text-[15px]",
                            hasUnread ? "font-black" : "font-extrabold"
                          )}
                          style={{ color: EKARI.text }}
                        >
                          {name}
                        </div>
                        <div className="ml-auto text-[11px]" style={{ color: EKARI.dim }}>
                          {when}
                        </div>
                      </div>

                      <div className="mt-0.5 flex items-center gap-2 min-w-0">
                        <div
                          className={clsx("truncate text-[13px]", hasUnread ? "font-semibold" : "font-normal")}
                          style={{ color: hasUnread ? EKARI.text : EKARI.dim }}
                        >
                          {last}
                        </div>

                        {hasUnread && (
                          <span
                            className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold"
                            style={{ backgroundColor: EKARI.forest, color: EKARI.sand }}
                          >
                            {item.unread > 99 ? "99+" : item.unread}
                          </span>
                        )}
                      </div>
                    </div>

                    <IoChevronForward size={18} style={{ color: EKARI.sub }} className="hidden sm:block" />
                  </motion.button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Load more */}
        {filtered.length > 0 && (
          <div className="p-4 grid place-items-center">
            <button
              onClick={loadMore}
              disabled={paging || !cursor}
              className="h-10 rounded-lg px-4 border text-sm font-bold transition disabled:opacity-50"
              style={{ borderColor: EKARI.hair, color: EKARI.text, backgroundColor: EKARI.sand }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(35,63,57,0.05)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = EKARI.sand)}
            >
              {paging ? <BouncingBallLoader /> : cursor ? "Load more…" : "No more"}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
