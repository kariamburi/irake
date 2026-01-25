"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  PropsWithChildren,
  ReactNode,
} from "react";
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
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  getFirestore,
} from "firebase/firestore";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
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
  IoClose,
  IoImageOutline,
  IoPricetagsOutline,
  IoCashOutline,
  IoHomeOutline,
  IoCartOutline,
  IoChevronForward,
  IoInformationCircleOutline,
  IoPersonCircleOutline,
  IoNotificationsOutline,
  IoMenu,
  IoSparklesOutline,
} from "react-icons/io5";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import AppShell from "@/app/components/AppShell";
import { createPortal } from "react-dom";
import { useAuth } from "@/app/hooks/useAuth";

import { useInitEkariTags } from "@/app/hooks/useInitEkariTags";
import { usePathname } from "next/navigation";
import { useInboxTotalsWeb } from "@/hooks/useInboxTotalsWeb";
import { cacheEvent } from "@/lib/eventCache";
import { cacheDiscussion } from "@/lib/discussionCache";
import { DiscussionForm } from "@/app/components/DiscussionForm";
import { EventForm } from "@/app/components/EventForm";
import { EkariSideMenuSheet } from "@/app/components/EkariSideMenuSheet";

/* ---------- Theme ---------- */
const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  text: "#0F172A",
  dim: "#6B7280",
  hair: "#E5E7EB",
};

/* ---------- Responsive helpers ---------- */
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
function useIsDesktop() {
  return useMediaQuery("(min-width: 1024px)");
}
function useIsMobile() {
  return useMediaQuery("(max-width: 1023px)");
}
function cn(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

/* ---------- Types ---------- */
type DiveTab = "events" | "discussions";
type EventCategory = "Workshop" | "Fair" | "Training" | "Meetup" | "Other";
type DiscCategory =
  | "General"
  | "Seeds"
  | "Soil"
  | "Equipment"
  | "Market"
  | "Regulations"
  | "Other";

type CurrencyCode = "KES" | "USD";

type EventItem = {
  id: string;
  title: string;
  dateISO?: string;
  location?: string;
  coverUrl?: string;
  author?: any;
  authorBadge?: any;
  createdAt?: any;
  price?: number | null;
  currency?: CurrencyCode;
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
  author?: any;
  authorBadge?: any;
  createdAt?: any;
  repliesCount?: number;
  category?: DiscCategory;
  tags?: string[];
  published?: boolean;
};

/* ---------- Filters ---------- */
const EVENT_FILTERS: Array<EventCategory | "All"> = [
  "All",
  "Workshop",
  "Training",
  "Fair",
  "Meetup",
  "Other",
];
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




/* ============================== */
/* Centered Modal Primitive       */
/* ============================== */
function BottomSheet({
  open,
  onClose,
  children,
  title,
  footer,
}: PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title?: string;
  footer?: ReactNode;
}>) {
  const [mounted, setMounted] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (open) setSheetVisible(true);
    else setSheetVisible(false);
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={[
          "relative w-full max-w-2xl rounded-3xl border bg-white shadow-xl",
          "flex flex-col max-h-[90vh] px-4 pt-3 pb-4",
          "transition-all duration-200 transform",
          sheetVisible
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-3 scale-95",
        ].join(" ")}
        style={{ borderColor: EKARI.hair }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {title && (
              <h3 className="text-base font-black" style={{ color: EKARI.text }}>
                {title}
              </h3>
            )}
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full border bg-white hover:bg-gray-50"
            style={{ borderColor: EKARI.hair }}
          >
            <IoClose />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 mt-1 space-y-3">
          {children}
        </div>

        {footer && (
          <div className="mt-3 border-t pt-3" style={{ borderColor: EKARI.hair }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}


/* ============================== */
/* Money helper                   */
/* ============================== */
const formatMoney = (n?: number, currency?: CurrencyCode) => {
  if (typeof n !== "number") return "";
  const cur: CurrencyCode = currency === "USD" || currency === "KES" ? currency : "KES";

  if (cur === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(n);
  }

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(n);
};


/* ============================== */
/* Mobile bottom tabs (LIGHT)     */
/* ============================== */
function MobileBottomTabs({ onCreate }: { onCreate: () => void }) {
  const TabBtn = ({
    label,
    icon,
    href,
    active,
  }: {
    label: string;
    icon: React.ReactNode;
    href: string;
    active?: boolean;
  }) => (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition",
        active ? "bg-black/[0.04]" : "hover:bg-black/[0.03]"
      )}
      aria-current={active ? "page" : undefined}
    >
      <div style={{ color: active ? EKARI.forest : EKARI.text }}>{icon}</div>
      <span
        className="text-[11px] font-semibold"
        style={{ color: active ? EKARI.forest : EKARI.text }}
      >
        {label}
      </span>
    </Link>
  );

  const isNexusActive = true; // because this file is /nexus/page.tsx

  return (
    <div
      className="fixed left-0 right-0 z-[60]"
      style={{ bottom: 0, paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className="mx-auto w-full max-w-[520px] h-[64px] px-4 flex items-center justify-between"
        style={{
          backgroundColor: "#FFFFFF",
          borderTop: `1px solid ${EKARI.hair}`,
        }}
      >
        <TabBtn label="Deeds" icon={<IoHomeOutline size={20} />} href="/" />
        <TabBtn label="ekariMarket" icon={<IoCartOutline size={20} />} href="/market" />

        <button
          onClick={onCreate}
          className="h-12 w-16 rounded-2xl grid place-items-center shadow-lg"
          style={{ backgroundColor: EKARI.gold }}
          aria-label="Create"
        >
          <IoAdd size={26} color="#111827" />
        </button>

        <TabBtn
          label="Nexus"
          icon={<IoCompassOutline size={20} />}
          href="/nexus"
          active={isNexusActive}
        />
        <TabBtn label="Bonga" icon={<IoChatbubblesOutline size={20} />} href="/bonga" />
      </div>
    </div>
  );
}

/* ---------- Profiles ---------- */
function useUserProfile(uid?: string) {
  const [profile, setProfile] = useState<{
    handle?: string;
    photoURL?: string;
    dataSaverVideos?: boolean;
    uid?: string;
  } | null>(null);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      return;
    }
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() as any | undefined;
      if (!data) {
        setProfile(null);
        return;
      }
      setProfile({
        uid,
        handle: data?.handle,
        photoURL: data?.photoURL,
        dataSaverVideos: !!data?.dataSaverVideos,
      });
    });
    return () => unsub();
  }, [uid]);

  return profile;
}
/* ============================== */
/* Main Page                      */
/* ============================== */
export default function DivePage() {
  useInitEkariTags();

  const isMobile = useIsMobile();

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
  const { user } = useAuth();
  const uid = user?.uid;

  const [menuOpen, setMenuOpen] = useState(false);
  const profile = useUserProfile(uid);
  const { unreadDM, notifTotal } = useInboxTotalsWeb(!!uid, uid);

  const handle = (profile as any)?.handle ?? null; // if you store handle elsewhere, use that instead
  const profileHref = handle && String(handle).trim().length > 0 ? `/${handle}` : "/getstarted";


  const loadEvents = useCallback(() => {
    setLoadingEvents(true);
    const qRef = query(collection(db, "events"), orderBy("createdAt", "desc"), limit(20));
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as EventItem[];
        setEvents(rows);
        eventsAfter.current = snap.docs[snap.docs.length - 1] || null;
        setLoadingEvents(false);
      },
      () => {
        setEvents([]);
        eventsAfter.current = null;
        setLoadingEvents(false);
      }
    );
    return unsub;
  }, []);

  const loadDiscs = useCallback(() => {
    setLoadingDiscs(true);
    const qRef = query(
      collection(db, "discussions"),
      where("published", "==", true),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as DiscussionItem[];
        setDiscs(rows);
        discsAfter.current = snap.docs[snap.docs.length - 1] || null;
        setLoadingDiscs(false);
      },
      () => {
        setDiscs([]);
        discsAfter.current = null;
        setLoadingDiscs(false);
      }
    );
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

  const loadMoreEvents = useCallback(async () => {
    if (pagingEvents || !eventsAfter.current) return;
    setPagingEvents(true);
    try {
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
    } finally {
      setPagingEvents(false);
    }
  }, [pagingEvents]);

  const loadMoreDiscs = useCallback(async () => {
    if (pagingDiscs || !discsAfter.current) return;
    setPagingDiscs(true);
    try {
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
    } finally {
      setPagingDiscs(false);
    }
  }, [pagingDiscs]);

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

  /* ---------- BottomSheet state ---------- */
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetFooter, setSheetFooter] = useState<ReactNode>(null);
  const provideFooter = useCallback((node: ReactNode) => setSheetFooter(node), []);
  const { signOutUser } = useAuth();
  const ringStyle = { ["--tw-ring-color" as any]: EKARI.forest } as React.CSSProperties;


  /* ============================== */
  /* Premium Controls               */
  /* ============================== */
  const Controls = (
    <div className="w-full">
      <div className="px-3 pt-3">
        <div
          className={cn(
            "rounded-[22px] border bg-white/80 backdrop-blur",
            "shadow-[0_10px_30px_rgba(2,6,23,0.06)]"
          )}
          style={{ borderColor: EKARI.hair }}
        >
          <div className="p-3 flex items-center gap-2">
            <div
              className="flex-1 h-11 rounded-full bg-white px-4 flex items-center gap-2 focus-within:ring-2"
              style={{ border: `1px solid ${EKARI.hair}`, ...ringStyle }}
            >
              <IoSearch size={18} style={{ color: EKARI.dim }} />
              <input
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder={active === "events" ? "Search events…" : "Search discussions…"}
                className="flex-1 outline-none bg-transparent text-[14px]"
                style={{ color: EKARI.text }}
              />
              {!!queryInput && (
                <button onClick={() => setQueryInput("")} aria-label="Clear search">
                  <IoCloseCircle size={18} style={{ color: EKARI.dim }} />
                </button>
              )}
            </div>

            <button
              onClick={() => (active === "events" ? loadEvents() : loadDiscs())}
              className="h-11 w-11 grid place-items-center rounded-full hover:bg-black/[0.03] focus:ring-2"
              style={{ border: `1px solid ${EKARI.hair}`, ...ringStyle }}
              aria-label="Refresh"
              title="Refresh"
            >
              <IoReload size={18} style={{ color: EKARI.text }} />
            </button>
          </div>

          <div className="px-3 pb-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setActive("events")}
                className={cn("h-10 rounded-full font-black border transition")}
                style={{
                  background:
                    active === "events"
                      ? "linear-gradient(135deg, rgba(35,63,57,1), rgba(35,63,57,0.9))"
                      : "transparent",
                  borderColor: active === "events" ? "rgba(35,63,57,0.5)" : EKARI.hair,
                  color: active === "events" ? "#fff" : EKARI.text,
                }}
              >
                Events
              </button>
              <button
                onClick={() => setActive("discussions")}
                className={cn("h-10 rounded-full font-black border transition")}
                style={{
                  background:
                    active === "discussions"
                      ? "linear-gradient(135deg, rgba(35,63,57,1), rgba(35,63,57,0.9))"
                      : "transparent",
                  borderColor: active === "discussions" ? "rgba(35,63,57,0.5)" : EKARI.hair,
                  color: active === "discussions" ? "#fff" : EKARI.text,
                }}
              >
                Discussions
              </button>
            </div>
          </div>

          <div className="px-3 pb-3 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2">
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
                    className="whitespace-nowrap px-3 py-2 rounded-full text-[12px] font-black border transition"
                    style={{
                      background: isActive
                        ? "linear-gradient(135deg, rgba(199,146,87,1), rgba(199,146,87,0.86))"
                        : "rgba(2,6,23,0.03)",
                      borderColor: isActive ? "rgba(199,146,87,0.55)" : EKARI.hair,
                      color: isActive ? "#111827" : EKARI.text,
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  /* ============================== */
  /* Premium Cards                  */
  /* ============================== */
  const TagPills = ({ tags }: { tags?: string[] }) => {
    const list = (tags || []).slice(0, 3);
    if (!list.length) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {list.map((t) => (
          <span
            key={t}
            className="px-2 py-1 rounded-full text-[11px] font-bold border"
            style={{
              borderColor: "rgba(35,63,57,0.18)",
              background: "rgba(35,63,57,0.06)",
              color: EKARI.forest,
            }}
          >
            #{t}
          </span>
        ))}
      </div>
    );
  };

  const PricePill = ({ price, currency }: { price?: number | null; currency?: CurrencyCode }) => {
    if (!price) return null;
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black border"
        style={{
          borderColor: "rgba(199,146,87,0.35)",
          background: "rgba(199,146,87,0.14)",
          color: "#111827",
        }}
      >
        <IoCashOutline size={14} style={{ color: EKARI.dim }} />
        {formatMoney(price, currency)}
      </span>
    );
  };
  const EventsGrid = (
    <>
      {loadingEvents ? (
        <div className="py-14 flex justify-center">
          <BouncingBallLoader />
        </div>
      ) : filteredEvents.length > 0 ? (
        <>
          <div
            className={cn(
              "grid gap-4",
              isMobile
                ? "grid-cols-2 px-3"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            )}
          >
            {filteredEvents.map((e) => (
              <Link
                href={`/nexus/event/${e.id}`}
                onClick={() => cacheEvent(e)}
                key={e.id}
                className={cn(
                  "group block rounded-[22px] overflow-hidden border bg-white",
                  "shadow-[0_10px_30px_rgba(2,6,23,0.06)]",
                  "hover:shadow-[0_18px_55px_rgba(2,6,23,0.12)] transition"
                )}
                style={{ borderColor: EKARI.hair }}
              >
                <div className="relative w-full aspect-[16/9] bg-black">
                  {e.coverUrl ? (
                    <>
                      <Image
                        src={e.coverUrl}
                        alt={e.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1440px) 33vw, 25vw"
                        priority={false}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    </>
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-xs text-white/70">
                      No image
                    </div>
                  )}

                  <div className="absolute top-2 left-2 flex items-center gap-2">
                    <span
                      className="px-2.5 py-1 rounded-full text-[11px] font-black"
                      style={{
                        background: "rgba(255,255,255,0.86)",
                        border: `1px solid ${EKARI.hair}`,
                      }}
                    >
                      {e.category || "Event"}
                    </span>
                  </div>

                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-white/90 text-[11px] font-bold">
                      {e.dateISO ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-1 backdrop-blur">
                          <IoCalendarOutline size={12} />
                          {new Date(e.dateISO).toLocaleDateString()}
                        </span>
                      ) : null}
                      {e.location ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-1 backdrop-blur line-clamp-1">
                          <IoLocationOutline size={12} />
                          <span className="truncate max-w-[180px]">{e.location}</span>
                        </span>
                      ) : null}
                    </div>

                    <div className="hidden sm:block">
                      <PricePill price={e.price} currency={e.currency} />
                    </div>
                  </div>
                </div>

                <div className="p-3">
                  <h3
                    className="font-black leading-snug line-clamp-2"
                    style={{ color: EKARI.text }}
                  >
                    {e.title}
                  </h3>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[11px]" style={{ color: EKARI.dim }}>
                      {e.price ? <span className="sm:hidden"><PricePill price={e.price} currency={e.currency} /></span> : null}
                      {!e.price ? (
                        <span className="inline-flex items-center gap-1">
                          <IoTimeOutline size={12} />
                          {e.createdAt?.toDate ? e.createdAt.toDate().toLocaleDateString() : "Recently"}
                        </span>
                      ) : null}
                    </div>
                    <span
                      className="text-[11px] font-black opacity-0 group-hover:opacity-100 transition"
                      style={{ color: EKARI.forest }}
                    >
                      View →
                    </span>
                  </div>

                  <TagPills tags={e.tags} />
                </div>
              </Link>
            ))}
          </div>

          {eventsAfter.current && (
            <div className="text-center mt-8">
              <button
                onClick={loadMoreEvents}
                disabled={pagingEvents}
                className="px-5 h-11 rounded-2xl text-white font-black hover:opacity-95 disabled:opacity-60 focus:ring-2 shadow-sm"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(35,63,57,1), rgba(35,63,57,0.86))",
                  ...ringStyle,
                }}
              >
                {pagingEvents ? <BouncingBallLoader /> : "Load more"}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-14 px-4">
          <div
            className="mx-auto h-12 w-12 rounded-2xl grid place-items-center border"
            style={{
              borderColor: EKARI.hair,
              background:
                "linear-gradient(135deg, rgba(35,63,57,0.10), rgba(199,146,87,0.12))",
            }}
          >
            <IoCalendarOutline style={{ color: EKARI.forest }} />
          </div>
          <div className="mt-3 font-black" style={{ color: EKARI.text }}>
            No events found
          </div>
          <div className="mt-1 text-sm" style={{ color: EKARI.dim }}>
            {q ? "Try a different keyword or tag." : "Be the first to create one."}
          </div>
          <div className="mt-4">
            <button
              onClick={() => setSheetOpen(true)}
              className="h-11 px-5 rounded-2xl font-black text-white shadow-sm hover:opacity-95"
              style={{
                background:
                  "linear-gradient(135deg, rgba(199,146,87,1), rgba(199,146,87,0.88))",
              }}
            >
              Create Event
            </button>
          </div>
        </div>
      )}
    </>
  );

  const DiscussionsList = (
    <>
      {loadingDiscs ? (
        <div className="py-14 flex justify-center">
          <BouncingBallLoader />
        </div>
      ) : filteredDiscs.length > 0 ? (
        <>
          <div className={cn("grid gap-3", isMobile ? "px-3" : "")}>
            {filteredDiscs.map((d) => (
              <Link
                href={`/nexus/discussion/${d.id}`}
                onClick={() => cacheDiscussion(d)}
                key={d.id}
                className={cn(
                  "block rounded-[22px] border bg-white p-4 transition",
                  "shadow-[0_10px_30px_rgba(2,6,23,0.06)]",
                  "hover:shadow-[0_18px_55px_rgba(2,6,23,0.10)]"
                )}
                style={{ borderColor: EKARI.hair }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="h-10 w-10 rounded-2xl grid place-items-center border"
                    style={{
                      borderColor: "rgba(35,63,57,0.18)",
                      background: "rgba(35,63,57,0.06)",
                      color: EKARI.forest,
                    }}
                  >
                    <IoChatbubblesOutline size={18} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-black leading-snug line-clamp-2" style={{ color: EKARI.text }}>
                        {d.title}
                      </h3>
                      <span
                        className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-black border"
                        style={{
                          borderColor: "rgba(199,146,87,0.40)",
                          background: "rgba(199,146,87,0.12)",
                          color: "#111827",
                        }}
                      >
                        {d.category || "General"}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: EKARI.dim }}>
                      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1"
                        style={{ borderColor: EKARI.hair, background: "rgba(2,6,23,0.02)" }}>
                        <IoTimeOutline size={12} />
                        {d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString() : ""}
                      </span>

                      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1"
                        style={{ borderColor: EKARI.hair, background: "rgba(2,6,23,0.02)" }}>
                        <IoChatbubbleEllipsesOutline size={12} />
                        {(d.repliesCount ?? 0).toString()} Answers
                      </span>

                      {(d.tags || []).slice(0, 2).map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-bold border"
                          style={{
                            borderColor: "rgba(35,63,57,0.18)",
                            background: "rgba(35,63,57,0.06)",
                            color: EKARI.forest,
                          }}
                        >
                          #{t}
                        </span>
                      ))}
                    </div>

                    {d.body ? (
                      <div className="mt-2 text-sm line-clamp-2" style={{ color: EKARI.dim }}>
                        {d.body}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {discsAfter.current && (
            <div className="text-center mt-8">
              <button
                onClick={loadMoreDiscs}
                disabled={pagingDiscs}
                className="px-5 h-11 rounded-2xl text-white font-black hover:opacity-95 disabled:opacity-60 focus:ring-2 shadow-sm"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(35,63,57,1), rgba(35,63,57,0.86))",
                  ...ringStyle,
                }}
              >
                {pagingDiscs ? <BouncingBallLoader /> : "Load more"}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-14 px-4">
          <div
            className="mx-auto h-12 w-12 rounded-2xl grid place-items-center border"
            style={{
              borderColor: EKARI.hair,
              background:
                "linear-gradient(135deg, rgba(35,63,57,0.10), rgba(199,146,87,0.12))",
            }}
          >
            <IoChatbubblesOutline style={{ color: EKARI.forest }} />
          </div>
          <div className="mt-3 font-black" style={{ color: EKARI.text }}>
            No discussions found
          </div>
          <div className="mt-1 text-sm" style={{ color: EKARI.dim }}>
            {q ? "Try a different keyword or tag." : "Start one and invite people to answer."}
          </div>
          <div className="mt-4">
            <button
              onClick={() => setSheetOpen(true)}
              className="h-11 px-5 rounded-2xl font-black text-white shadow-sm hover:opacity-95"
              style={{
                background:
                  "linear-gradient(135deg, rgba(199,146,87,1), rgba(199,146,87,0.88))",
              }}
            >
              Start Discussion
            </button>
          </div>
        </div>
      )}
    </>
  );

  /* ---------------- mobile shell (like MarketPage) ---------------- */
  if (isMobile) {
    return (
      <>
        <div className="fixed inset-0 bg-white">
          <div
            className="sticky top-0 z-50 border-b"
            style={{
              backgroundColor: "rgba(255,255,255,0.95)",
              borderColor: EKARI.hair,
            }}
          >
            <div className="h-[56px] w-full px-3 flex items-center justify-between">
              <button
                onClick={() => setMenuOpen(true)}
                className="h-9 w-9 rounded-full bg-black/[0.04] grid place-items-center backdrop-blur-md border"
                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                aria-label="Open menu"
              >
                <IoMenu size={20} />
              </button>
              <div className="flex items-center gap-2">
                <IoCompassOutline size={20} style={{ color: EKARI.text }} />
                <div className="font-black text-base" style={{ color: EKARI.text }}>
                  Nexus
                </div>
              </div>

              <button
                onClick={() => setSheetOpen(true)}
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black focus:ring-2"
                style={{
                  background: "white",
                  border: `1px solid ${EKARI.gold}`,
                  color: EKARI.gold,
                  ...ringStyle,
                }}
              >
                <IoAdd size={16} />
                {active === "events" ? "Create" : "Start"}
              </button>
            </div>

            {Controls}
          </div>

          <div style={{ paddingBottom: "calc(84px + env(safe-area-inset-bottom))" }}>
            {active === "events" ? EventsGrid : DiscussionsList}
          </div>

          <MobileBottomTabs onCreate={() => setSheetOpen(true)} />

          <EkariSideMenuSheet
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            uid={uid}
            handle={(profile as any)?.handle ?? null}
            photoURL={(profile as any)?.photoURL ?? null}
            profileHref={profileHref}
            unreadDM={uid ? unreadDM ?? 0 : 0}
            notifTotal={uid ? notifTotal ?? 0 : 0}
            onLogout={signOutUser}
          />

        </div>

        <BottomSheet
          open={sheetOpen}
          onClose={() => {
            setSheetOpen(false);
            setSheetFooter(null);
          }}
          title={active === "events" ? "Create Event" : "Start Discussion"}
          footer={sheetFooter}
        >
          {active === "events" ? (
            <EventForm
              onDone={() => {
                setSheetOpen(false);
                setSheetFooter(null);
              }}
              provideFooter={provideFooter}
            />
          ) : (
            <DiscussionForm
              onDone={() => {
                setSheetOpen(false);
                setSheetFooter(null);
              }}
              provideFooter={provideFooter}
            />
          )}
        </BottomSheet>
      </>
    );
  }

  /* ---------------- desktop shell ---------------- */
  return (
    <AppShell>
      <div className="min-h-screen w-full">
        <div
          className="sticky top-0 z-10 backdrop-blur border-b"
          style={{
            backgroundColor: "rgba(255,255,255,0.92)",
            borderColor: EKARI.hair,
          }}
        >
          <div className="h-14 px-4 max-w-[1180px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IoCompassOutline size={22} style={{ color: EKARI.text }} />
              <div className="font-black text-lg" style={{ color: EKARI.text }}>
                Nexus
              </div>
            </div>

            <button
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition focus:ring-2"
              style={{
                border: `1px solid ${EKARI.gold}`,
                color: EKARI.gold,
                ...ringStyle,
              }}
            >
              <IoAdd size={18} />
              <span>{active === "events" ? "Create Event" : "Start Discussion"}</span>
            </button>
          </div>

          <div className="max-w-[1180px] mx-auto">{Controls}</div>
        </div>

        <div className="max-w-[1180px] mx-auto px-4 pt-3 pb-24">
          {active === "events" ? EventsGrid : DiscussionsList}
        </div>

        <BottomSheet
          open={sheetOpen}
          onClose={() => {
            setSheetOpen(false);
            setSheetFooter(null);
          }}
          title={active === "events" ? "Create Event" : "Start Discussion"}
          footer={sheetFooter}
        >
          {active === "events" ? (
            <EventForm
              onDone={() => {
                setSheetOpen(false);
                setSheetFooter(null);
              }}
              provideFooter={provideFooter}
            />
          ) : (
            <DiscussionForm
              onDone={() => {
                setSheetOpen(false);
                setSheetFooter(null);
              }}
              provideFooter={provideFooter}
            />
          )}
        </BottomSheet>
      </div>
    </AppShell>
  );
}
