// app/nexus/page.tsx
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
import { motion } from "framer-motion";
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
} from "firebase/firestore";
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
  IoCashOutline,
  IoHomeOutline,
  IoCartOutline,
  IoNotificationsOutline,
  IoMenu,
  IoSparklesOutline,
  IoChevronForward,
} from "react-icons/io5";

import { db } from "@/lib/firebase";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import AppShell from "@/app/components/AppShell";
import { createPortal } from "react-dom";
import { useAuth } from "@/app/hooks/useAuth";
import { useInitEkariTags } from "@/app/hooks/useInitEkariTags";
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
  sub: "#5C6B66",
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

function hexToRgba(hex: string, alpha: number) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/* ---------- Premium UI primitives ---------- */
function PremiumSurface({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border bg-white/80 backdrop-blur-xl",
        "shadow-[0_18px_60px_rgba(15,23,42,0.10)]",
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}

function PremiumIconTile({
  icon,
  variant,
}: {
  icon: React.ReactNode;
  variant: "forest" | "gold";
}) {
  const bg =
    variant === "forest"
      ? "linear-gradient(135deg, rgba(35,63,57,1), rgba(199,146,87,0.40))"
      : "linear-gradient(135deg, rgba(199,146,87,1), rgba(35,63,57,0.55))";

  return (
    <span
      className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm"
      style={{ background: bg }}
    >
      {icon}
    </span>
  );
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full bg-red-600 text-white text-[11px] font-extrabold px-1 shadow-sm">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SoftDivider() {
  return (
    <div className="mt-4 h-px" style={{ backgroundColor: "rgba(199,146,87,0.16)" }} />
  );
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-3">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative w-full max-w-2xl rounded-[28px] border",
          "bg-white/90 backdrop-blur-xl",
          "shadow-[0_28px_90px_rgba(15,23,42,0.22)]",
          "flex flex-col max-h-[90vh] px-4 pt-3 pb-4",
          "transition-all duration-200 transform",
          sheetVisible
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-3 scale-[0.985]"
        )}
        style={{
          borderColor: "rgba(199,146,87,0.22)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.84))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="h-9 w-9 rounded-2xl grid place-items-center border"
              style={{
                borderColor: "rgba(199,146,87,0.18)",
                background:
                  "linear-gradient(135deg, rgba(199,146,87,0.16), rgba(35,63,57,0.06))",
              }}
            >
              <IoSparklesOutline size={16} style={{ color: EKARI.forest }} />
            </span>
            {title && (
              <h3 className="text-[15px] font-black truncate" style={{ color: EKARI.text }}>
                {title}
              </h3>
            )}
          </div>

          <button
            aria-label="Close"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl border bg-white/80 hover:bg-white focus:outline-none focus:ring-2 active:scale-[0.98]"
            style={{
              borderColor: "rgba(199,146,87,0.22)",
              ["--tw-ring-color" as any]: EKARI.forest,
            }}
          >
            <IoClose />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 mt-1 space-y-3">
          {children}
        </div>

        {footer && (
          <div className="mt-3 border-t pt-3" style={{ borderColor: "rgba(199,146,87,0.16)" }}>
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

  const isNexusActive = true;

  return (
    <div
      className="fixed left-0 right-0 z-[60]"
      style={{ bottom: 0, paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto w-full max-w-[520px] px-3 pb-3">
        <PremiumSurface
          className="h-[68px] px-3 flex items-center justify-between"
          style={{
            borderColor: "rgba(199,146,87,0.20)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.84))",
          }}
        >
          <TabBtn label="Deeds" icon={<IoHomeOutline size={20} />} href="/" />
          <TabBtn label="Market" icon={<IoCartOutline size={20} />} href="/market" />

          <button
            onClick={onCreate}
            className="h-12 w-16 rounded-2xl grid place-items-center shadow-lg focus:outline-none focus:ring-2 active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, rgba(199,146,87,1), rgba(35,63,57,0.65))",
              ["--tw-ring-color" as any]: EKARI.forest,
            }}
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
        </PremiumSurface>
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
export default function NexusPage() {
  useInitEkariTags();

  const isDesktop = useIsDesktop();
  const isMobile = useIsMobile();

  const premiumBg = useMemo<React.CSSProperties>(
    () => ({
      background:
        "radial-gradient(900px circle at 10% 0%, rgba(199,146,87,0.22), rgba(255,255,255,0) 55%), radial-gradient(900px circle at 90% 20%, rgba(35,63,57,0.16), rgba(255,255,255,0) 60%), linear-gradient(180deg, rgba(255,255,255,1), rgba(255,255,255,1))",
    }),
    []
  );

  const ringStyle = useMemo<React.CSSProperties>(
    () => ({ ["--tw-ring-color" as any]: EKARI.forest }),
    []
  );

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

  const { user, signOutUser } = useAuth();
  const uid = user?.uid;

  const [menuOpen, setMenuOpen] = useState(false);
  const profile = useUserProfile(uid);
  const { unreadDM, notifTotal } = useInboxTotalsWeb(!!uid, uid);

  const handle = (profile as any)?.handle ?? null;
  const profileHref =
    handle && String(handle).trim().length > 0 ? `/${handle}` : "/getstarted";

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

  /* ---------- Controls (premium) ---------- */
  const Controls = (
    <div className="w-full">
      <div className={cn(isDesktop ? "px-4" : "px-3")}>
        <PremiumSurface
          className={cn("p-3", isDesktop ? "mt-4" : "mt-3")}
          style={{
            borderColor: "rgba(199,146,87,0.22)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.86), rgba(255,255,255,0.72))",
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex-1 h-11 rounded-full px-3 flex items-center gap-2 focus-within:ring-2"
              style={{
                border: "1px solid rgba(199,146,87,0.18)",
                background:
                  "linear-gradient(135deg, rgba(199,146,87,0.10), rgba(35,63,57,0.05))",
                ...ringStyle,
              }}
            >
              <IoSearch size={18} style={{ color: EKARI.dim }} />
              <input
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder={active === "events" ? "Search events…" : "Search discussions…"}
                className="flex-1 outline-none bg-transparent text-[14px] font-semibold"
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
              className="h-11 w-11 grid place-items-center rounded-2xl border bg-white/80 backdrop-blur-xl shadow-sm hover:bg-white focus:outline-none focus:ring-2 active:scale-[0.98]"
              style={{ borderColor: "rgba(199,146,87,0.22)", ...ringStyle }}
              aria-label="Refresh"
            >
              <IoReload size={18} style={{ color: EKARI.text }} />
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setActive("events")}
              className={cn(
                "flex-1 py-2.5 rounded-full font-black border transition focus:outline-none focus:ring-2",
                active === "events" ? "text-white" : "text-gray-800 hover:bg-white"
              )}
              style={{
                background:
                  active === "events"
                    ? "linear-gradient(135deg, rgba(35,63,57,1), rgba(199,146,87,0.55))"
                    : "rgba(255,255,255,0.65)",
                borderColor: active === "events" ? "rgba(35,63,57,0.35)" : "rgba(199,146,87,0.18)",
                ...ringStyle,
              }}
            >
              Events
            </button>
            <button
              onClick={() => setActive("discussions")}
              className={cn(
                "flex-1 py-2.5 rounded-full font-black border transition focus:outline-none focus:ring-2",
                active === "discussions" ? "text-white" : "text-gray-800 hover:bg-white"
              )}
              style={{
                background:
                  active === "discussions"
                    ? "linear-gradient(135deg, rgba(35,63,57,1), rgba(199,146,87,0.55))"
                    : "rgba(255,255,255,0.65)",
                borderColor:
                  active === "discussions" ? "rgba(35,63,57,0.35)" : "rgba(199,146,87,0.18)",
                ...ringStyle,
              }}
            >
              Discussions
            </button>
          </div>

          <div className="mt-3 overflow-x-auto no-scrollbar">
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
                    className={cn(
                      "whitespace-nowrap px-3 py-2 rounded-full text-[12px] font-extrabold border transition",
                      isActive ? "text-white" : "text-gray-800 hover:bg-white"
                    )}
                    style={{
                      background: isActive
                        ? "linear-gradient(135deg, rgba(35,63,57,1), rgba(199,146,87,0.45))"
                        : "rgba(255,255,255,0.60)",
                      borderColor: isActive ? "rgba(35,63,57,0.35)" : "rgba(199,146,87,0.18)",
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        </PremiumSurface>
      </div>
    </div>
  );

  /* ---------- Top summary cards (borrowed feel from notifications) ---------- */
  const summaryEvents = filteredEvents.length;
  const summaryDiscs = filteredDiscs.length;

  const TopCards = (
    <div className={cn(isDesktop ? "px-4 pt-4 max-w-[1180px] mx-auto" : "px-3 pt-3")}>
      <div className={cn(isDesktop ? "grid grid-cols-2 gap-4" : "space-y-3")}>
        <motion.button
          whileTap={{ scale: 0.985 }}
          className="w-full text-left"
          onClick={() => setActive("events")}
        >
          <PremiumSurface
            className="px-4 py-4 transition hover:shadow-[0_22px_70px_rgba(15,23,42,0.12)]"
            style={{
              borderColor: "rgba(199,146,87,0.22)",
              background:
                active === "events"
                  ? "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.78))"
                  : "linear-gradient(180deg, rgba(255,255,255,0.86), rgba(255,255,255,0.72))",
            }}
          >
            <div className="flex items-center gap-3">
              <PremiumIconTile icon={<IoCalendarOutline size={18} />} variant="forest" />
              <div className="flex-1 min-w-0">
                <div className="font-black text-[15px]" style={{ color: EKARI.text }}>
                  Events
                </div>
                <div className="text-[13px] truncate font-semibold" style={{ color: EKARI.sub }}>
                  {q
                    ? `${summaryEvents} match your search`
                    : loadingEvents
                      ? "Loading events…"
                      : `${events.length} available`}
                </div>
              </div>
              <CountBadge count={summaryEvents} />
              <span
                className="h-10 w-10 rounded-2xl grid place-items-center border bg-white/70"
                style={{ borderColor: "rgba(199,146,87,0.18)" }}
              >
                <IoChevronForward style={{ color: EKARI.dim }} />
              </span>
            </div>
          </PremiumSurface>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.985 }}
          className="w-full text-left"
          onClick={() => setActive("discussions")}
        >
          <PremiumSurface
            className="px-4 py-4 transition hover:shadow-[0_22px_70px_rgba(15,23,42,0.12)]"
            style={{
              borderColor: "rgba(199,146,87,0.22)",
              background:
                active === "discussions"
                  ? "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.78))"
                  : "linear-gradient(180deg, rgba(255,255,255,0.86), rgba(255,255,255,0.72))",
            }}
          >
            <div className="flex items-center gap-3">
              <PremiumIconTile icon={<IoChatbubblesOutline size={18} />} variant="gold" />
              <div className="flex-1 min-w-0">
                <div className="font-black text-[15px]" style={{ color: EKARI.text }}>
                  Discussions
                </div>
                <div className="text-[13px] truncate font-semibold" style={{ color: EKARI.sub }}>
                  {q
                    ? `${summaryDiscs} match your search`
                    : loadingDiscs
                      ? "Loading discussions…"
                      : `${discs.length} published`}
                </div>
              </div>
              <CountBadge count={summaryDiscs} />
              <span
                className="h-10 w-10 rounded-2xl grid place-items-center border bg-white/70"
                style={{ borderColor: "rgba(199,146,87,0.18)" }}
              >
                <IoChevronForward style={{ color: EKARI.dim }} />
              </span>
            </div>
          </PremiumSurface>
        </motion.button>
      </div>

      <SoftDivider />
    </div>
  );

  /* ---------- Premium Cards ---------- */
  const EventCard = ({ e }: { e: EventItem }) => {
    const when =
      e.dateISO && !Number.isNaN(new Date(e.dateISO).getTime())
        ? new Date(e.dateISO).toLocaleDateString()
        : "";

    return (
      <Link
        href={`/nexus/event/${e.id}`}
        onClick={() => cacheEvent(e)}
        className={cn(
          "group block overflow-hidden rounded-3xl border",
          "bg-white/80 backdrop-blur-xl",
          "shadow-[0_18px_60px_rgba(15,23,42,0.10)]",
          "transition hover:shadow-[0_26px_85px_rgba(15,23,42,0.16)]",
          "active:scale-[0.995]"
        )}
        style={{ borderColor: "rgba(199,146,87,0.20)" }}
      >
        <div className="relative w-full aspect-[16/9] bg-black/95">
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
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.55))",
                }}
              />
            </>
          ) : (
            <div className="absolute inset-0 grid place-items-center text-xs text-gray-300">
              No image
            </div>
          )}

          <div className="absolute left-3 right-3 bottom-3 flex items-center justify-between gap-2">
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border bg-white/90"
              style={{
                borderColor: "rgba(199,146,87,0.18)",
                color: EKARI.text,
              }}
            >
              <IoSparklesOutline size={14} style={{ color: EKARI.forest }} />
              {e.category || "Event"}
            </span>

            {e.price ? (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] border bg-white/90"
                style={{
                  borderColor: "rgba(199,146,87,0.18)",
                  color: EKARI.text,
                }}
              >
                <IoCashOutline size={14} style={{ color: EKARI.dim }} />
                {formatMoney(e.price, e.currency)}
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] border bg-white/90"
                style={{
                  borderColor: "rgba(199,146,87,0.18)",
                  color: EKARI.sub,
                }}
              >
                <IoCashOutline size={12} style={{ color: EKARI.dim }} />
                Free / Not set
              </span>
            )}
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-black text-[15px] leading-snug line-clamp-2" style={{ color: EKARI.text }}>
              {e.title}
            </h3>
            <span
              className="h-10 w-10 rounded-2xl grid place-items-center border bg-white/70 shrink-0 opacity-0 group-hover:opacity-100 transition"
              style={{ borderColor: "rgba(199,146,87,0.18)" }}
            >
              <IoChevronForward style={{ color: EKARI.dim }} />
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] font-semibold">
            {e.location ? (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-white/70"
                style={{ borderColor: "rgba(199,146,87,0.16)", color: EKARI.sub }}
              >
                <IoLocationOutline size={14} style={{ color: EKARI.forest }} />
                <span className="line-clamp-1">{e.location}</span>
              </span>
            ) : null}

            {when ? (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-white/70"
                style={{ borderColor: "rgba(199,146,87,0.16)", color: EKARI.sub }}
              >
                <IoCalendarOutline size={14} style={{ color: EKARI.forest }} />
                {when}
              </span>
            ) : null}
          </div>

          {e.tags?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {e.tags.slice(0, 4).map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-1 rounded-full text-[11px] font-extrabold border"
                  style={{
                    borderColor: "rgba(199,146,87,0.16)",
                    color: EKARI.dim,
                    background: "rgba(255,255,255,0.65)",
                  }}
                >
                  #{t}
                </span>
              ))}
              {e.tags.length > 4 ? (
                <span
                  className="px-2.5 py-1 rounded-full text-[11px] font-extrabold border"
                  style={{
                    borderColor: "rgba(199,146,87,0.16)",
                    color: EKARI.dim,
                    background: "rgba(255,255,255,0.65)",
                  }}
                >
                  +{e.tags.length - 4}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </Link>
    );
  };

  const DiscussionRow = ({ d }: { d: DiscussionItem }) => {
    const when = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString() : "";

    return (
      <Link
        href={`/nexus/discussion/${d.id}`}
        onClick={() => cacheDiscussion(d)}
        className={cn(
          "group block rounded-3xl border p-4",
          "bg-white/80 backdrop-blur-xl",
          "shadow-[0_18px_60px_rgba(15,23,42,0.10)]",
          "transition hover:shadow-[0_26px_85px_rgba(15,23,42,0.16)]",
          "active:scale-[0.995]"
        )}
        style={{ borderColor: "rgba(199,146,87,0.20)" }}
      >
        <div className="flex items-start gap-3">
          <span
            className="h-11 w-11 rounded-2xl grid place-items-center border shrink-0"
            style={{
              borderColor: "rgba(199,146,87,0.18)",
              background:
                "linear-gradient(135deg, rgba(199,146,87,0.14), rgba(35,63,57,0.06))",
            }}
          >
            <IoChatbubblesOutline size={18} style={{ color: EKARI.forest }} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-black text-[15px] leading-snug line-clamp-2" style={{ color: EKARI.text }}>
                {d.title}
              </h3>
              <span
                className="h-10 w-10 rounded-2xl grid place-items-center border bg-white/70 shrink-0 opacity-0 group-hover:opacity-100 transition"
                style={{ borderColor: "rgba(199,146,87,0.18)" }}
              >
                <IoChevronForward style={{ color: EKARI.dim }} />
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] font-semibold">
              {d.category ? (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-white/70"
                  style={{ borderColor: "rgba(199,146,87,0.16)", color: EKARI.sub }}
                >
                  <IoSparklesOutline size={14} style={{ color: EKARI.forest }} />
                  {d.category}
                </span>
              ) : null}

              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-white/70"
                style={{ borderColor: "rgba(199,146,87,0.16)", color: EKARI.sub }}
              >
                <IoTimeOutline size={14} style={{ color: EKARI.forest }} />
                {when || "—"}
              </span>

              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-white/70"
                style={{ borderColor: "rgba(199,146,87,0.16)", color: EKARI.sub }}
              >
                <IoChatbubbleEllipsesOutline size={14} style={{ color: EKARI.forest }} />
                {(d.repliesCount ?? 0).toString()} Answers
              </span>
            </div>

            {d.tags?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {d.tags.slice(0, 5).map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-1 rounded-full text-[11px] font-extrabold border"
                    style={{
                      borderColor: "rgba(199,146,87,0.16)",
                      color: EKARI.dim,
                      background: "rgba(255,255,255,0.65)",
                    }}
                  >
                    #{t}
                  </span>
                ))}
                {d.tags.length > 5 ? (
                  <span
                    className="px-2.5 py-1 rounded-full text-[11px] font-extrabold border"
                    style={{
                      borderColor: "rgba(199,146,87,0.16)",
                      color: EKARI.dim,
                      background: "rgba(255,255,255,0.65)",
                    }}
                  >
                    +{d.tags.length - 5}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </Link>
    );
  };

  /* ---------- Sections ---------- */
  const EventsGrid = (
    <>
      {loadingEvents ? (
        <div className="py-12 flex justify-center" style={{ color: EKARI.dim }}>
          <BouncingBallLoader />
        </div>
      ) : filteredEvents.length > 0 ? (
        <>
          <div
            className={cn(
              "grid gap-3",
              isMobile ? "grid-cols-1 px-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            )}
          >
            {filteredEvents.map((e) => (
              <EventCard key={e.id} e={e} />
            ))}
          </div>

          {eventsAfter.current && (
            <div className="text-center mt-6">
              <button
                onClick={loadMoreEvents}
                disabled={pagingEvents}
                className="px-4 py-2.5 rounded-full text-white font-black hover:opacity-90 disabled:opacity-60 focus:outline-none focus:ring-2 active:scale-[0.98]"
                style={{
                  borderColor: "rgba(229,231,235,0.9)",
                  color: EKARI.text,
                  background: `linear-gradient(135deg, ${hexToRgba(EKARI.gold, 0.18)}, rgba(255,255,255,1))`,
                }}
              >
                {pagingEvents ? <BouncingBallLoader /> : "Load more"}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={cn(isDesktop ? "px-4 py-16" : "px-6 py-14", "text-center")}>
          <PremiumSurface
            className="mx-auto max-w-[560px] px-6 py-8"
            style={{
              borderColor: "rgba(199,146,87,0.22)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.86), rgba(255,255,255,0.72))",
            }}
          >
            <div
              className="mx-auto h-14 w-14 rounded-3xl grid place-items-center mb-3 border"
              style={{
                borderColor: "rgba(199,146,87,0.20)",
                background: "linear-gradient(135deg, rgba(199,146,87,0.16), rgba(35,63,57,0.06))",
              }}
            >
              <IoCalendarOutline size={24} style={{ color: EKARI.forest }} />
            </div>
            <div className="text-[16px] font-black" style={{ color: EKARI.text }}>
              No events {q ? "match your search" : "yet"}
            </div>
            <div className="mt-1 text-sm font-semibold" style={{ color: EKARI.dim }}>
              {q ? "Try a different keyword or clear filters." : "Be the first to create one."}
            </div>

            <div className="mt-5 flex items-center justify-center gap-2 text-[12px] font-semibold" style={{ color: EKARI.sub }}>
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: hexToRgba(EKARI.gold, 0.8) }}
              />
              Real-time updates enabled
            </div>
          </PremiumSurface>
        </div>
      )}
    </>
  );

  const DiscussionsList = (
    <>
      {loadingDiscs ? (
        <div className="py-12 flex justify-center" style={{ color: EKARI.dim }}>
          <BouncingBallLoader />
        </div>
      ) : filteredDiscs.length > 0 ? (
        <>
          <div className={cn("grid gap-3", isMobile ? "px-3" : "")}>
            {filteredDiscs.map((d) => (
              <DiscussionRow key={d.id} d={d} />
            ))}
          </div>

          {discsAfter.current && (
            <div className="text-center mt-6">
              <button
                onClick={loadMoreDiscs}
                disabled={pagingDiscs}
                className="px-4 py-2.5 rounded-full text-white font-black hover:opacity-90 disabled:opacity-60 focus:outline-none focus:ring-2 active:scale-[0.98]"
                style={{
                  borderColor: "rgba(229,231,235,0.9)",
                  color: EKARI.text,
                  background: `linear-gradient(135deg, ${hexToRgba(EKARI.gold, 0.18)}, rgba(255,255,255,1))`,
                }}
              >
                {pagingDiscs ? <BouncingBallLoader /> : "Load more"}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={cn(isDesktop ? "px-4 py-16" : "px-6 py-14", "text-center")}>
          <PremiumSurface
            className="mx-auto max-w-[560px] px-6 py-8"
            style={{
              borderColor: "rgba(199,146,87,0.22)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.86), rgba(255,255,255,0.72))",
            }}
          >
            <div
              className="mx-auto h-14 w-14 rounded-3xl grid place-items-center mb-3 border"
              style={{
                borderColor: "rgba(199,146,87,0.20)",
                background: "linear-gradient(135deg, rgba(199,146,87,0.16), rgba(35,63,57,0.06))",
              }}
            >
              <IoChatbubblesOutline size={24} style={{ color: EKARI.forest }} />
            </div>
            <div className="text-[16px] font-black" style={{ color: EKARI.text }}>
              No discussions {q ? "match your search" : "yet"}
            </div>
            <div className="mt-1 text-sm font-semibold" style={{ color: EKARI.dim }}>
              {q ? "Try a different keyword or clear filters." : "Start a discussion and help the community."}
            </div>

            <div className="mt-5 flex items-center justify-center gap-2 text-[12px] font-semibold" style={{ color: EKARI.sub }}>
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: hexToRgba(EKARI.gold, 0.8) }}
              />
              Published threads appear instantly
            </div>
          </PremiumSurface>
        </div>
      )}
    </>
  );

  /* ---------- Header (borrow style from notifications) ---------- */
  const Header = (
    <div
      className="sticky top-0 z-50"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.82))",
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(199,146,87,0.18)",
      }}
    >
      <div className={cn(isDesktop ? "px-4 max-w-[1180px] mx-auto" : "px-3")}>
        <div className="h-[72px] flex items-center justify-between gap-3">
          {isMobile ? (
            <button
              onClick={() => setMenuOpen(true)}
              className="h-11 w-11 rounded-2xl border bg-white/80 backdrop-blur-xl shadow-sm grid place-items-center transition hover:bg-white focus:outline-none focus:ring-2 active:scale-[0.98]"
              style={{ borderColor: "rgba(199,146,87,0.22)", ...ringStyle }}
              aria-label="Open menu"
            >
              <IoMenu size={18} style={{ color: EKARI.text }} />
            </button>
          ) : (
            <div
              className="h-11 w-11 rounded-2xl border bg-white/80 backdrop-blur-xl shadow-sm grid place-items-center"
              style={{ borderColor: "rgba(199,146,87,0.22)" }}
              aria-hidden
            >
              <IoCompassOutline size={18} style={{ color: EKARI.text }} />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div
              className="font-black text-[18px] leading-none truncate"
              style={{ color: EKARI.text }}
            >
              Nexus
            </div>
            <div className="text-[12px] mt-1 font-semibold" style={{ color: EKARI.dim }}>
              {active === "events"
                ? `${summaryEvents} showing`
                : `${summaryDiscs} showing`}{" "}
              • Explore • Connect • Learn
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="h-11 px-4 rounded-full border bg-white/80 backdrop-blur-xl shadow-sm flex items-center gap-2"
              style={{ borderColor: "rgba(199,146,87,0.22)" }}
              aria-label="Unread summary"
            >
              <span
                className="h-8 w-8 rounded-2xl grid place-items-center border"
                style={{
                  borderColor: "rgba(199,146,87,0.18)",
                  background:
                    "linear-gradient(135deg, rgba(199,146,87,0.14), rgba(35,63,57,0.06))",
                }}
              >
                <IoNotificationsOutline size={16} style={{ color: EKARI.forest }} />
              </span>
              <div className="text-[12px] font-extrabold" style={{ color: EKARI.text }}>
                {((uid ? (notifTotal ?? 0) : 0) + (uid ? (unreadDM ?? 0) : 0)) > 99
                  ? "99+"
                  : (uid ? (notifTotal ?? 0) : 0) + (uid ? (unreadDM ?? 0) : 0)}
              </div>
            </div>

            <button
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition focus:outline-none focus:ring-2 active:scale-[0.98]"
              style={{
                background:
                  "linear-gradient(135deg, rgba(199,146,87,1), rgba(35,63,57,0.65))",
                color: "#111827",
                ...ringStyle,
              }}
            >
              <IoAdd size={18} />
              <span className={cn(isMobile ? "hidden" : "inline")}>
                {active === "events" ? "Create Event" : "Start Discussion"}
              </span>
              <span className={cn(isMobile ? "inline" : "hidden")}>
                {active === "events" ? "Create" : "Start"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  /* ---------- Signed-out state (keep simple, premium) ---------- */
  if (!uid) {
    return isMobile ? (
      <div className="fixed inset-0 flex flex-col" style={premiumBg}>
        {Header}
        {Controls}
        <div className="flex-1 overflow-y-auto px-6 py-14 text-center">
          <PremiumSurface
            className="mx-auto max-w-[560px] px-6 py-8"
            style={{
              borderColor: "rgba(199,146,87,0.22)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.86), rgba(255,255,255,0.72))",
            }}
          >
            <div
              className="mx-auto h-14 w-14 rounded-3xl grid place-items-center mb-3 border"
              style={{
                borderColor: "rgba(199,146,87,0.20)",
                background:
                  "linear-gradient(135deg, rgba(199,146,87,0.16), rgba(35,63,57,0.06))",
              }}
            >
              <IoCompassOutline size={24} style={{ color: EKARI.forest }} />
            </div>
            <div className="text-[16px] font-black" style={{ color: EKARI.text }}>
              Sign in to create and join
            </div>
            <div className="mt-1 text-sm font-semibold" style={{ color: EKARI.dim }}>
              Browse is available, but creating events/discussions requires an account.
            </div>
            <div className="mt-5 text-[12px] font-semibold" style={{ color: EKARI.sub }}>
              Secure • Real-time • Community
            </div>
          </PremiumSurface>
        </div>
        <MobileBottomTabs onCreate={() => setSheetOpen(true)} />
      </div>
    ) : (
      <AppShell>
        <div className="min-h-screen w-full" style={premiumBg}>
          {Header}
          {TopCards}
          {Controls}
          <div className="px-4 py-14 max-w-[1180px] mx-auto text-center">
            <PremiumSurface
              className="mx-auto max-w-[560px] px-6 py-8"
              style={{
                borderColor: "rgba(199,146,87,0.22)",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.86), rgba(255,255,255,0.72))",
              }}
            >
              <div
                className="mx-auto h-14 w-14 rounded-3xl grid place-items-center mb-3 border"
                style={{
                  borderColor: "rgba(199,146,87,0.20)",
                  background:
                    "linear-gradient(135deg, rgba(199,146,87,0.16), rgba(35,63,57,0.06))",
                }}
              >
                <IoCompassOutline size={24} style={{ color: EKARI.forest }} />
              </div>
              <div className="text-[16px] font-black" style={{ color: EKARI.text }}>
                Sign in to create and join
              </div>
              <div className="mt-1 text-sm font-semibold" style={{ color: EKARI.dim }}>
                Browse is available, but creating events/discussions requires an account.
              </div>
              <div className="mt-5 text-[12px] font-semibold" style={{ color: EKARI.sub }}>
                Secure • Real-time • Community
              </div>
            </PremiumSurface>
          </div>
        </div>
      </AppShell>
    );
  }

  /* ---------- MOBILE ---------- */
  /* ---------- BottomSheet state ---------- */
  // (you already have sheetOpen, sheetFooter, provideFooter above)

  /* ---------- Content (THIS WAS MISSING) ---------- */
  const Content = (
    <>
      {TopCards}
      {Controls}

      <div className={cn(isDesktop ? "max-w-[1180px] mx-auto px-4 pt-4 pb-28" : "pt-3")}>
        {active === "events" ? EventsGrid : DiscussionsList}

        {/* mobile safe padding so list doesn’t hide under tabs */}
        {isMobile && <div style={{ height: "calc(96px + env(safe-area-inset-bottom))" }} />}
      </div>

      {/* BottomSheet: create event / discussion */}
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

      {/* Mobile Bottom Tabs + Side Menu */}
      {isMobile && (
        <>
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
        </>
      )}
    </>
  );


  if (isMobile) {
    return (
      <div className="fixed inset-0 flex flex-col" style={premiumBg}>
        {Header}
        <div className="flex-1 overflow-y-auto overscroll-contain">{Content}</div>
      </div>
    );
  }

  // DESKTOP: AppShell + max width
  return (
    <AppShell>
      <div className="min-h-screen w-full" style={premiumBg}>
        {Header}
        {Content}
      </div>
    </AppShell>
  );
}
