"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  startAfter,
  getDocs,
  where,
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from "next/image";
import Link from "next/link";
import {
  IoAdd,
  IoChatbubblesOutline,
  IoChatbubbleEllipsesOutline,
  IoCalendarOutline,
  IoLocationOutline,
  IoSearch,
  IoCloseCircle,
  IoCompassOutline,
  IoTimeOutline,
  IoReload,
} from "react-icons/io5";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import AppShell from "@/app/components/AppShell";

/* ---------- Theme ---------- */
const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  text: "#0F172A",
  dim: "#6B7280",
  hair: "#E5E7EB",
};

/* ---------- Types ---------- */
type DiveTab = "events" | "discussions";
type EventCategory = "Workshop" | "Fair" | "Training" | "Meetup" | "Other";
type DiscCategory = "General" | "Seeds" | "Soil" | "Equipment" | "Market" | "Regulations" | "Other";

type EventItem = {
  id: string;
  title: string;
  dateISO?: string;
  location?: string;
  coverUrl?: string;
  createdAt?: any;
  price?: number | null;
  registrationUrl?: string | null;
  category?: EventCategory;
  tags?: string[];
  description?: string | null;
};

type DiscussionItem = {
  id: string;
  title: string;
  body?: string;
  authorId?: string;
  createdAt?: any;
  repliesCount?: number;
  category?: DiscCategory;
  tags?: string[];
  published?: boolean;
};

/* ---------- Filters ---------- */
const EVENT_FILTERS: Array<EventCategory | "All"> = ["All", "Workshop", "Training", "Fair", "Meetup", "Other"];
const DISC_FILTERS: Array<DiscCategory | "All"> = [
  "All",
  "General",
  "Seeds",
  "Soil",
  "Equipment",
  "Market",
  "Regulations",
  "Other",
];

export default function DivePage() {
  const [active, setActive] = useState<DiveTab>("events");
  const [queryInput, setQueryInput] = useState("");
  const [q, setQ] = useState("");
  const [eventFilter, setEventFilter] = useState<EventCategory | "All">("All");
  const [discFilter, setDiscFilter] = useState<DiscCategory | "All">("All");

  /* Search debounce */
  useEffect(() => {
    const t = setTimeout(() => setQ(queryInput.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [queryInput]);

  /* Firestore state */
  const [events, setEvents] = useState<EventItem[]>([]);
  const [discs, setDiscs] = useState<DiscussionItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingDiscs, setLoadingDiscs] = useState(true);
  const [pagingEvents, setPagingEvents] = useState(false);
  const [pagingDiscs, setPagingDiscs] = useState(false);

  const eventsAfter = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const discsAfter = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  /* Loaders */
  const loadEvents = useCallback(() => {
    const qRef = query(collection(db, "events"), orderBy("createdAt", "desc"), limit(20));
    const unsub = onSnapshot(qRef, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as EventItem[];
      setEvents(rows);
      eventsAfter.current = snap.docs[snap.docs.length - 1] || null;
      setLoadingEvents(false);
    });
    return unsub;
  }, []);

  const loadDiscs = useCallback(() => {
    const qRef = query(
      collection(db, "discussions"),
      where("published", "==", true),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(qRef, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as DiscussionItem[];
      setDiscs(rows);
      discsAfter.current = snap.docs[snap.docs.length - 1] || null;
      setLoadingDiscs(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const u1 = loadEvents();
    const u2 = loadDiscs();
    return () => {
      u1?.();
      u2?.();
    };
  }, [loadEvents, loadDiscs]);

  /* Pagination */
  const loadMoreEvents = async () => {
    if (pagingEvents || !eventsAfter.current) return;
    setPagingEvents(true);
    const qRef = query(
      collection(db, "events"),
      orderBy("createdAt", "desc"),
      startAfter(eventsAfter.current),
      limit(20)
    );
    const snap = await getDocs(qRef);
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as EventItem[];
    setEvents((prev) => [...prev, ...rows]);
    eventsAfter.current = snap.docs[snap.docs.length - 1] || null;
    setPagingEvents(false);
  };

  const loadMoreDiscs = async () => {
    if (pagingDiscs || !discsAfter.current) return;
    setPagingDiscs(true);
    const qRef = query(
      collection(db, "discussions"),
      where("published", "==", true),
      orderBy("createdAt", "desc"),
      startAfter(discsAfter.current),
      limit(20)
    );
    const snap = await getDocs(qRef);
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as DiscussionItem[];
    setDiscs((prev) => [...prev, ...rows]);
    discsAfter.current = snap.docs[snap.docs.length - 1] || null;
    setPagingDiscs(false);
  };

  /* Filtered lists */
  const filteredEvents = useMemo(() => {
    const list = eventFilter === "All" ? events : events.filter((e) => e.category === eventFilter);
    if (!q) return list;
    return list.filter((e) => {
      const t = `${e.title || ""} ${e.location || ""} ${e.description || ""}`.toLowerCase();
      const tags = (e.tags || []).join(" ").toLowerCase();
      return t.includes(q) || tags.includes(q);
    });
  }, [events, eventFilter, q]);

  const filteredDiscs = useMemo(() => {
    const list = discFilter === "All" ? discs : discs.filter((d) => d.category === discFilter);
    if (!q) return list;
    return list.filter((d) => {
      const t = `${d.title || ""} ${d.body || ""}`.toLowerCase();
      const tags = (d.tags || []).join(" ").toLowerCase();
      return t.includes(q) || tags.includes(q);
    });
  }, [discs, discFilter, q]);

  /* UI */
  return (
    <AppShell>
      <div className="w-full mx-auto px-2 py-2">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <IoCompassOutline size={22} color={EKARI.forest} />
            <h1 className="text-lg font-extrabold" style={{ color: EKARI.forest }}>
              Dive
            </h1>
          </div>
          <button onClick={() => (active === "events" ? loadEvents() : loadDiscs())}>
            <IoReload size={20} style={{ color: EKARI.dim }} className="hover:opacity-70" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setActive("events")}
            className={`flex-1 py-2 rounded-full font-bold border transition ${active === "events" ? "text-white" : "text-gray-800 hover:bg-gray-50"
              }`}
            style={{
              backgroundColor: active === "events" ? EKARI.forest : "transparent",
              borderColor: active === "events" ? EKARI.forest : EKARI.hair,
            }}
          >
            Events
          </button>
          <button
            onClick={() => setActive("discussions")}
            className={`flex-1 py-2 rounded-full font-bold border transition ${active === "discussions" ? "text-white" : "text-gray-800 hover:bg-gray-50"
              }`}
            style={{
              backgroundColor: active === "discussions" ? EKARI.forest : "transparent",
              borderColor: active === "discussions" ? EKARI.forest : EKARI.hair,
            }}
          >
            Discussions
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white mb-4">
          <IoSearch className="text-gray-500" />
          <input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder={active === "events" ? "Search events..." : "Search discussions..."}
            className="flex-1 outline-none text-sm text-gray-800"
          />
          {queryInput.length > 0 && (
            <button onClick={() => setQueryInput("")}>
              <IoCloseCircle className="text-gray-400 hover:text-gray-500" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex overflow-x-auto gap-2 pb-2 mb-4">
          {(active === "events" ? EVENT_FILTERS : DISC_FILTERS).map((c) => {
            const isActive = active === "events" ? eventFilter === c : discFilter === c;
            return (
              <button
                key={c}
                onClick={() =>
                  active === "events"
                    ? setEventFilter(c as EventCategory | "All")
                    : setDiscFilter(c as DiscCategory | "All")
                }
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-bold border transition ${isActive ? "text-white" : "text-gray-800 hover:bg-gray-50"
                  }`}
                style={{
                  backgroundColor: isActive ? EKARI.forest : "transparent",
                  borderColor: isActive ? EKARI.forest : EKARI.hair,
                }}
              >
                {c}
              </button>
            );
          })}
        </div>

        {/* Feed */}
        {active === "events" ? (
          loadingEvents ? (
            <div className="py-12 flex justify-center">
              <BouncingBallLoader />
            </div>
          ) : filteredEvents.length > 0 ? (
            <>
              {/* >>> Responsive GRID with contain-fitted images <<< */}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredEvents.map((e) => (
                  <Link
                    href={`/dive/event/${e.id}`}
                    key={e.id}
                    className="block border border-gray-200 rounded-xl overflow-hidden bg-white hover:shadow-md transition"
                  >
                    {/* Image wrapper: fixed 16:9 frame, image object-contain */}
                    <div className="relative w-full aspect-[16/9] bg-black">
                      {e.coverUrl ? (
                        <Image
                          src={e.coverUrl}
                          alt={e.title}
                          fill
                          className="object-contain p-2"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1440px) 33vw, 25vw"
                          priority={false}
                        />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center text-xs text-gray-400">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="p-3">
                      {e.id}
                      <h3 className="font-extrabold text-gray-900 line-clamp-2">{e.title}</h3>
                      {e.location && (
                        <p className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                          <IoLocationOutline size={14} /> {e.location}
                        </p>
                      )}
                      {e.dateISO && (
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <IoCalendarOutline size={12} />
                          {new Date(e.dateISO).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>

              {eventsAfter.current && (
                <div className="text-center mt-6">
                  <button
                    onClick={loadMoreEvents}
                    disabled={pagingEvents}
                    className="px-4 py-2 rounded-lg font-bold text-white hover:opacity-90 disabled:opacity-60"
                    style={{ backgroundColor: EKARI.gold }}
                  >
                    {pagingEvents ? <BouncingBallLoader /> : "Load More"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-gray-500 py-12">
              No events {q ? "matching your search." : "yet."}
            </div>
          )
        ) : loadingDiscs ? (
          <div className="py-12 flex justify-center">
            <BouncingBallLoader />
          </div>
        ) : filteredDiscs.length > 0 ? (
          <>
            <div className="grid gap-3">
              {filteredDiscs.map((d) => (
                <Link
                  href={`/dive/discussion/${d.id}`}
                  key={d.id}
                  className="block border border-gray-200 rounded-xl bg-white p-3 hover:shadow-md transition"
                >
                  <div className="flex items-start gap-2">
                    <IoChatbubblesOutline style={{ color: EKARI.forest }} className="mt-1" size={16} />
                    <div>
                      <h3 className="font-extrabold text-gray-900 line-clamp-2">{d.title}</h3>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                        <IoTimeOutline size={12} />
                        {d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString() : ""}
                        <IoChatbubbleEllipsesOutline size={12} />
                        {(d.repliesCount ?? 0).toString()} Answers
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {discsAfter.current && (
              <div className="text-center mt-6">
                <button
                  onClick={loadMoreDiscs}
                  disabled={pagingDiscs}
                  className="px-4 py-2 rounded-lg font-bold text-white hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: EKARI.gold }}
                >
                  {pagingDiscs ? <BouncingBallLoader /> : "Load More"}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-gray-500 py-12">
            No discussions {q ? "matching your search." : "yet."}
          </div>
        )}

        {/* Floating Create Button */}
        <div className="fixed right-5 bottom-20 md:bottom-8">
          <Link
            href={active === "events" ? "/create-event" : "/create-discussion"}
            className="flex items-center gap-2 px-4 py-3 rounded-full text-white font-bold shadow-lg hover:opacity-90"
            style={{ backgroundColor: EKARI.forest }}
          >
            <IoAdd size={18} /> {active === "events" ? "Create Event" : "Start Discussion"}
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
