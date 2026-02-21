"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDoc,
  doc,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "@/lib/firebase";
import AppShell from "@/app/components/AppShell";
import clsx from "clsx";
import { ArrowLeft } from "lucide-react";
import {
  IoBookmarkOutline,
  IoSearch,
  IoCloseCircle,
  IoCalendarOutline,
  IoLocationOutline,
} from "react-icons/io5";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";

export const dynamic = "force-dynamic";

type EventDoc = {
  id: string;
  title?: string;
  dateISO?: string;
  location?: string;
  coverUrl?: string;
  organizerId?: string;
  category?: string;
  tags?: string[];
  visibility?: string;
  counts?: { likes?: number; saves?: number; rsvps?: number; shares?: number };
  stats?: { likes?: number; saves?: number; rsvps?: number; shares?: number };
};

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  text: "#0F172A",
  dim: "#6B7280",
  hair: "#E5E7EB",
  page: "#F3F4F6",
};

function formatDateLabel(dateISO?: string) {
  if (!dateISO) return "";
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return dateISO;
  return d.toLocaleString();
}

function useMediaQuery(queryStr: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(queryStr);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [queryStr]);
  return matches;
}
const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");

export default function SavedEventsPage() {
  const router = useRouter();
  const isDesktop = useIsDesktop();

  const auth = getAuth();
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  const [events, setEvents] = useState<EventDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [qText, setQText] = useState("");

  const mountedRef = useRef(true);
  const seqRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return unsub;
  }, [auth]);

  const attach = useCallback(() => {
    if (!uid) {
      setEvents([]);
      setLoading(false);
      return () => { };
    }

    setLoading(true);
    const localSeq = ++seqRef.current;

    // user saved bookmarks
    const qRef = query(collection(db, "eventBookmarks"), where("userId", "==", uid));

    const unsub = onSnapshot(
      qRef,
      async (snap) => {
        if (!mountedRef.current || localSeq !== seqRef.current) return;

        const eventIds = snap.docs
          .map((d) => String((d.data() as any)?.eventId || ""))
          .filter(Boolean);

        if (eventIds.length === 0) {
          if (!mountedRef.current || localSeq !== seqRef.current) return;
          setEvents([]);
          setLoading(false);
          return;
        }

        try {
          // fan-out fetch events
          const evSnaps = await Promise.all(
            eventIds.map((id) => getDoc(doc(db, "events", id)))
          );

          if (!mountedRef.current || localSeq !== seqRef.current) return;

          const seen = new Set<string>();
          const list: EventDoc[] = [];

          for (const s of evSnaps) {
            if (s.exists() && !seen.has(s.id)) {
              seen.add(s.id);
              list.push({ id: s.id, ...(s.data() as any) });
            }
          }

          // sort: dateISO desc, fallback to id (stable)
          list.sort((a, b) =>
            String(b.dateISO || "").localeCompare(String(a.dateISO || ""))
          );

          setEvents(list);
          setLoading(false);
        } catch (e) {
          console.warn("SavedEvents fanout failed:", e);
          if (mountedRef.current && localSeq === seqRef.current) {
            setEvents([]);
            setLoading(false);
          }
        }
      },
      (err) => {
        console.warn("SavedEvents listener error:", err);
        if (mountedRef.current && localSeq === seqRef.current) {
          setEvents([]);
          setLoading(false);
        }
      }
    );

    return () => {
      try {
        unsub();
      } catch { }
    };
  }, [uid]);

  useEffect(() => {
    const unsub = attach();
    return () => {
      try {
        unsub?.();
      } catch { }
    };
  }, [attach]);

  const filtered = useMemo(() => {
    const q = qText.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => {
      const t = (e.title || "").toLowerCase();
      const loc = (e.location || "").toLowerCase();
      const cat = ((e as any).category || "").toLowerCase();
      return t.includes(q) || loc.includes(q) || cat.includes(q);
    });
  }, [events, qText]);

  const Header = (
    <div
      className="sticky top-0 z-50 border-b backdrop-blur"
      style={{ backgroundColor: "rgba(255,255,255,0.92)", borderColor: EKARI.hair }}
    >
      <div className={clsx(isDesktop ? "h-14 px-4 max-w-[1180px] mx-auto" : "h-14 px-3")}>
        <div className="h-full flex items-center justify-between gap-2">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl border transition hover:bg-black/5 focus:outline-none focus:ring-2"
            style={{ borderColor: EKARI.hair, ["--tw-ring-color" as any]: EKARI.forest }}
            aria-label="Go back"
          >
            <ArrowLeft size={18} style={{ color: EKARI.text }} />
          </button>

          <div className="flex-1 min-w-0">
            <div className="font-black text-[18px] leading-none truncate" style={{ color: EKARI.text }}>
              Saved events
            </div>
            <div className="text-[11px] mt-0.5 truncate" style={{ color: EKARI.dim }}>
              Events you bookmarked
            </div>
          </div>

          <span
            className="shrink-0 inline-flex items-center justify-center h-10 px-3 rounded-xl text-sm font-extrabold border"
            style={{ backgroundColor: "#F8FAFC", color: EKARI.text, borderColor: EKARI.hair }}
            title="Total saved"
          >
            {events.length}
          </span>
        </div>
      </div>

      <div className={clsx(isDesktop ? "px-4 pb-3 max-w-[1180px] mx-auto" : "px-3 pb-3")}>
        <div className="flex items-center gap-2">
          <div
            className="flex-1 h-10 rounded-xl border bg-white flex items-center gap-2 px-3 focus-within:ring-2"
            style={{ borderColor: EKARI.hair, ["--tw-ring-color" as any]: EKARI.forest }}
          >
            <IoSearch size={16} color={EKARI.dim} />
            <input
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder="Search saved events…"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: EKARI.text }}
              aria-label="Search saved events"
            />
            {!!qText && (
              <button onClick={() => setQText("")} className="p-1" title="Clear">
                <IoCloseCircle size={16} color="#9CA3AF" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const Content = (
    <div className={clsx(isDesktop ? "max-w-[1180px] mx-auto px-4" : "px-3")}>
      <div style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
        {!uid ? (
          <div className="flex items-center justify-center py-24">
            <BouncingBallLoader />
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-24">
            <BouncingBallLoader />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20" style={{ color: EKARI.dim }}>
            <IoBookmarkOutline size={38} />
            <div className="mt-2 font-semibold">No saved events yet</div>
            <div className="mt-1 text-xs">Bookmark events to see them here.</div>
          </div>
        ) : (
          <div className={clsx("grid gap-3", isDesktop ? "grid-cols-2" : "grid-cols-1")}>
            {filtered.map((ev) => (
              <button
                key={ev.id}
                onClick={() => router.push(`/nexus/event/${ev.id}`)}
                className="text-left rounded-2xl border bg-white overflow-hidden hover:bg-black/[0.02] transition"
                style={{ borderColor: EKARI.hair }}
              >
                <div className="relative w-full h-[170px] bg-gray-100">
                  <Image
                    src={ev.coverUrl || "/placeholder.png"}
                    alt={ev.title || "Event"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 560px"
                    priority={false}
                  />
                  <div className="absolute left-3 bottom-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/45 text-white text-xs font-extrabold">
                    <IoCalendarOutline />
                    <span className="truncate max-w-[260px]">{formatDateLabel(ev.dateISO)}</span>
                  </div>
                </div>

                <div className="p-4">
                  <div className="font-black text-[16px] leading-snug line-clamp-2" style={{ color: EKARI.text }}>
                    {ev.title || "Untitled event"}
                  </div>

                  {!!ev.location && (
                    <div className="mt-2 flex items-center gap-2 text-sm" style={{ color: EKARI.dim }}>
                      <IoLocationOutline />
                      <span className="truncate">{ev.location}</span>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {!!(ev as any).category && (
                      <span
                        className="text-[11px] font-extrabold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: EKARI.forest, color: "#fff" }}
                      >
                        {(ev as any).category}
                      </span>
                    )}

                    {(ev.tags || []).slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-full border"
                        style={{ borderColor: EKARI.hair, backgroundColor: "#F8FAFC", color: EKARI.text }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <AppShell>
      <div className="min-h-screen w-full" style={{ backgroundColor: EKARI.page }}>
        {Header}
        {Content}
      </div>
    </AppShell>
  );
}