"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppShell from "@/app/components/AppShell";
import { useAuth } from "../hooks/useAuth";
import {
    IoArrowBack,
    IoArrowForwardOutline,
    IoCalendarOutline,
    IoChatbubbleEllipsesOutline,
    IoChevronForwardOutline,
    IoPeopleOutline,
    IoPersonOutline,
    IoSearch,
    IoSparklesOutline,
} from "react-icons/io5";
import { getFunctions, httpsCallable } from "firebase/functions";
import SmartAvatar from "../components/SmartAvatar";

const EKARI = {
    forest: "#173C2E",
    leaf: "#214C3A",
    gold: "#F39A22",
    page: "#F8F7F2",
    surface: "#FBFAF6",
    sand: "#FFFFFF",
    text: "#0F172A",
    dim: "#64748B",
    hair: "#DDD8CC",
};

type SuggestionTab = "profiles" | "events" | "discussions";

type SuggestedProfile = {
    id?: string;
    userId?: string;
    handle?: string;
    firstName?: string;
    surname?: string;
    photoURL?: string;
    location?: any;
    [key: string]: any;
};

type SuggestedEvent = {
    id?: string;
    title?: string;
    dateISO?: string | null;
    location?: string | null;
    coverUrl?: string | null;
    tags?: string[];
    [key: string]: any;
};

type SuggestedDiscussion = {
    id?: string;
    title?: string;
    hashtag?: string | null;
    tags?: string[];
    [key: string]: any;
};

function useMediaQuery(queryStr: string) {
    const [matches, setMatches] = React.useState(false);
    React.useEffect(() => {
        if (typeof window === "undefined") return;
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

function PageGlowBg() {
    return (
        <>
            <div
                aria-hidden
                className="pointer-events-none fixed inset-0 -z-10 bg-[#F8F7F2]"
            />
            <div
                aria-hidden
                className="pointer-events-none fixed -right-32 -top-28 -z-10 h-80 w-80 rounded-full bg-[#173C2E]/[0.025]"
            />
            <div
                aria-hidden
                className="pointer-events-none fixed -bottom-40 -left-24 -z-10 h-80 w-80 rounded-full bg-[#F39A22]/[0.035]"
            />
        </>
    );
}

function MobileTopBar({
    activeTab,
    setActiveTab,
    counts,
}: {
    activeTab: SuggestionTab;
    setActiveTab: (t: SuggestionTab) => void;
    counts: Record<SuggestionTab, number>;
}) {
    return (
        <div className="border-b border-[#DDD8CC] bg-[#F8F7F2]/95 backdrop-blur-xl">
            <div
                className="px-3"
                style={{
                    paddingTop:
                        "env(safe-area-inset-top)",
                }}
            >
                <div className="flex h-14 items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            if (
                                typeof window !==
                                "undefined" &&
                                window.history.length >
                                1
                            ) {
                                window.history.back();
                            } else {
                                window.location.href =
                                    "/";
                            }
                        }}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border border-[#DDD8CC] bg-[#FBFAF6] text-[#173C2E]"
                        aria-label="Back"
                    >
                        <IoArrowBack size={18} />
                    </button>

                    <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-black text-slate-900">
                            Dive In
                        </div>

                        <div className="truncate text-[9px] font-medium text-slate-400">
                            Recommendations selected for you
                        </div>
                    </div>

                    <Link
                        href="/search"
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border border-[#DDD8CC] bg-[#FBFAF6] text-[#173C2E]"
                        aria-label="Search"
                    >
                        <IoSearch size={17} />
                    </Link>
                </div>

                <SuggestionTabs
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    counts={counts}
                    mobile
                />
            </div>
        </div>
    );
}

function SuggestionTabs({
    activeTab,
    setActiveTab,
    counts,
    mobile = false,
}: {
    activeTab: SuggestionTab;
    setActiveTab: (t: SuggestionTab) => void;
    counts: Record<SuggestionTab, number>;
    mobile?: boolean;
}) {
    const tabs: {
        key: SuggestionTab;
        label: string;
        Icon: React.ComponentType<{ size?: number }>;
    }[] = [
            {
                key: "profiles",
                label: "Profiles",
                Icon: IoPeopleOutline,
            },
            {
                key: "events",
                label: "Events",
                Icon: IoCalendarOutline,
            },
            {
                key: "discussions",
                label: "Discussions",
                Icon: IoChatbubbleEllipsesOutline,
            },
        ];

    return (
        <div className={mobile ? "no-scrollbar overflow-x-auto pb-3" : ""}>
            <div className="flex min-w-max items-center gap-1">
                {tabs.map(({ key, label, Icon }) => {
                    const active =
                        activeTab === key;

                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() =>
                                setActiveTab(key)
                            }
                            className={[
                                "relative inline-flex h-9 items-center gap-1.5 rounded-[11px] px-3",
                                "text-[9px] font-black transition-all duration-200",
                                active
                                    ? "bg-[#173C2E] text-white"
                                    : "text-slate-500 hover:bg-[#F3F1EB] hover:text-[#173C2E]",
                            ].join(" ")}
                        >
                            <Icon size={13} />
                            {label}
                            <span
                                className={[
                                    "rounded-full px-1.5 py-0.5 text-[7px] font-black",
                                    active
                                        ? "bg-white/10 text-white/70"
                                        : "bg-[#F3F1EB] text-slate-400",
                                ].join(" ")}
                            >
                                {counts[key] ?? 0}
                            </span>

                            {active ? (
                                <motion.span
                                    layoutId={
                                        mobile
                                            ? "suggestion-tabs-mobile"
                                            : "suggestion-tabs-desktop"
                                    }
                                    className="absolute inset-x-3 -bottom-[2px] h-[2px] rounded-full bg-[#F39A22]"
                                />
                            ) : null}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function ResultSurface({
    children,
}: React.PropsWithChildren) {
    return (
        <div className="overflow-hidden rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
            {children}
        </div>
    );
}

function SkeletonRow() {
    return (
        <div className="flex items-center gap-3 border-b border-[#E8E3D8] px-3.5 py-3.5 last:border-b-0">
            <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-[#ECE9E2]" />

            <div className="min-w-0 flex-1">
                <div className="h-3.5 w-44 animate-pulse rounded bg-[#ECE9E2]" />
                <div className="mt-2 h-2.5 w-28 animate-pulse rounded bg-[#F1EEE8]" />
            </div>

            <div className="h-8 w-20 animate-pulse rounded-[10px] bg-[#ECE9E2]" />
        </div>
    );
}

function formatEventDate(dateISO?: string | null) {
    if (!dateISO) return null;
    const d = new Date(dateISO);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

type TabState = {
    loading: boolean;
    loadingMore: boolean;
    items: any[];
    page: number;
    hasMore: boolean;
    total: number;
    loadedOnce: boolean;
    error?: string | null;
    // ✅ keep rootItems for fallback paging
    rootItems?: any[];
};

const defaultTabState: TabState = {
    loading: true,
    loadingMore: false,
    items: [],
    page: 1,
    hasMore: true,
    total: 0,
    loadedOnce: false,
    error: null,
    rootItems: [],
};

export default function SuggestionsPageClient() {
    const { user } = useAuth();
    const uid = user?.uid;

    const isDesktop = useIsDesktop();
    const isMobile = useIsMobile();

    const [activeTab, setActiveTab] = useState<SuggestionTab>("profiles");

    const [tabState, setTabState] = useState<Record<SuggestionTab, TabState>>({
        profiles: { ...defaultTabState },
        events: { ...defaultTabState },
        discussions: { ...defaultTabState },
    });

    const calledRef = useRef(false);
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    // ✅ for stable IO callback (avoid stale closure)
    const activeTabRef = useRef<SuggestionTab>("profiles");
    useEffect(() => {
        activeTabRef.current = activeTab;
    }, [activeTab]);

    const counts = useMemo(
        () => ({
            profiles: tabState.profiles.total || 0,
            events: tabState.events.total || 0,
            discussions: tabState.discussions.total || 0,
        }),
        [tabState]
    );

    const handleToPath = (handle?: string) =>
        handle ? `/@${encodeURIComponent(handle.startsWith("@") ? handle.slice(1) : handle)}` : null;

    async function loadTabSummary(tab: SuggestionTab) {
        if (!uid) return { total: 0, rootItems: [] as any[], pageSize: 10, pages: 1 };

        const snap = await getDoc(doc(db, "users", uid, "suggestions", tab));
        const data: any = snap.data() || {};

        const rootItems = Array.isArray(data.items) ? data.items : [];
        const totalRaw = typeof data.total === "number" ? data.total : 0;
        const total = Math.max(totalRaw, rootItems.length);

        return {
            total,
            rootItems,
            pageSize: typeof data.pageSize === "number" ? data.pageSize : 10,
            pages: typeof data.pages === "number" ? data.pages : Math.max(1, Math.ceil(total / 10)),
        };
    }

    async function loadPage(tab: SuggestionTab, page: number, rootItemsFallback: any[]) {
        if (!uid) return { pageItems: [], hasMore: false };

        const pageSnap = await getDoc(doc(db, "users", uid, "suggestions", tab, "pages", String(page)));
        const pageData: any = pageSnap.data() || {};
        const pageItems = Array.isArray(pageData.items) ? pageData.items : [];
        const hasMore = !!pageData.hasMore;

        // fallback
        if (!pageSnap.exists || pageItems.length === 0) {
            const pageSize = 10;
            const start = (page - 1) * pageSize;
            const slice = (rootItemsFallback || []).slice(start, start + pageSize);
            const fallbackHasMore = start + pageSize < (rootItemsFallback || []).length;
            return { pageItems: slice, hasMore: fallbackHasMore };
        }

        return { pageItems, hasMore };
    }

    // 1) refresh once, then load all tabs (summary + page1) in parallel
    useEffect(() => {
        if (!uid) return;
        if (calledRef.current) return;
        calledRef.current = true;

        (async () => {
            try {
                const functions = getFunctions(undefined, "us-central1");
                const refresh = httpsCallable(functions, "refreshSuggestionsForMe");
                const res = await refresh({ force: false });
                console.log("refreshSuggestionsForMe:", res.data);
            } catch (e: any) {
                console.error("refreshSuggestionsForMe failed:", e?.message || e);
                if (e?.details?.indexUrl) console.error("Create Firestore index here:", e.details.indexUrl);
            }

            const tabs: SuggestionTab[] = ["profiles", "events", "discussions"];

            setTabState((prev) => {
                const next = { ...prev };
                for (const t of tabs) {
                    next[t] = {
                        ...prev[t],
                        loading: true,
                        loadingMore: false,
                        error: null,
                        page: 1,
                        hasMore: true,
                        items: [],
                    };
                }
                return next;
            });

            await Promise.all(
                tabs.map(async (t) => {
                    try {
                        const summary = await loadTabSummary(t);
                        const page1 = await loadPage(t, 1, summary.rootItems);

                        setTabState((prev) => ({
                            ...prev,
                            [t]: {
                                ...prev[t],
                                loading: false,
                                loadedOnce: true,
                                total: summary.total,
                                rootItems: summary.rootItems,
                                items: page1.pageItems,
                                page: 1,
                                hasMore: page1.hasMore,
                                error: null,
                            },
                        }));
                    } catch (err: any) {
                        console.error("load initial tab failed:", t, err?.message || err);
                        setTabState((prev) => ({
                            ...prev,
                            [t]: {
                                ...prev[t],
                                loading: false,
                                loadedOnce: true,
                                items: [],
                                total: 0,
                                hasMore: false,
                                error: err?.message || "Failed to load",
                                rootItems: [],
                            },
                        }));
                    }
                })
            );
        })();
    }, [uid]);

    // 2) infinite scroll for active tab only
    useEffect(() => {
        if (!uid) return;
        if (!sentinelRef.current) return;

        const el = sentinelRef.current;

        const io = new IntersectionObserver(
            (entries) => {
                const first = entries[0];
                if (!first?.isIntersecting) return;

                const tab = activeTabRef.current;
                const s = tabState[tab];

                if (!s) return;
                if (s.loading || s.loadingMore) return;
                if (!s.hasMore) return;

                (async () => {
                    // optimistic set
                    setTabState((prev) => ({
                        ...prev,
                        [tab]: { ...prev[tab], loadingMore: true, error: null },
                    }));

                    try {
                        // read latest page from state inside setter-safe way:
                        const currentPage = tabState[tab]?.page || 1;
                        const nextPage = currentPage + 1;

                        const rootItemsFallback = tabState[tab]?.rootItems || [];
                        const { pageItems, hasMore } = await loadPage(tab, nextPage, rootItemsFallback);

                        if (!pageItems.length) {
                            setTabState((prev) => ({
                                ...prev,
                                [tab]: { ...prev[tab], loadingMore: false, hasMore: false },
                            }));
                            return;
                        }

                        setTabState((prev) => {
                            const prevItems = prev[tab].items || [];
                            const seen = new Set(prevItems.map((x: any) => String(x?.id || "")));
                            const merged = [...prevItems];

                            for (const it of pageItems) {
                                const id = String((it as any)?.id || "");
                                if (id && !seen.has(id)) merged.push(it);
                            }

                            return {
                                ...prev,
                                [tab]: {
                                    ...prev[tab],
                                    loadingMore: false,
                                    page: nextPage,
                                    hasMore,
                                    items: merged,
                                },
                            };
                        });
                    } catch (err: any) {
                        console.error("load next page failed:", err?.message || err);
                        setTabState((prev) => ({
                            ...prev,
                            [tab]: {
                                ...prev[tab],
                                loadingMore: false,
                                hasMore: false,
                                error: err?.message || "Failed to load more",
                            },
                        }));
                    }
                })();
            },
            { root: null, rootMargin: "900px 0px", threshold: 0.01 }
        );

        io.observe(el);
        return () => io.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid, tabState, activeTab]);

    const active = tabState[activeTab];
    const items = active.items || [];

    const renderItems = () => {
        if (active.loading) {
            return (
                <ResultSurface>
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                </ResultSurface>
            );
        }

        if (items.length === 0) {
            return (
                <div className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] px-5 py-10 text-center">
                    <div className="mx-auto grid h-11 w-11 place-items-center rounded-[14px] bg-[#E8ECE8] text-[#173C2E]">
                        <IoSparklesOutline size={19} />
                    </div>

                    <div className="mt-3 text-[11px] font-black text-slate-700">
                        You&apos;re all caught up.
                    </div>

                    <p className="mx-auto mt-1 max-w-sm text-[9px] font-medium leading-4 text-slate-400">
                        We&apos;ll show more recommendations here as your activity and interests evolve.
                    </p>

                    {active.error ? (
                        <p className="mt-2 text-[8px] font-semibold text-rose-500">
                            {active.error}
                        </p>
                    ) : null}
                </div>
            );
        }

        return (
            <>
                <ResultSurface>
                    <AnimatePresence
                        mode="popLayout"
                        initial={false}
                    >
                        {items.map(
                            (
                                item: any,
                                index: number
                            ) => {
                                if (
                                    activeTab ===
                                    "profiles"
                                ) {
                                    const p =
                                        item as SuggestedProfile;

                                    const name =
                                        p.handle ||
                                        [
                                            p.firstName,
                                            p.surname,
                                        ]
                                            .filter(
                                                Boolean
                                            )
                                            .join(
                                                " "
                                            ) ||
                                        "Suggested profile";

                                    const profilePath =
                                        handleToPath(
                                            p.handle
                                        );

                                    return (
                                        <motion.div
                                            layout
                                            key={
                                                p.id ??
                                                index
                                            }
                                            initial={{
                                                opacity: 0,
                                                y: 4,
                                            }}
                                            animate={{
                                                opacity: 1,
                                                y: 0,
                                            }}
                                            exit={{
                                                opacity: 0,
                                            }}
                                            transition={{
                                                duration: 0.15,
                                            }}
                                            className="border-b border-[#E8E3D8] last:border-b-0"
                                        >
                                            <div className="group flex items-center gap-3 px-3.5 py-3.5 transition hover:bg-white sm:px-4">
                                                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#E8ECE8]">
                                                    <SmartAvatar
                                                        src={
                                                            p.photoURL
                                                        }
                                                        alt={
                                                            name ||
                                                            "User"
                                                        }
                                                        size={
                                                            46
                                                        }
                                                    />
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <h2 className="truncate text-[11px] font-black text-slate-800 sm:text-[12px]">
                                                        {
                                                            name
                                                        }
                                                    </h2>

                                                    <p className="mt-0.5 truncate text-[8px] font-medium text-slate-400">
                                                        Suggested profile
                                                    </p>
                                                </div>

                                                {profilePath ? (
                                                    <Link
                                                        href={
                                                            profilePath
                                                        }
                                                        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[11px] border border-[#DDD8CC] bg-[#FBFAF6] px-3 text-[8px] font-black text-[#173C2E] transition hover:bg-[#E8ECE8]"
                                                    >
                                                        View
                                                        <IoChevronForwardOutline
                                                            size={
                                                                11
                                                            }
                                                        />
                                                    </Link>
                                                ) : null}
                                            </div>
                                        </motion.div>
                                    );
                                }

                                if (
                                    activeTab ===
                                    "events"
                                ) {
                                    const e =
                                        item as SuggestedEvent;

                                    const href =
                                        e?.id
                                            ? `/nexus/event/${encodeURIComponent(
                                                String(
                                                    e.id
                                                )
                                            )}`
                                            : null;

                                    return (
                                        <motion.div
                                            layout
                                            key={
                                                e.id ??
                                                index
                                            }
                                            initial={{
                                                opacity: 0,
                                                y: 4,
                                            }}
                                            animate={{
                                                opacity: 1,
                                                y: 0,
                                            }}
                                            exit={{
                                                opacity: 0,
                                            }}
                                            transition={{
                                                duration: 0.15,
                                            }}
                                            className="border-b border-[#E8E3D8] last:border-b-0"
                                        >
                                            <div className="group flex items-center gap-3 px-3.5 py-3.5 transition hover:bg-white sm:px-4">
                                                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[12px] bg-[#ECE9E2]">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={
                                                            e.coverUrl ||
                                                            "/event-placeholder.png"
                                                        }
                                                        alt={
                                                            e.title ||
                                                            "Event"
                                                        }
                                                        className="h-full w-full object-cover"
                                                    />
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <h2 className="truncate text-[11px] font-black text-slate-800 sm:text-[12px]">
                                                        {e.title ||
                                                            "Untitled event"}
                                                    </h2>

                                                    <p className="mt-0.5 truncate text-[8px] font-medium text-slate-400">
                                                        {formatEventDate(
                                                            e.dateISO
                                                        ) ||
                                                            "Upcoming"}
                                                        {e.location
                                                            ? ` • ${e.location}`
                                                            : ""}
                                                    </p>

                                                    {!!e.tags
                                                        ?.length ? (
                                                        <div className="mt-1.5 flex max-w-full gap-1 overflow-hidden">
                                                            {e.tags
                                                                .slice(
                                                                    0,
                                                                    3
                                                                )
                                                                .map(
                                                                    (
                                                                        t
                                                                    ) => (
                                                                        <span
                                                                            key={
                                                                                t
                                                                            }
                                                                            className="shrink-0 rounded-full bg-[#F3F1EB] px-2 py-0.5 text-[7px] font-black text-slate-400"
                                                                        >
                                                                            #
                                                                            {
                                                                                t
                                                                            }
                                                                        </span>
                                                                    )
                                                                )}
                                                        </div>
                                                    ) : null}
                                                </div>

                                                {href ? (
                                                    <Link
                                                        href={
                                                            href
                                                        }
                                                        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[11px] border border-[#DDD8CC] bg-[#FBFAF6] px-3 text-[8px] font-black text-[#173C2E] transition hover:bg-[#E8ECE8]"
                                                    >
                                                        View
                                                        <IoChevronForwardOutline
                                                            size={
                                                                11
                                                            }
                                                        />
                                                    </Link>
                                                ) : null}
                                            </div>
                                        </motion.div>
                                    );
                                }

                                const d =
                                    item as SuggestedDiscussion;

                                const href =
                                    d?.id
                                        ? `/nexus/discussion/${encodeURIComponent(
                                            String(
                                                d.id
                                            )
                                        )}`
                                        : null;

                                return (
                                    <motion.div
                                        layout
                                        key={
                                            d.id ??
                                            index
                                        }
                                        initial={{
                                            opacity: 0,
                                            y: 4,
                                        }}
                                        animate={{
                                            opacity: 1,
                                            y: 0,
                                        }}
                                        exit={{
                                            opacity: 0,
                                        }}
                                        transition={{
                                            duration: 0.15,
                                        }}
                                        className="border-b border-[#E8E3D8] last:border-b-0"
                                    >
                                        <div className="group flex items-center gap-3 px-3.5 py-3.5 transition hover:bg-white sm:px-4">
                                            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[#E8ECE8] text-[#173C2E]">
                                                <IoChatbubbleEllipsesOutline
                                                    size={
                                                        17
                                                    }
                                                />
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <h2 className="truncate text-[11px] font-black text-slate-800 sm:text-[12px]">
                                                    {d.title ||
                                                        "Discussion"}
                                                </h2>

                                                <p className="mt-0.5 truncate text-[8px] font-medium text-slate-400">
                                                    {d.hashtag
                                                        ? `#${d.hashtag}`
                                                        : "Suggested discussion"}
                                                </p>

                                                {!!d.tags
                                                    ?.length ? (
                                                    <div className="mt-1.5 flex max-w-full gap-1 overflow-hidden">
                                                        {d.tags
                                                            .slice(
                                                                0,
                                                                3
                                                            )
                                                            .map(
                                                                (
                                                                    t
                                                                ) => (
                                                                    <span
                                                                        key={
                                                                            t
                                                                        }
                                                                        className="shrink-0 rounded-full bg-[#F3F1EB] px-2 py-0.5 text-[7px] font-black text-slate-400"
                                                                    >
                                                                        #
                                                                        {
                                                                            t
                                                                        }
                                                                    </span>
                                                                )
                                                            )}
                                                    </div>
                                                ) : null}
                                            </div>

                                            {href ? (
                                                <Link
                                                    href={
                                                        href
                                                    }
                                                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[11px] border border-[#DDD8CC] bg-[#FBFAF6] px-3 text-[8px] font-black text-[#173C2E] transition hover:bg-[#E8ECE8]"
                                                >
                                                    View
                                                    <IoChevronForwardOutline
                                                        size={
                                                            11
                                                        }
                                                    />
                                                </Link>
                                            ) : null}
                                        </div>
                                    </motion.div>
                                );
                            }
                        )}
                    </AnimatePresence>
                </ResultSurface>

                <div
                    ref={sentinelRef}
                    className="h-10"
                />

                {active.loadingMore ? (
                    <div className="pb-3 text-center text-[8px] font-black text-slate-400">
                        Loading more...
                    </div>
                ) : null}

                {!active.hasMore &&
                    items.length > 0 ? (
                    <div className="pb-3 text-center text-[8px] font-semibold text-slate-400">
                        You&apos;re all caught up.
                    </div>
                ) : null}
            </>
        );
    };

    const MainContent = (
        <main
            className={[
                "h-full w-full max-w-full",
                "overflow-y-auto overflow-x-hidden",
                "overscroll-contain",
                "bg-[#F8F7F2]",
                "touch-pan-y",
            ].join(" ")}
            style={{
                WebkitOverflowScrolling: "touch",
            }}
        >
            <PageGlowBg />

            <div className="mx-auto w-full max-w-[1320px] px-3 pb-24 pt-4 sm:px-5 lg:px-6 lg:pb-10 lg:pt-5">
                {/* Desktop header */}
                {isDesktop ? (
                    <header className="mb-5">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <div className="text-[9px] font-black uppercase tracking-[0.12em] text-[#F39A22]">
                                    Discover
                                </div>

                                <h1 className="mt-1 text-[22px] font-black tracking-[-0.04em] text-slate-900 md:text-[26px]">
                                    Dive In
                                </h1>

                                <p className="mt-1 max-w-[640px] text-[9px] font-medium leading-4 text-slate-400">
                                    Profiles, events and discussions recommended from your activity, interests and community signals.
                                </p>
                            </div>

                            <Link
                                href="/search"
                                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[13px] border border-[#DDD8CC] bg-[#FBFAF6] px-4 text-[9px] font-black text-[#173C2E] transition hover:bg-white"
                            >
                                <IoSearch size={14} />
                                Search ekarihub
                            </Link>
                        </div>

                        <div className="mt-4">
                            <SuggestionTabs
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                                counts={counts}
                            />
                        </div>
                    </header>
                ) : null}

                {!uid ? (
                    <div className="mb-5 rounded-[18px] border border-dashed border-[#DDD8CC] bg-[#FBFAF6] p-5 text-center">
                        <div className="mx-auto grid h-10 w-10 place-items-center rounded-[13px] bg-[#E8ECE8] text-[#173C2E]">
                            <IoPersonOutline size={18} />
                        </div>

                        <p className="mt-3 text-[10px] font-black text-slate-700">
                            Sign in for personalised suggestions
                        </p>

                        <p className="mx-auto mt-1 max-w-sm text-[8px] font-medium leading-4 text-slate-400">
                            Your interests and activity help ekarihub recommend more relevant people, events and discussions.
                        </p>

                        <Link
                            href="/getstarted"
                            className="mt-3 inline-flex h-9 items-center rounded-[11px] bg-[#173C2E] px-4 text-[8px] font-black text-white"
                        >
                            Get started
                        </Link>
                    </div>
                ) : null}

                <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
                    {/* Recommendation stream */}
                    <section className="min-w-0">
                        <div className="mb-2.5 flex items-center justify-between gap-3 px-1">
                            <div>
                                <h2 className="text-[11px] font-black text-slate-800">
                                    {activeTab ===
                                        "profiles"
                                        ? "Profiles for you"
                                        : activeTab ===
                                            "events"
                                            ? "Events for you"
                                            : "Discussions for you"}
                                </h2>

                                <p className="mt-0.5 text-[8px] font-medium text-slate-400">
                                    {active.total || 0} recommendations
                                </p>
                            </div>
                        </div>

                        {renderItems()}
                    </section>

                    {/* Right discovery rail */}
                    <aside className="hidden xl:block">
                        <div className="sticky top-5 space-y-4">
                            <div className="rounded-[17px] border border-[#DDD8CC] bg-[#FBFAF6] p-4">
                                <div className="flex items-start gap-3">
                                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[#FFF2DF] text-[#F39A22]">
                                        <IoSparklesOutline size={18} />
                                    </span>

                                    <div>
                                        <div className="text-[9px] font-black text-slate-700">
                                            Why these suggestions?
                                        </div>

                                        <p className="mt-1 text-[8px] font-medium leading-4 text-slate-400">
                                            Dive In uses your interests, roles and activity to surface useful people, events and conversations.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-[17px] border border-[#DDD8CC] bg-[#FBFAF6] p-4">
                                <div className="text-[8px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
                                    Explore more
                                </div>

                                <div className="mt-3 space-y-1.5">
                                    <RailLink
                                        href="/search?tab=Accounts"
                                        icon={<IoPeopleOutline size={14} />}
                                        title="Find people"
                                        description="Search accounts across ekarihub."
                                    />

                                    <RailLink
                                        href="/search?tab=Events"
                                        icon={<IoCalendarOutline size={14} />}
                                        title="Find events"
                                        description="Explore upcoming activities."
                                    />

                                    <RailLink
                                        href="/search?tab=Discussions"
                                        icon={<IoChatbubbleEllipsesOutline size={14} />}
                                        title="Find discussions"
                                        description="Join active conversations."
                                    />
                                </div>
                            </div>

                            <Link
                                href="/search"
                                className="group flex w-full items-center gap-3 rounded-[17px] bg-[#173C2E] p-4 text-white shadow-[0_10px_24px_rgba(23,60,46,0.12)] transition hover:bg-[#214C3A]"
                            >
                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-white/10 text-[#F39A22]">
                                    <IoSearch size={17} />
                                </span>

                                <span className="min-w-0 flex-1">
                                    <span className="block text-[9px] font-black">
                                        Search ekarihub
                                    </span>

                                    <span className="mt-1 block text-[8px] font-medium leading-4 text-white/45">
                                        Looking for something specific?
                                    </span>
                                </span>

                                <IoArrowForwardOutline
                                    size={14}
                                    className="shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5"
                                />
                            </Link>
                        </div>
                    </aside>
                </div>
            </div>
        </main>
    );

    if (isMobile) {
        return (
            <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#F8F7F2]">
                <PageGlowBg />

                <div className="sticky top-0 z-50">
                    <MobileTopBar
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        counts={counts}
                    />
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
                    {MainContent}
                </div>

                <div
                    style={{
                        height:
                            "env(safe-area-inset-bottom)",
                    }}
                />
            </div>
        );
    }

    return (
        <AppShell rightRail={null}>
            {MainContent}
        </AppShell>
    );
}

function RailLink({
    href,
    icon,
    title,
    description,
}: {
    href: string;
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        <Link
            href={href}
            className="group flex items-center gap-3 rounded-[12px] px-2.5 py-2.5 transition hover:bg-[#F3F1EB]"
        >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#E8ECE8] text-[#173C2E]">
                {icon}
            </span>

            <span className="min-w-0 flex-1">
                <span className="block text-[8px] font-black text-slate-700">
                    {title}
                </span>

                <span className="mt-0.5 block text-[7px] font-medium leading-3.5 text-slate-400">
                    {description}
                </span>
            </span>

            <IoChevronForwardOutline
                size={12}
                className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5"
            />
        </Link>
    );
}