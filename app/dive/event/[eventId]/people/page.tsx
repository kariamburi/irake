"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "@/lib/firebase";
import {
  IoArrowBack,
  IoDownloadOutline,
  IoPeopleOutline,
  IoSearch,
  IoCloseCircle,
  IoTrashOutline,
  IoChatbubbleOutline,
} from "react-icons/io5";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 32;
const EXPORT_PAGE_SIZE = 300;
const THREAD_ROUTE_FOR = (tid: string) => `/dive/thread/${tid}`;

type Row = { userId: string; name: string; handle?: string; photoURL?: string | null };

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  text: "#0F172A",
  dim: "#6B7280",
  hair: "#E5E7EB",
};

export default function PeopleGoingPage() {
  const router = useRouter();
  const params = useParams() as Record<string, string | string[]>;
  const eventId = Array.isArray(params?.eventId) ? params.eventId[0] : (params?.eventId as string | undefined);

  const auth = getAuth();
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  // event meta
  const [eventTitle, setEventTitle] = useState<string | null>(null);
  const [organizerId, setOrganizerId] = useState<string | null>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [totalCount, setTotalCount] = useState<number>(0);

  // list + paging
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<any | null>(null);

  // search
  const [qText, setQText] = useState("");

  // mount guard
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null));
    return unsub;
  }, [auth]);

  // fetch event meta, count, organizer check
  useEffect(() => {
    (async () => {
      if (!eventId) return;
      try {
        const ev = await getDoc(doc(db, "events", eventId));
        if (ev.exists()) {
          const d = ev.data() as any;
          const org = d?.organizerId || null;
          setEventTitle(d?.title ?? null);
          setOrganizerId(org);
          setIsOrganizer(!!uid && uid === org);
          const c = d?.counts || d?.stats || {};
          setTotalCount(Number(c?.rsvps ?? d?.rsvps ?? 0));
        } else {
          setOrganizerId(null);
          setIsOrganizer(false);
          setTotalCount(0);
        }
      } catch {
        setOrganizerId(null);
        setIsOrganizer(false);
        setTotalCount(0);
      }
    })();
  }, [eventId, uid]);

  // helpers
  const userToRow = (userId: string, u?: any): Row => {
    const data = u || {};
    const name = data.firstName
      ? `${data.firstName} ${data.surname || ""}`.trim()
      : data.name || data.handle || "Someone";
    return { userId, name, handle: data.handle || "", photoURL: data.photoURL || null };
  };

  const fetchPage = useCallback(
    async (first: boolean) => {
      if (!eventId) { setRows([]); setHasMore(false); setLoading(false); return; }
      if (paging) return;

      if (first) {
        cursorRef.current = null;
        setRows([]);
        setHasMore(true);
        setLoading(true);
      }

      setPaging(true);
      try {
        const base = collection(db, "events", eventId, "rsvps");
        const qRef = cursorRef.current
          ? query(base, orderBy("createdAt", "desc"), startAfter(cursorRef.current), limit(PAGE_SIZE))
          : query(base, orderBy("createdAt", "desc"), limit(PAGE_SIZE));
        const snap = await getDocs(qRef);

        if (!snap.empty) {
          cursorRef.current = snap.docs[snap.docs.length - 1];

          const docs = snap.docs;
          const chunk: Row[] = [];
          const MAX_CONCURRENCY = 10;
          let i = 0;
          await Promise.all(
            Array.from({ length: Math.min(MAX_CONCURRENCY, docs.length) }).map(async () => {
              while (i < docs.length) {
                const idx = i++;
                const d = docs[idx];
                try {
                  const us = await getDoc(doc(db, "users", d.id));
                  chunk.push(userToRow(d.id, us.data()));
                } catch {
                  chunk.push(userToRow(d.id));
                }
              }
            })
          );

          if (mountedRef.current) {
            setRows((prev) => (first ? chunk : [...prev, ...chunk]));
            setHasMore(snap.size === PAGE_SIZE);
          }
        } else {
          if (mountedRef.current) setHasMore(false);
        }
      } catch (e) {
        console.warn("fetchPage error:", e);
        if (mountedRef.current) setHasMore(false);
      } finally {
        if (mountedRef.current) {
          setPaging(false);
          setLoading(false);
        }
      }
    },
    [eventId, paging]
  );

  useEffect(() => { fetchPage(true); }, [eventId]);

  // search + sort (You first, then Organizer, then A→Z)
  const filteredSorted = useMemo(() => {
    const q = qText.trim().toLowerCase();
    const arr = (q
      ? rows.filter((r) =>
        r.name.toLowerCase().includes(q) || (r.handle || "").toLowerCase().includes(q)
      )
      : rows
    ).slice();

    const me = uid;
    const org = organizerId;

    arr.sort((a, b) => {
      const rank = (r: Row) =>
        r.userId === me ? 0 :
          r.userId === org ? 1 : 2;
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    return arr;
  }, [rows, qText, uid, organizerId]);

  // remove RSVP (organizer only; cannot remove organizer)
  const removeRsvp = useCallback(
    async (targetUserId: string) => {
      if (!isOrganizer || !eventId || targetUserId === organizerId) return;
      try {
        await deleteDoc(doc(db, "events", eventId, "rsvps", targetUserId));
        if (mountedRef.current) {
          setRows((prev) => prev.filter((r) => r.userId !== targetUserId));
          setTotalCount((n) => Math.max(0, n - 1));
        }
      } catch (e) {
        alert("Failed to remove attendee. Please try again.");
        console.warn("removeRsvp error:", e);
      }
    },
    [isOrganizer, eventId, organizerId]
  );

  // DM helpers
  const threadIdFor = (a: string, b: string) => [a, b].sort().join("_");
  const openDM = useCallback(
    async (peerId: string) => {
      if (!peerId || !uid) { router.push("/login"); return; }
      try {
        const tid = threadIdFor(uid, peerId);
        const tRef = doc(db, "threads", tid);
        const tSnap = await getDoc(tRef);
        if (!tSnap.exists()) {
          await setDoc(tRef, {
            participants: [uid, peerId],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            typing: {},
          });
        }
        router.push(THREAD_ROUTE_FOR(tid));
      } catch (e) {
        console.warn("openDM failed:", e);
        alert("Couldn't open chat. Please try again.");
      }
    },
    [db, router, uid]
  );

  // export CSV
  const exportCsv = useCallback(async () => {
    if (!eventId) return;
    try {
      const all: Row[] = [];
      let cursor: any | null = null;
      for (; ;) {
        const base = collection(db, "events", eventId, "rsvps");
        const qRef = cursor
          ? query(base, orderBy("createdAt", "desc"), startAfter(cursor), limit(EXPORT_PAGE_SIZE))
          : query(base, orderBy("createdAt", "desc"), limit(EXPORT_PAGE_SIZE));
        const s = await getDocs(qRef);
        if (s.empty) break;
        cursor = s.docs[s.docs.length - 1];

        const docs = s.docs;
        const pageChunk: Row[] = [];
        let i = 0;
        const MAX = 12;
        await Promise.all(
          Array.from({ length: Math.min(MAX, docs.length) }).map(async () => {
            while (i < docs.length) {
              const idx = i++;
              const d = docs[idx];
              try {
                const us = await getDoc(doc(db, "users", d.id));
                pageChunk.push(userToRow(d.id, us.data()));
              } catch {
                pageChunk.push(userToRow(d.id));
              }
            }
          })
        );
        all.push(...pageChunk);
        if (s.size < EXPORT_PAGE_SIZE) break;
      }

      const header = ["userId", "name", "handle", "photoURL"].join(",");
      const lines = all.map((r) =>
        [r.userId, (r.name || "").replace(/,/g, " "), r.handle || "", r.photoURL || ""].join(",")
      );
      const csv = [header, ...lines].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rsvps_${eventId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn("exportCsv failed:", e);
      alert("Export failed. Please try again.");
    }
  }, [eventId]);

  return (
    <AppShell>
      <div className="min-h-screen w-full bg-white">
        {/* Header */}
        <div className="h-12 border-b border-gray-200 px-3 flex items-center justify-between sticky top-0 bg-white z-10">
          <button
            onClick={() => router.back()}
            className="h-10 w-10 rounded-full flex items-center justify-center border border-gray-200"
            aria-label="Back"
            title="Back"
          >
            <IoArrowBack size={18} color={EKARI.text} />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="truncate text-[16px] sm:text-[18px] font-black" style={{ color: EKARI.text }}>
              People going{eventTitle ? ` • ${eventTitle}` : ""}
            </div>
            <span
              className="shrink-0 inline-flex items-center justify-center h-6 px-2 rounded-full text-xs font-bold"
              style={{ backgroundColor: "#F3F4F6", color: EKARI.text, border: `1px solid ${EKARI.hair}` }}
              title="Total RSVPs"
            >
              {totalCount}
            </span>
          </div>

          <button
            onClick={exportCsv}
            className="h-10 w-10 rounded-lg flex items-center justify-center border"
            style={{ borderColor: "#E5E7EB", backgroundColor: "#F8FAFC" }}
            title="Export CSV"
          >
            <IoDownloadOutline size={18} color={EKARI.text} />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pt-3">
          <div className="h-10 rounded-full border bg-gray-50 flex items-center gap-2 px-3" style={{ borderColor: "#E5E7EB" }}>
            <IoSearch size={16} color={EKARI.dim} />
            <input
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder="Search attendees…"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: EKARI.text }}
            />
            {!!qText && (
              <button onClick={() => setQText("")} className="p-1" title="Clear">
                <IoCloseCircle size={16} color="#9CA3AF" />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="pt-2">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <BouncingBallLoader />
            </div>
          ) : filteredSorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <IoPeopleOutline size={36} />
              <div className="mt-2">No RSVPs yet</div>
            </div>
          ) : (
            <>
              <ul className="divide-y" style={{ borderColor: EKARI.hair }}>
                {filteredSorted.map((item) => {
                  const isSelf = item.userId === uid;
                  const isOrg = item.userId === organizerId;

                  return (
                    <li key={item.userId} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-100">
                        <Image
                          src={item.photoURL || "/avatar-placeholder.png"}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-extrabold leading-5 truncate" style={{ color: EKARI.text }}>
                            {item.name}
                          </div>
                          {isSelf && (
                            <span className="text-[10px] font-bold px-2 py-[2px] rounded-full border"
                              style={{ borderColor: EKARI.hair, color: EKARI.text, background: "#F3F4F6" }}>
                              You
                            </span>
                          )}
                          {isOrg && (
                            <span className="text-[10px] font-bold px-2 py-[2px] rounded-full"
                              style={{ background: EKARI.forest, color: "#fff" }}>
                              Organizer
                            </span>
                          )}
                        </div>
                        {!!item.handle && (
                          <div className="text-xs font-semibold text-gray-500 truncate">@{item.handle.replace(/^@/, "")}</div>
                        )}
                      </div>

                      {/* Message attendee */}
                      {!isSelf && (
                        <button
                          onClick={() => openDM(item.userId)}
                          className="h-9 px-3 rounded-md border flex items-center gap-1.5 hover:bg-gray-50"
                          style={{ borderColor: EKARI.hair, color: EKARI.text }}
                          title="Message attendee"
                        >
                          <IoChatbubbleOutline size={16} />
                          <span className="text-xs font-bold">Message</span>
                        </button>
                      )}

                      {/* Remove (organizer only; cannot remove organizer or yourself) */}
                      {isOrganizer && !isSelf && !isOrg && (
                        <button
                          onClick={() => { if (confirm(`Remove ${item.name} from RSVPs?`)) removeRsvp(item.userId); }}
                          className="h-9 w-9 rounded-md border flex items-center justify-center hover:bg-gray-50"
                          style={{ borderColor: EKARI.hair }}
                          title="Remove from RSVPs"
                        >
                          <IoTrashOutline size={16} color={EKARI.dim} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>

              {/* Paging */}
              <div className="px-3 py-4">
                {hasMore ? (
                  <button
                    onClick={() => fetchPage(false)}
                    className="w-full h-10 rounded-lg border text-sm font-bold"
                    style={{ borderColor: EKARI.hair, color: EKARI.text, backgroundColor: "#F8FAFC", opacity: paging ? 0.7 : 1 }}
                    disabled={paging}
                  >
                    {paging ? "Loading…" : "Load more"}
                  </button>
                ) : (
                  <div className="text-center text-xs text-gray-400">No more attendees</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
