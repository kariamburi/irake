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
    IoHomeOutline,
    IoCartOutline,
    IoNotificationsOutline,
    IoMenu,
    IoChevronForward,
    IoCheckmarkCircle,
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
    sand: "#F7F5F1",
    text: "#101828",
    dim: "#667085",
    hair: "#EAECF0",
    sub: "#475467",
};

/* ---------- Helpers ---------- */
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

function cn(...xs: (string | false | null | undefined)[]) {
    return xs.filter(Boolean).join(" ");
}

/* ---------- UI ---------- */
function SimpleSurface({
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
            className={cn("rounded-[24px] border bg-white", className)}
            style={{
                borderColor: EKARI.hair,
                ...style,
            }}
        >
            {children}
        </div>
    );
}

function CountBadge({ count }: { count: number }) {
    if (count <= 0) return null;
    return (
        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-extrabold text-white">
            {count > 99 ? "99+" : count}
        </span>
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

/* ---------- Bottom Sheet ---------- */
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

    if (!mounted || !open) return null;

    return createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-3">
            <button
                type="button"
                className="absolute inset-0 bg-black/40"
                onClick={onClose}
                aria-label="Close modal"
            />
            <div
                role="dialog"
                aria-modal="true"
                className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border bg-white shadow-xl"
                style={{ borderColor: EKARI.hair }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: EKARI.hair }}>
                    <h3 className="truncate text-[15px] font-black" style={{ color: EKARI.text }}>
                        {title || "Create"}
                    </h3>
                    <button
                        aria-label="Close"
                        onClick={onClose}
                        className="grid h-10 w-10 place-items-center rounded-full border bg-white hover:bg-slate-50"
                        style={{ borderColor: EKARI.hair }}
                    >
                        <IoClose />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">{children}</div>

                {footer ? (
                    <div className="border-t p-4" style={{ borderColor: EKARI.hair }}>
                        {footer}
                    </div>
                ) : null}
            </div>
        </div>,
        document.body
    );
}

/* ---------- Money ---------- */
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

/* ---------- Mobile Tabs ---------- */
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
                "flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition",
                active ? "bg-black/[0.04]" : "hover:bg-black/[0.03]"
            )}
            aria-current={active ? "page" : undefined}
        >
            <div style={{ color: active ? EKARI.forest : EKARI.text }}>{icon}</div>
            <span className="text-[11px] font-semibold" style={{ color: active ? EKARI.forest : EKARI.text }}>
                {label}
            </span>
        </Link>
    );

    return (
        <div className="fixed left-0 right-0 z-[60]" style={{ bottom: 0, paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div className="mx-auto w-full max-w-[520px] px-3 pb-3">
                <div
                    className="flex h-[68px] items-center justify-between rounded-[24px] border bg-white px-3 shadow-lg"
                    style={{ borderColor: EKARI.hair }}
                >
                    <TabBtn label="Deeds" icon={<IoHomeOutline size={20} />} href="/" />
                    <TabBtn label="Market" icon={<IoCartOutline size={20} />} href="/market" />

                    <button
                        onClick={onCreate}
                        className="grid h-12 w-16 place-items-center rounded-2xl text-white shadow-sm"
                        style={{ backgroundColor: EKARI.forest }}
                        aria-label="Create"
                    >
                        <IoAdd size={26} />
                    </button>

                    <TabBtn label="Nexus" icon={<IoCompassOutline size={20} />} href="/nexus" active />
                    <TabBtn label="Bonga" icon={<IoChatbubblesOutline size={20} />} href="/bonga" />
                </div>
            </div>
        </div>
    );
}

/* ---------- Profile ---------- */
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

/* ---------- Main ---------- */
export default function NexusPage() {
    useInitEkariTags();

    const isDesktop = useIsDesktop();

    const [active, setActive] = useState<DiveTab>("events");
    const [queryInput, setQueryInput] = useState("");
    const [q, setQ] = useState("");
    const [eventFilter, setEventFilter] = useState<EventCategory | "All">("All");
    const [discFilter, setDiscFilter] = useState<DiscCategory | "All">("All");

    useEffect(() => {
        const t = setTimeout(() => setQ(queryInput.trim().toLowerCase()), 250);
        return () => clearTimeout(t);
    }, [queryInput]);

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

    /* ---------- Create sheet ---------- */
    const [sheetOpen, setSheetOpen] = useState(false);
    const [sheetType, setSheetType] = useState<"event" | "discussion">("event");
    const [sheetFooter, setSheetFooter] = useState<ReactNode>(null);

    const provideFooter = useCallback((node: ReactNode) => setSheetFooter(node), []);

    const openCreateEvent = () => {
        setSheetType("event");
        setSheetOpen(true);
    };

    const openCreateDiscussion = () => {
        setSheetType("discussion");
        setSheetOpen(true);
    };

    /* ---------- UI blocks ---------- */
    const summaryEvents = filteredEvents.length;
    const summaryDiscs = filteredDiscs.length;

    const Controls = (
        <div className={cn(isDesktop ? "px-4" : "px-3")}>
            <SimpleSurface className={cn(isDesktop ? "mt-4 p-3" : "mt-3 p-3")}>
                <div className="flex items-center gap-2">
                    <div
                        className="flex h-11 flex-1 items-center gap-2 rounded-full border bg-[#F8FAFC] px-3"
                        style={{ borderColor: EKARI.hair }}
                    >
                        <IoSearch size={18} style={{ color: EKARI.dim }} />
                        <input
                            value={queryInput}
                            onChange={(e) => setQueryInput(e.target.value)}
                            placeholder={active === "events" ? "Search events..." : "Search discussions..."}
                            className="flex-1 bg-transparent text-[14px] font-medium outline-none"
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
                        className="grid h-11 w-11 place-items-center rounded-2xl border bg-white hover:bg-slate-50"
                        style={{ borderColor: EKARI.hair }}
                        aria-label="Refresh"
                    >
                        <IoReload size={18} style={{ color: EKARI.text }} />
                    </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                        onClick={() => setActive("events")}
                        className={cn(
                            "rounded-full border px-4 py-2.5 text-[13px] font-extrabold transition",
                            active === "events" ? "text-white" : "bg-white text-slate-700"
                        )}
                        style={{
                            backgroundColor: active === "events" ? EKARI.forest : "#fff",
                            borderColor: active === "events" ? EKARI.forest : EKARI.hair,
                        }}
                    >
                        Events
                    </button>

                    <button
                        onClick={() => setActive("discussions")}
                        className={cn(
                            "rounded-full border px-4 py-2.5 text-[13px] font-extrabold transition",
                            active === "discussions" ? "text-white" : "bg-white text-slate-700"
                        )}
                        style={{
                            backgroundColor: active === "discussions" ? EKARI.forest : "#fff",
                            borderColor: active === "discussions" ? EKARI.forest : EKARI.hair,
                        }}
                    >
                        Discussions
                    </button>
                </div>

                <div className="mt-3 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-2">
                        {(active === "events" ? EVENT_FILTERS : DISC_FILTERS).map((item) => {
                            const selected = active === "events" ? eventFilter === item : discFilter === item;

                            return (
                                <button
                                    key={item}
                                    onClick={() =>
                                        active === "events"
                                            ? setEventFilter(item as EventCategory | "All")
                                            : setDiscFilter(item as DiscCategory | "All")
                                    }
                                    className={cn(
                                        "whitespace-nowrap rounded-full border px-3 py-2 text-[12px] font-bold transition",
                                        selected ? "text-white" : "bg-white text-slate-700 hover:bg-slate-50"
                                    )}
                                    style={{
                                        backgroundColor: selected ? EKARI.forest : "#fff",
                                        borderColor: selected ? EKARI.forest : EKARI.hair,
                                    }}
                                >
                                    {item}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </SimpleSurface>
        </div>
    );

    const TopCards = (
        <div className={cn(isDesktop ? "mx-auto max-w-[1180px] px-4 pt-4" : "px-3 pt-3")}>
            <div className={cn(isDesktop ? "grid grid-cols-2 gap-4" : "space-y-3")}>
                <button className="w-full text-left" onClick={() => setActive("events")}>
                    <SimpleSurface className="p-4 hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                            <div
                                className="grid h-11 w-11 place-items-center rounded-2xl"
                                style={{ backgroundColor: "#F5F7FA", color: EKARI.forest }}
                            >
                                <IoCalendarOutline size={18} />
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="text-[15px] font-black" style={{ color: EKARI.text }}>
                                    Events
                                </div>
                                <div className="truncate text-[13px] font-medium" style={{ color: EKARI.sub }}>
                                    {q
                                        ? `${summaryEvents} match your search`
                                        : loadingEvents
                                            ? "Loading events..."
                                            : `${events.length} available`}
                                </div>
                            </div>

                            <CountBadge count={summaryEvents} />
                            <span className="grid h-10 w-10 place-items-center rounded-2xl border bg-white" style={{ borderColor: EKARI.hair }}>
                                <IoChevronForward style={{ color: EKARI.dim }} />
                            </span>
                        </div>
                    </SimpleSurface>
                </button>

                <button className="w-full text-left" onClick={() => setActive("discussions")}>
                    <SimpleSurface className="p-4 hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                            <div
                                className="grid h-11 w-11 place-items-center rounded-2xl"
                                style={{ backgroundColor: "#F5F7FA", color: EKARI.forest }}
                            >
                                <IoChatbubblesOutline size={18} />
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="text-[15px] font-black" style={{ color: EKARI.text }}>
                                    Discussions
                                </div>
                                <div className="truncate text-[13px] font-medium" style={{ color: EKARI.sub }}>
                                    {q
                                        ? `${summaryDiscs} match your search`
                                        : loadingDiscs
                                            ? "Loading discussions..."
                                            : `${discs.length} published`}
                                </div>
                            </div>

                            <CountBadge count={summaryDiscs} />
                            <span className="grid h-10 w-10 place-items-center rounded-2xl border bg-white" style={{ borderColor: EKARI.hair }}>
                                <IoChevronForward style={{ color: EKARI.dim }} />
                            </span>
                        </div>
                    </SimpleSurface>
                </button>
            </div>
        </div>
    );

    /* ---------- Date badge ---------- */
    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    function getCountdownBadge(dateISO?: string) {
        if (!dateISO) return null;

        const target = new Date(dateISO);
        if (Number.isNaN(target.getTime())) return null;

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const targetStart = new Date(target.getFullYear(), target.getMonth(), target.getDate());

        const diffDays = Math.floor((targetStart.getTime() - todayStart.getTime()) / MS_PER_DAY);

        if (diffDays < 0) return { text: "Ended", tone: "ended" as const };
        if (diffDays === 0) return { text: "Today", tone: "today" as const };
        if (diffDays === 1) return { text: "Tomorrow", tone: "tomorrow" as const };
        if (diffDays < 7) return { text: `${diffDays} days left`, tone: "soon" as const };
        if (diffDays < 30) return { text: `${diffDays} days left`, tone: "upcoming" as const };

        const weeks = Math.ceil(diffDays / 7);
        return { text: `${weeks} week${weeks > 1 ? "s" : ""} left`, tone: "upcoming" as const };
    }

    /* ---------- Cards ---------- */
    const EventCard = ({ e }: { e: EventItem }) => {
        const when =
            e.dateISO && !Number.isNaN(new Date(e.dateISO).getTime())
                ? new Date(e.dateISO).toLocaleDateString()
                : "";

        const countdown = getCountdownBadge(e.dateISO);

        const countdownClass =
            countdown?.tone === "ended"
                ? "bg-red-500 text-white"
                : countdown?.tone === "today"
                    ? "bg-amber-500 text-white"
                    : countdown?.tone === "tomorrow"
                        ? "bg-sky-500 text-white"
                        : "bg-black/70 text-white";

        return (
            <Link href={`/nexus/events/${e.id}`} onClick={() => cacheEvent(e)} className="group block">
                <article className="overflow-hidden rounded-[22px] bg-white transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
                    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[22px] bg-slate-100">
                        {e.coverUrl ? (
                            <Image
                                src={e.coverUrl}
                                alt={e.title || "Event cover"}
                                fill
                                className="object-cover transition duration-300 group-hover:scale-[1.03]"
                                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            />
                        ) : (
                            <div className="absolute inset-0 bg-[#EDEDED]" />
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />

                        {e.category ? (
                            <span className="absolute left-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-extrabold text-slate-800 shadow-sm">
                                {e.category}
                            </span>
                        ) : null}

                        {countdown ? (
                            <span className={cn("absolute right-2.5 top-2.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold shadow-sm", countdownClass)}>
                                {countdown.text}
                            </span>
                        ) : null}

                        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-end justify-between gap-2">
                            {e.location ? (
                                <span className="max-w-[65%] truncate rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-slate-700 shadow-sm">
                                    {e.location}
                                </span>
                            ) : (
                                <span />
                            )}

                            <span className="rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
                                {typeof e.price === "number" ? formatMoney(e.price, e.currency) : "Free / Not set"}
                            </span>
                        </div>
                    </div>

                    <div className="px-1.5 pb-1 pt-2.5">
                        <h3 className="line-clamp-2 text-[14px] font-black leading-[1.25]" style={{ color: EKARI.text }}>
                            {e.title}
                        </h3>

                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                            {when ? (
                                <>
                                    <IoCalendarOutline size={12} />
                                    <span>{when}</span>
                                </>
                            ) : (
                                <>
                                    <IoTimeOutline size={12} />
                                    <span>Upcoming event</span>
                                </>
                            )}
                        </div>
                    </div>
                </article>
            </Link>
        );
    };

    const DiscussionCard = ({ d }: { d: DiscussionItem }) => {
        const when = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString() : "";

        const initials =
            d.author?.displayName?.slice(0, 1)?.toUpperCase() ||
            d.author?.username?.slice(0, 1)?.toUpperCase() ||
            "D";

        return (
            <Link href={`/nexus/discussions/${d.id}`} onClick={() => cacheDiscussion(d)} className="group block">
                <article className="overflow-hidden rounded-[22px] border bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: EKARI.hair }}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                            {d.author?.photoURL ? (
                                <div className="relative h-9 w-9 overflow-hidden rounded-full ring-1 ring-black/5">
                                    <Image
                                        src={d.author.photoURL}
                                        alt={d.author?.displayName || "Author"}
                                        fill
                                        className="object-cover"
                                        sizes="36px"
                                    />
                                </div>
                            ) : (
                                <div
                                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-black text-white"
                                    style={{ backgroundColor: EKARI.forest }}
                                >
                                    {initials}
                                </div>
                            )}

                            <div className="min-w-0">
                                <div className="truncate text-[12px] font-extrabold" style={{ color: EKARI.text }}>
                                    {d.author?.displayName || d.author?.username || "Community member"}
                                </div>
                                <div className="truncate text-[11px] text-slate-500">
                                    {when || "Recent discussion"}
                                </div>
                            </div>
                        </div>

                        {d.category ? (
                            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold text-slate-700">
                                {d.category}
                            </span>
                        ) : null}
                    </div>

                    <div className="mt-4">
                        <h3 className="line-clamp-2 text-[15px] font-black leading-[1.28]" style={{ color: EKARI.text }}>
                            {d.title}
                        </h3>

                        {d.body ? (
                            <p className="mt-2 line-clamp-4 text-[12px] leading-5 text-slate-600">
                                {d.body}
                            </p>
                        ) : null}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                                <IoChatbubbleEllipsesOutline size={12} />
                                {d.repliesCount || 0} replies
                            </span>

                            {d.tags?.[0] ? (
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1">
                                    #{d.tags[0]}
                                </span>
                            ) : null}
                        </div>

                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 opacity-0 transition group-hover:opacity-100">
                            Open
                        </span>
                    </div>
                </article>
            </Link>
        );
    };

    /* ---------- Feed ---------- */
    const Feed = (
        <div className={cn(isDesktop ? "mx-auto max-w-[1180px] px-4 pb-10" : "px-3 pb-28")}>
            {active === "events" ? (
                <>
                    {loadingEvents ? (
                        <div className="py-14">
                            <BouncingBallLoader />
                        </div>
                    ) : filteredEvents.length === 0 ? (
                        <SimpleSurface className="px-5 py-10 text-center">
                            <div className="mx-auto flex max-w-md flex-col items-center">
                                <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-slate-100">
                                    <IoCalendarOutline size={24} style={{ color: EKARI.forest }} />
                                </div>
                                <h3 className="text-[16px] font-black" style={{ color: EKARI.text }}>
                                    No events found
                                </h3>
                                <p className="mt-1 text-[13px] text-slate-500">
                                    Try another search term or switch category.
                                </p>
                            </div>
                        </SimpleSurface>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                                {filteredEvents.map((e) => (
                                    <EventCard key={e.id} e={e} />
                                ))}
                            </div>

                            <div className="mt-8 flex justify-center">
                                <button
                                    onClick={loadMoreEvents}
                                    disabled={pagingEvents}
                                    className="rounded-full border bg-white px-5 py-2.5 text-[13px] font-extrabold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                                    style={{ borderColor: EKARI.hair }}
                                >
                                    {pagingEvents ? "Loading..." : "Load more"}
                                </button>
                            </div>
                        </>
                    )}
                </>
            ) : (
                <>
                    {loadingDiscs ? (
                        <div className="py-14">
                            <BouncingBallLoader />
                        </div>
                    ) : filteredDiscs.length === 0 ? (
                        <SimpleSurface className="px-5 py-10 text-center">
                            <div className="mx-auto flex max-w-md flex-col items-center">
                                <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-slate-100">
                                    <IoChatbubblesOutline size={24} style={{ color: EKARI.forest }} />
                                </div>
                                <h3 className="text-[16px] font-black" style={{ color: EKARI.text }}>
                                    No discussions found
                                </h3>
                                <p className="mt-1 text-[13px] text-slate-500">
                                    Try another search term or category.
                                </p>
                            </div>
                        </SimpleSurface>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {filteredDiscs.map((d) => (
                                    <DiscussionCard key={d.id} d={d} />
                                ))}
                            </div>

                            <div className="mt-8 flex justify-center">
                                <button
                                    onClick={loadMoreDiscs}
                                    disabled={pagingDiscs}
                                    className="rounded-full border bg-white px-5 py-2.5 text-[13px] font-extrabold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                                    style={{ borderColor: EKARI.hair }}
                                >
                                    {pagingDiscs ? "Loading..." : "Load more"}
                                </button>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );

    const desktopSidebar = (
        <div className="sticky top-0 h-screen border-r bg-white" style={{ borderColor: EKARI.hair }}>
            <div className="flex h-full flex-col">
                <div className="px-5 pt-4">
                    <div className="flex items-center justify-between gap-3">
                        <Link href="/" className="flex items-center gap-2">
                            <span className="text-[28px] font-black" style={{ color: EKARI.gold }}>
                                ekarihub
                            </span>
                        </Link>

                        <button
                            type="button"
                            className="grid h-10 w-10 place-items-center rounded-full border bg-white hover:bg-slate-50"
                            style={{ borderColor: EKARI.hair }}
                            onClick={() => setMenuOpen(true)}
                            aria-label="Open menu"
                        >
                            <IoMenu size={20} />
                        </button>
                    </div>

                    <div
                        className="mt-4 flex h-11 items-center gap-2 rounded-full border bg-slate-50 px-3"
                        style={{ borderColor: EKARI.hair }}
                    >
                        <IoSearch size={18} style={{ color: EKARI.dim }} />
                        <span className="text-[14px] font-medium text-slate-400">Search</span>
                    </div>
                </div>

                <div className="mt-5 flex-1 px-3">
                    <nav className="space-y-1">
                        <Link href="/deeds" className="flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-semibold text-slate-700 hover:bg-slate-50">
                            <IoHomeOutline size={20} />
                            Deeds
                        </Link>

                        <Link href="/market" className="flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-semibold text-slate-700 hover:bg-slate-50">
                            <IoCartOutline size={20} />
                            ekariMarket
                        </Link>

                        <Link
                            href="/nexus"
                            className="flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-semibold"
                            style={{ backgroundColor: "#F7F7F8", color: EKARI.gold }}
                        >
                            <IoCompassOutline size={20} />
                            Nexus
                        </Link>

                        <Link href="/studio" className="flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-semibold text-slate-700 hover:bg-slate-50">
                            <IoCalendarOutline size={20} />
                            Deed studio
                        </Link>

                        <Link href="/notifications" className="flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-semibold text-slate-700 hover:bg-slate-50">
                            <IoNotificationsOutline size={20} />
                            Notifications
                            <CountBadge count={notifTotal} />
                        </Link>

                        <Link href="/bonga" className="flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-semibold text-slate-700 hover:bg-slate-50">
                            <IoChatbubblesOutline size={20} />
                            Bonga
                            <CountBadge count={unreadDM} />
                        </Link>

                        <Link href={profileHref} className="flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-semibold text-slate-700 hover:bg-slate-50">
                            <IoCheckmarkCircle size={20} />
                            Profile
                        </Link>
                    </nav>
                </div>

                <div className="border-t p-4" style={{ borderColor: EKARI.hair }}>
                    {uid ? (
                        <button
                            onClick={signOutUser}
                            className="w-full rounded-2xl border px-4 py-3 text-[14px] font-bold text-slate-700 hover:bg-slate-50"
                            style={{ borderColor: EKARI.hair }}
                        >
                            Sign out
                        </button>
                    ) : (
                        <Link
                            href="/getstarted"
                            className="block w-full rounded-2xl px-4 py-3 text-center text-[14px] font-bold text-white"
                            style={{ backgroundColor: EKARI.forest }}
                        >
                            Log in
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );

    const desktopHeader = (
        <div className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur" style={{ borderColor: EKARI.hair }}>
            <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-4 py-3">
                <div>
                    <h1 className="text-[28px] font-black tracking-tight" style={{ color: EKARI.text }}>
                        Nexus
                    </h1>
                    <p className="text-[13px] font-medium text-slate-500">
                        Explore • Connect • Learn
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Link
                        href="/notifications"
                        className="relative grid h-11 w-11 place-items-center rounded-full border bg-white hover:bg-slate-50"
                        style={{ borderColor: EKARI.hair }}
                    >
                        <IoNotificationsOutline size={20} />
                        {notifTotal > 0 ? (
                            <span className="absolute right-0 top-0 h-5 min-w-[20px] rounded-full bg-red-500 px-1 text-center text-[11px] font-extrabold leading-5 text-white">
                                {notifTotal > 99 ? "99+" : notifTotal}
                            </span>
                        ) : null}
                    </Link>

                    <button
                        onClick={openCreateEvent}
                        className="rounded-full px-5 py-3 text-[14px] font-extrabold text-white"
                        style={{ backgroundColor: EKARI.forest }}
                    >
                        + Create Event
                    </button>

                    <Link href={profileHref} className="relative h-11 w-11 overflow-hidden rounded-full border bg-slate-100" style={{ borderColor: EKARI.hair }}>
                        {profile?.photoURL ? (
                            <Image src={profile.photoURL} alt="Profile" fill className="object-cover" sizes="44px" />
                        ) : null}
                    </Link>
                </div>
            </div>
        </div>
    );

    const mobileHeader = (
        <div className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur" style={{ borderColor: EKARI.hair }}>
            <div className="flex items-center justify-between gap-3 px-3 py-3">
                <div>
                    <h1 className="text-[24px] font-black" style={{ color: EKARI.text }}>
                        Nexus
                    </h1>
                    <p className="text-[12px] font-medium text-slate-500">
                        Explore • Connect • Learn
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setMenuOpen(true)}
                        className="grid h-10 w-10 place-items-center rounded-full border bg-white"
                        style={{ borderColor: EKARI.hair }}
                    >
                        <IoMenu size={20} />
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <AppShell>
                <div className="min-h-screen bg-[#FAFAFA]">
                    {isDesktop ? (

                        <main className="w-full">
                            {desktopHeader}
                            {TopCards}
                            {Controls}
                            {Feed}
                        </main>

                    ) : (
                        <main className="min-h-screen">
                            {mobileHeader}
                            {TopCards}
                            {Controls}
                            {Feed}
                            <MobileBottomTabs onCreate={openCreateEvent} />
                        </main>
                    )}
                </div>
            </AppShell>

            <BottomSheet
                open={sheetOpen}
                onClose={() => {
                    setSheetOpen(false);
                    setSheetFooter(null);
                }}
                title={sheetType === "event" ? "Create Event" : "Start Discussion"}
                footer={sheetFooter}
            >
                {sheetType === "event" ? (
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
    );
}