"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    IoArrowBack,
    IoSearch,
    IoSparklesOutline,
    IoTimeOutline,
    IoTrendingUpOutline,
    IoPricetagOutline,
    IoChatbubblesOutline,
    IoChevronForwardOutline,
    IoClose,
} from "react-icons/io5";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, db } from "@/lib/firebase";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import { DeedStats } from "@/lib/fire-queries";
import Image from "next/image";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";

/* -------------------- Types -------------------- */

type TabKey = "Top" | "Deeds" | "Events" | "Discussions" | "Accounts" | "Tags";

const TABS: TabKey[] = ["Top", "Deeds", "Events", "Discussions", "Accounts", "Tags"];

type Deed = {
    id: string;
    mediaThumbUrl?: string;
    caption?: string;
    authorUsername?: string;
    authorId?: string;
    stats?: DeedStats;
    tagSlugs?: string[];
};

type EventItem = {
    id: string;
    title?: string;
    coverUrl?: string;
    dateISO?: string;
    location?: string;
    organizerName?: string;
    tags?: string[];
};

type DiscussionItem = {
    id: string;
    title?: string;
    excerpt?: string;
    repliesCount?: number;
    category?: string;
    tags?: string[];
};

type Account = {
    id: string;
    photoURL?: string;
    firstName?: string;
    surname?: string;
    handle: string; // stored WITH '@'
    followers?: number;
    storefrontEnabled?: boolean;
};

type Hashtag = {
    id: string;
    tag: string; // without '#'
    uses: number;
};

type TopItem =
    | { type: "deed"; deed: Deed }
    | { type: "event"; event: EventItem }
    | { type: "discussion"; discussion: DiscussionItem }
    | { type: "account"; account: Account }
    | { type: "tag"; tag: Hashtag };

type SearchResponse = {
    hasMore: boolean;
    top?: TopItem[];
    deeds?: Deed[];
    events?: EventItem[];
    discussions?: DiscussionItem[];
    accounts?: Account[];
    tags?: Hashtag[];
};

/* -------------------- EkariHub Theme -------------------- */

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    text: "#111827",
    dim: "#6B7280",
    line: "rgba(15,23,42,0.08)",
    chip: "rgba(15,23,42,0.06)",
    chipBorder: "rgba(15,23,42,0.12)",
    soft: "#E6F2EF",
};

type SearchBarProps = {
    variant: "desktop" | "mobile";
    q: string;
    setQ: (v: string) => void;
    onSubmit: (e?: React.FormEvent) => void;
    resetAll: () => void;
    EKARI: {
        forest: string;
        text: string;
        dim: string;
        line: string;
    };
};

export const SearchBar = React.memo(function SearchBar({
    variant,
    q,
    setQ,
    onSubmit,
    resetAll,
    EKARI,
}: SearchBarProps) {
    const big = variant === "desktop";

    return (
        <form
            onSubmit={onSubmit}
            className={cn(
                "flex flex-1 items-center gap-2 border bg-white shadow-[0_10px_40px_rgba(15,23,42,0.08)]",
                big ? "rounded-2xl px-3 py-2.5" : "rounded-full px-3 py-2"
            )}
            style={{ borderColor: EKARI.line }}
        >
            <div
                className={cn("grid place-items-center rounded-full", big ? "h-9 w-9" : "h-8 w-8")}
                style={{ background: "rgba(35,63,57,0.08)" }}
            >
                <IoSearch size={big ? 18 : 16} color={EKARI.forest} />
            </div>

            <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={big ? "Search deeds, events, discussions, accounts, tags…" : "Search…"}
                className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
            // (optional) prevent mobile zoom if you want
            // style={{ fontSize: 16 }}
            />

            {!!q && (
                <button
                    type="button"
                    onClick={resetAll}
                    className={cn(
                        "grid place-items-center rounded-full border hover:bg-black/[0.02]",
                        big ? "h-9 w-9" : "h-8 w-8"
                    )}
                    style={{ borderColor: EKARI.line, color: EKARI.dim, background: "white" }}
                    aria-label="Clear"
                    title="Clear"
                >
                    <IoClose size={16} />
                </button>
            )}

            {big && (
                <button
                    type="submit"
                    className="rounded-xl px-4 py-2 text-xs font-black text-white"
                    style={{ backgroundColor: EKARI.forest }}
                >
                    Search
                </button>
            )}
        </form>
    );
});

const PLACEHOLDER_DEED_THUMB =
    "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800&auto=format&fit=crop";
const PLACEHOLDER_EVENT_THUMB =
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=800&auto=format&fit=crop";
const PLACEHOLDER_AVATAR = "/avatar-placeholder.png";

const TRENDING_DEFAULT = [
    "maize spacing",
    "avocado export",
    "dairy feed ratios",
    "tomato diseases",
    "poultry housing",
];

const RECENTS_KEY = "ekari.search.recents";

/* ---------------------------- Responsive helpers ---------------------------- */
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

/* -------------------- Cloud Function -------------------- */

const functions = getFunctions(app, "us-central1");
const searchFn = httpsCallable(functions, "searchEkarihub");

async function fetchSearchEkarihub(q: string, tab: TabKey, page: number): Promise<SearchResponse> {
    const res: any = await searchFn({ q, tab, page });
    const data = (res && res.data) || {};
    return {
        hasMore: !!data.hasMore,
        top: (data.top || []) as TopItem[],
        deeds: (data.deeds || []) as Deed[],
        events: (data.events || []) as EventItem[],
        discussions: (data.discussions || []) as DiscussionItem[],
        accounts: (data.accounts || []) as Account[],
        tags: (data.tags || []) as Hashtag[],
    };
}

/* -------------------- Query normalizer -------------------- */
function normalizeQueryForBackend(query: string, tab: TabKey): string {
    const trimmed = query.trim();
    if (!trimmed) return "";

    if (trimmed.startsWith("@")) return trimmed.replace(/^@+/, "");
    if (trimmed.startsWith("#")) return trimmed.replace(/^#+/, "");
    if (tab === "Accounts") return trimmed.replace(/^@+/, "");
    if (tab === "Tags") return trimmed.replace(/^#+/, "");
    return trimmed;
}

/* -------------------- UI helpers -------------------- */
const cn = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");

function fmtCompact(n: number) {
    const x = Number(n || 0);
    if (x >= 1_000_000) return (x / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (x >= 1_000) return (x / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(x);
}

function GlassPill({
    active,
    children,
    onClick,
}: {
    active?: boolean;
    children: React.ReactNode;
    onClick?: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "h-9 px-3 rounded-full border text-xs font-black inline-flex items-center gap-2 transition",
                active ? "shadow-sm" : "hover:bg-black/[0.02]"
            )}
            style={{
                borderColor: active ? `${EKARI.forest}55` : EKARI.line,
                background: active ? "rgba(35,63,57,0.10)" : "white",
                color: active ? EKARI.forest : EKARI.text,
            }}
        >
            {children}
        </button>
    );
}

function Chip({
    icon,
    label,
    onClick,
}: {
    icon?: React.ReactNode;
    label: string;
    onClick?: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black hover:bg-black/[0.02]"
            style={{ backgroundColor: EKARI.chip, borderColor: EKARI.chipBorder, color: EKARI.text }}
            type="button"
        >
            {icon}
            <span className="truncate max-w-[240px]">{label}</span>
        </button>
    );
}

function CardShell({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="rounded-3xl border bg-white shadow-[0_10px_40px_rgba(15,23,42,0.06)] overflow-hidden"
            style={{ borderColor: EKARI.line }}
        >
            {children}
        </div>
    );
}

/* -------------------- Page Component -------------------- */

export default function SearchPageClient() {
    const router = useRouter();
    const isDesktop = useIsDesktop();
    const isMobile = useIsMobile();

    const goBack = React.useCallback(() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push("/");
    }, [router]);

    const [q, setQ] = useState("");
    const [lastQuery, setLastQuery] = useState("");
    const [active, setActive] = useState<TabKey>("Top");

    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);

    const [topData, setTopData] = useState<TopItem[]>([]);
    const [deedData, setDeedData] = useState<Deed[]>([]);
    const [eventData, setEventData] = useState<EventItem[]>([]);
    const [discData, setDiscData] = useState<DiscussionItem[]>([]);
    const [accData, setAccData] = useState<Account[]>([]);
    const [tagData, setTagData] = useState<Hashtag[]>([]);

    const [recents, setRecents] = useState<string[]>([]);
    const [trending, setTrending] = useState<string[]>(TRENDING_DEFAULT);

    useEffect(() => {
        let cancelled = false;
        async function loadTrendingFromHashtags() {
            try {
                const ref = collection(db, "hashtags");
                const qy = query(ref, orderBy("uses", "desc"), limit(20));
                const snap = await getDocs(qy);
                if (cancelled) return;

                if (!snap.empty) {
                    const labels = snap.docs
                        .map((doc) => {
                            const data = doc.data() as any;
                            return data?.tag as string | undefined;
                        })
                        .filter((v): v is string => !!v);

                    if (labels.length > 0) {
                        setTrending(labels.slice(0, 10));
                        return;
                    }
                }
                setTrending(TRENDING_DEFAULT);
            } catch (err) {
                console.warn("Failed to load trending hashtags", err);
                setTrending(TRENDING_DEFAULT);
            }
        }
        loadTrendingFromHashtags();
        return () => {
            cancelled = true;
        };
    }, []);

    // When we're on Deeds tab and query is a tag, treat this as a "tag hub"
    const isTagFeed = q.trim().startsWith("#") && active === "Deeds";

    // Autosuggest
    const [handleSuggestions, setHandleSuggestions] = useState<Account[]>([]);
    const [handleSuggestLoading, setHandleSuggestLoading] = useState(false);

    const [tagSuggestions, setTagSuggestions] = useState<Hashtag[]>([]);
    const [tagSuggestLoading, setTagSuggestLoading] = useState(false);

    /* --------- Recents from localStorage --------- */
    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(RECENTS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) setRecents(parsed);
            }
        } catch {
            // ignore
        }
    }, []);

    const saveRecent = useCallback(
        (val: string) => {
            if (!val) return;
            const next = [val, ...recents.filter((r) => r !== val)].slice(0, 12);
            setRecents(next);
            try {
                window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
            } catch {
                // ignore
            }
        },
        [recents]
    );

    const clearRecents = useCallback(() => {
        setRecents([]);
        try {
            window.localStorage.removeItem(RECENTS_KEY);
        } catch {
            // ignore
        }
    }, []);

    /* --------- Autosuggest for @handles --------- */
    useEffect(() => {
        const trimmed = q.trim();
        if (!trimmed || !trimmed.startsWith("@")) {
            setHandleSuggestions([]);
            setHandleSuggestLoading(false);
            return;
        }

        const backendQ = normalizeQueryForBackend(trimmed, "Accounts");
        if (!backendQ || backendQ.length < 2) {
            setHandleSuggestions([]);
            setHandleSuggestLoading(false);
            return;
        }

        let cancelled = false;
        setHandleSuggestLoading(true);

        const id = setTimeout(async () => {
            try {
                const res = await fetchSearchEkarihub(backendQ, "Accounts", 0);
                if (cancelled) return;
                setHandleSuggestions((res.accounts || []).slice(0, 6));
            } catch {
                if (!cancelled) setHandleSuggestions([]);
            } finally {
                if (!cancelled) setHandleSuggestLoading(false);
            }
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(id);
        };
    }, [q]);

    const onSelectHandleSuggestion = useCallback(
        (acc: Account) => {
            const handleLabel = acc.handle.startsWith("@") ? acc.handle : `@${acc.handle}`;
            setQ(handleLabel);
            setHandleSuggestions([]);
            router.push(`/${acc.handle}`);
        },
        [router]
    );

    /* --------- Autosuggest for #tags --------- */
    useEffect(() => {
        const trimmed = q.trim();
        const startsWithHash = trimmed.startsWith("#");
        const isTagContext = active === "Tags" || startsWithHash;

        if (!trimmed || !isTagContext) {
            setTagSuggestions([]);
            setTagSuggestLoading(false);
            return;
        }

        const backendQ = normalizeQueryForBackend(trimmed, "Tags");
        if (!backendQ || backendQ.length < 2) {
            setTagSuggestions([]);
            setTagSuggestLoading(false);
            return;
        }

        let cancelled = false;
        setTagSuggestLoading(true);

        const id = setTimeout(async () => {
            try {
                const res = await fetchSearchEkarihub(backendQ, "Tags", 0);
                if (cancelled) return;
                setTagSuggestions((res.tags || []).slice(0, 8));
            } catch {
                if (!cancelled) setTagSuggestions([]);
            } finally {
                if (!cancelled) setTagSuggestLoading(false);
            }
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(id);
        };
    }, [q, active]);

    /* --------- Search logic --------- */
    const startSearch = useCallback(
        async (queryStr: string, tab: TabKey, reset = false) => {
            const displayQuery = queryStr.trim();
            const backendQuery = normalizeQueryForBackend(queryStr, tab);

            if (!displayQuery || !backendQuery) {
                setTopData([]);
                setDeedData([]);
                setEventData([]);
                setDiscData([]);
                setAccData([]);
                setTagData([]);
                setHasMore(false);
                setPage(0);
                setLastQuery("");
                return;
            }

            try {
                setLoading(true);

                const nextPage = reset ? 0 : page + 1;
                if (reset) {
                    setPage(0);
                    setLastQuery(displayQuery);
                }

                const res = await fetchSearchEkarihub(backendQuery, tab, nextPage);

                setHasMore(!!res.hasMore);
                if (!reset) setPage(nextPage);

                const merge = <T,>(prev: T[], incoming?: T[], override?: boolean) =>
                    override ? incoming || [] : [...prev, ...(incoming || [])];

                if (tab === "Top") {
                    setTopData(merge(topData, res.top, reset));

                    if (reset) {
                        if (res.deeds) setDeedData(res.deeds);
                        if (res.events) setEventData(res.events);
                        if (res.discussions) setDiscData(res.discussions);
                        if (res.accounts) setAccData(res.accounts);
                        if (res.tags) setTagData(res.tags);
                    }
                }

                if (tab === "Deeds") setDeedData(merge(deedData, res.deeds, reset));
                if (tab === "Events") setEventData(merge(eventData, res.events, reset));
                if (tab === "Discussions") setDiscData(merge(discData, res.discussions, reset));
                if (tab === "Accounts") setAccData(merge(accData, res.accounts, reset));
                if (tab === "Tags") setTagData(merge(tagData, res.tags, reset));

                if (reset) saveRecent(displayQuery);
            } catch (e) {
                console.warn("Search error", e);
                if (typeof window !== "undefined") {
                    window.alert("Search error. Please check your connection and try again.");
                }
            } finally {
                setLoading(false);
            }
        },
        [page, topData, deedData, eventData, discData, accData, tagData, saveRecent]
    );

    const onSelectTagSuggestion = useCallback(
        (tag: Hashtag) => {
            const label = `#${tag.tag}`;

            setQ(label);
            setTagSuggestions([]);
            setActive("Deeds");
            setPage(0);

            startSearch(label, "Deeds", true);
            router.push(`/search?tag=${encodeURIComponent(tag.tag)}&tab=Deeds`);
        },
        [router, startSearch]
    );

    const onSubmit = useCallback(
        (e?: React.FormEvent) => {
            e?.preventDefault();
            const trimmed = q.trim();
            if (!trimmed) return;

            let targetTab: TabKey = active;
            if (trimmed.startsWith("@")) targetTab = "Accounts";
            else if (trimmed.startsWith("#")) targetTab = "Tags";

            if (targetTab !== active) setActive(targetTab);
            startSearch(trimmed, targetTab, true);
        },
        [q, active, startSearch]
    );

    const onTapRecent = useCallback(
        (term: string) => {
            setQ(term);
            startSearch(term, active, true);
        },
        [active, startSearch]
    );

    const onTapTrending = useCallback(
        (term: string) => {
            setQ(term);
            startSearch(term, active, true);
        },
        [active, startSearch]
    );

    const loadMore = useCallback(() => {
        if (!loading && hasMore && q.trim()) startSearch(q, active, false);
    }, [loading, hasMore, q, active, startSearch]);

    const goAI = useCallback(() => {
        router.push("/ai");
    }, [router]);

    const showDefault = !q.trim();

    const showHandleSuggestions =
        !showDefault && q.trim().startsWith("@") && (handleSuggestions.length > 0 || handleSuggestLoading);

    const showTagSuggestions =
        !showDefault && (q.trim().startsWith("#") || active === "Tags") && (tagSuggestions.length > 0 || tagSuggestLoading);

    const sp = useSearchParams();
    const [bootstrappedFromURL, setBootstrappedFromURL] = useState(false);

    useEffect(() => {
        if (!sp || bootstrappedFromURL) return;

        const qParam = sp.get("q");
        const tagParam = sp.get("tag");
        const tabParam = sp.get("tab") as TabKey | null;

        let incomingQuery = "";
        let incomingTab: TabKey = "Top";

        if (tagParam) {
            incomingQuery = `#${tagParam}`;
            if (tabParam && TABS.includes(tabParam)) incomingTab = tabParam;
            else incomingTab = "Deeds";
        } else if (qParam) {
            incomingQuery = qParam.trim();
            if (incomingQuery.startsWith("@")) incomingTab = "Accounts";
            else if (incomingQuery.startsWith("#")) incomingTab = "Tags";
            else if (tabParam && TABS.includes(tabParam)) incomingTab = tabParam;
            else incomingTab = "Top";
        }

        if (!incomingQuery) {
            setBootstrappedFromURL(true);
            return;
        }

        setQ(incomingQuery);
        setActive(incomingTab);
        setBootstrappedFromURL(true);

        startSearch(incomingQuery, incomingTab, true);
    }, [sp, bootstrappedFromURL, startSearch]);

    /* --------- Render helpers --------- */
    const handleDeedClick = (d: Deed) => {
        const handle = d.authorUsername || d.authorId || "deed";
        router.push(`/${encodeURIComponent(handle)}/deed/${d.id}`);
    };

    const handleEventClick = (id: string) => router.push(`/events/${id}`);
    const handleDiscussionClick = (id: string) => router.push(`/discussions/${id}`);
    const handleAccountClick = (handle: string) => router.push(`/${handle}`);

    const handleTagClick = (tag: string) => {
        const label = `#${tag}`;
        setQ(label);
        setActive("Deeds");
        setPage(0);
        startSearch(label, "Deeds", true);
        router.push(`/search?tag=${encodeURIComponent(tag)}&tab=Deeds`);
    };

    const listData = useMemo(() => {
        switch (active) {
            case "Top":
                return topData;
            case "Deeds":
                return deedData;
            case "Events":
                return eventData;
            case "Discussions":
                return discData;
            case "Accounts":
                return accData;
            case "Tags":
                return tagData;
        }
    }, [active, topData, deedData, eventData, discData, accData, tagData]);

    const currentCount = listData?.length ?? 0;

    /* -------------------- Premium Row Components -------------------- */

    function StatMini({ label, value }: { label: string; value: string }) {
        return (
            <span
                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-black"
                style={{ borderColor: EKARI.line, color: EKARI.text, background: "white" }}
            >
                <span style={{ color: EKARI.dim }} className="font-semibold">
                    {label}
                </span>
                <span>{value}</span>
            </span>
        );
    }

    function RowButton({
        children,
        onClick,
        right,
        compact,
    }: {
        children: React.ReactNode;
        onClick?: () => void;
        right?: React.ReactNode;
        compact?: boolean;
    }) {
        return (
            <div className="group">
                <button
                    onClick={onClick}
                    className={cn(
                        "w-full text-left px-4",
                        compact ? "py-3" : "py-4",
                        "transition hover:bg-black/[0.02] focus:outline-none"
                    )}
                    type="button"
                >
                    <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">{children}</div>
                        <div className="shrink-0 flex items-center gap-2">
                            {right}
                            <span
                                className="h-8 w-8 rounded-full border grid place-items-center opacity-60 group-hover:opacity-100 transition"
                                style={{ borderColor: EKARI.line, color: EKARI.dim, background: "white" }}
                                aria-hidden
                            >
                                <IoChevronForwardOutline size={16} />
                            </span>
                        </div>
                    </div>
                </button>
            </div>
        );
    }

    const renderTopItem = (item: TopItem, idx: number) => {
        switch (item.type) {
            case "deed": {
                const d = item.deed;
                return (
                    <RowButton key={`top_deed_${idx}_${d.id}`} onClick={() => handleDeedClick(d)} compact>
                        <div className="flex items-center gap-3">
                            <div className="relative h-[62px] w-[110px] rounded-xl overflow-hidden bg-gray-100 border" style={{ borderColor: EKARI.line }}>
                                <img
                                    src={d.mediaThumbUrl || PLACEHOLDER_DEED_THUMB}
                                    alt={d.caption || "deed"}
                                    className="h-full w-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className="line-clamp-2 text-sm font-black" style={{ color: EKARI.text }}>
                                    {d.caption || ""}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-semibold" style={{ color: EKARI.dim }}>
                                        by {d.authorUsername || "ekarihub user"}
                                    </span>
                                    <StatMini label="Likes" value={fmtCompact(d.stats?.likes ?? 0)} />
                                    <StatMini label="Views" value={fmtCompact(d.stats?.views ?? 0)} />
                                </div>
                            </div>
                        </div>
                    </RowButton>
                );
            }
            case "event": {
                const e = item.event;
                return (
                    <RowButton key={`top_event_${idx}_${e.id}`} onClick={() => handleEventClick(e.id)} compact>
                        <div className="flex items-center gap-3">
                            <div className="relative h-14 w-20 rounded-xl overflow-hidden bg-gray-100 border" style={{ borderColor: EKARI.line }}>
                                <img
                                    src={e.coverUrl || PLACEHOLDER_EVENT_THUMB}
                                    alt={e.title || "event"}
                                    className="h-full w-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="line-clamp-2 text-sm font-black" style={{ color: EKARI.text }}>
                                    {e.title || ""}
                                </p>
                                <p className="mt-1 text-xs font-semibold" style={{ color: EKARI.dim }}>
                                    {e.dateISO
                                        ? new Date(e.dateISO).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                                        : ""}
                                    {e.location ? ` · ${e.location}` : ""}
                                </p>
                            </div>
                        </div>
                    </RowButton>
                );
            }
            case "discussion": {
                const d = item.discussion;
                return (
                    <RowButton key={`top_disc_${idx}_${d.id}`} onClick={() => handleDiscussionClick(d.id)} compact>
                        <div className="flex items-center gap-3">
                            <div
                                className="flex h-11 w-11 items-center justify-center rounded-2xl border"
                                style={{ backgroundColor: "rgba(35,63,57,0.08)", borderColor: EKARI.line }}
                            >
                                <IoChatbubblesOutline size={18} color={EKARI.forest} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="line-clamp-2 text-sm font-black" style={{ color: EKARI.text }}>
                                    {d.title || ""}
                                </p>
                                <p className="mt-1 text-xs font-semibold" style={{ color: EKARI.dim }}>
                                    {fmtCompact(d.repliesCount ?? 0)} replies{d.category ? ` · ${d.category}` : ""}
                                </p>
                            </div>
                        </div>
                    </RowButton>
                );
            }
            case "account": {
                const a = item.account;
                const handleLabel = a.handle.startsWith("@") ? a.handle : `@${a.handle}`;
                return (
                    <div key={`top_acc_wrap_${idx}_${a.id}`} className="px-4 py-3">
                        <div
                            className="rounded-2xl border bg-white shadow-[0_8px_28px_rgba(15,23,42,0.06)]"
                            style={{ borderColor: EKARI.line }}
                        >
                            <div className="px-3 py-3 flex items-center gap-3">
                                <button
                                    onClick={() => handleAccountClick(a.handle)}
                                    className="flex flex-1 items-center gap-3 text-left"
                                    type="button"
                                >
                                    <div className="relative h-11 w-11 rounded-full overflow-hidden border bg-gray-100" style={{ borderColor: EKARI.line }}>
                                        <Image
                                            src={a.photoURL || PLACEHOLDER_AVATAR}
                                            alt={a.firstName || "User"}
                                            width={120}
                                            height={120}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-black truncate" style={{ color: EKARI.text }}>
                                                {(a.firstName || "").trim()} {(a.surname || "").trim()}
                                            </p>
                                            {a.storefrontEnabled && (
                                                <span
                                                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-black border"
                                                    style={{
                                                        borderColor: `${EKARI.gold}55`,
                                                        color: EKARI.gold,
                                                        background: "rgba(199,146,87,0.10)",
                                                    }}
                                                >
                                                    Storefront
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-0.5 text-xs font-semibold truncate" style={{ color: EKARI.dim }}>
                                            {handleLabel}
                                            {typeof a.followers === "number" ? ` · ${fmtCompact(a.followers)} followers` : ""}
                                        </p>
                                    </div>
                                </button>

                                {a.storefrontEnabled && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            router.push(`/store/${encodeURIComponent(a.id)}?src=search`);
                                        }}
                                        className="shrink-0 h-10 px-4 rounded-xl font-black border hover:bg-black/[0.02]"
                                        style={{ borderColor: EKARI.line, color: EKARI.forest, background: "white" }}
                                    >
                                        Visit Store
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            }
            case "tag": {
                const t = item.tag;
                return (
                    <RowButton key={`top_tag_${idx}_${t.id}`} onClick={() => handleTagClick(t.tag)} compact>
                        <div className="flex items-center gap-3">
                            <div
                                className="h-11 w-11 rounded-2xl border grid place-items-center"
                                style={{ borderColor: EKARI.line, background: "rgba(199,146,87,0.10)" }}
                            >
                                <IoPricetagOutline size={18} color={EKARI.gold} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-black" style={{ color: EKARI.text }}>
                                    #{t.tag}
                                </p>
                                <p className="mt-0.5 text-xs font-semibold" style={{ color: EKARI.dim }}>
                                    {t.uses.toLocaleString()} uses
                                </p>
                            </div>
                        </div>
                    </RowButton>
                );
            }
        }
    };

    /* ------------------------------ UI (Body) ------------------------------ */

    const resetAll = () => {
        setQ("");
        setLastQuery("");
        setTopData([]);
        setDeedData([]);
        setEventData([]);
        setDiscData([]);
        setAccData([]);
        setTagData([]);
        setHasMore(false);
        setPage(0);
        setHandleSuggestions([]);
        setTagSuggestions([]);
    };


    const SuggestionsDropdown = ({ variant }: { variant: "desktop" | "mobile" }) => {
        const show = showHandleSuggestions || showTagSuggestions;
        if (!show) return null;

        return (
            <div className={cn(variant === "desktop" ? "mt-3" : "pb-2")}>
                <div
                    className="w-full rounded-3xl border bg-white shadow-[0_18px_60px_rgba(15,23,42,0.12)] overflow-hidden"
                    style={{ borderColor: EKARI.line }}
                >
                    {showHandleSuggestions && (
                        <>
                            <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                                <div
                                    className="h-8 w-8 rounded-2xl grid place-items-center border"
                                    style={{ borderColor: EKARI.line, background: "rgba(35,63,57,0.08)" }}
                                >
                                    <IoSearch size={16} color={EKARI.forest} />
                                </div>
                                <div className="text-xs font-black" style={{ color: EKARI.text }}>
                                    Accounts
                                </div>
                                {handleSuggestLoading && (
                                    <div className="ml-auto text-[11px] font-semibold" style={{ color: EKARI.dim }}>
                                        Searching…
                                    </div>
                                )}
                            </div>

                            <div className="pb-2">
                                {handleSuggestions.map((a) => {
                                    const handleLabel = a.handle.startsWith("@") ? a.handle : `@${a.handle}`;
                                    return (
                                        <button
                                            key={a.id}
                                            type="button"
                                            onClick={() => onSelectHandleSuggestion(a)}
                                            className="w-full px-4 py-2 hover:bg-black/[0.02] text-left"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="relative h-9 w-9 rounded-full overflow-hidden border bg-gray-100" style={{ borderColor: EKARI.line }}>
                                                    <Image
                                                        src={a.photoURL || PLACEHOLDER_AVATAR}
                                                        alt={a.firstName || "User"}
                                                        width={100}
                                                        height={100}
                                                        className="h-full w-full object-cover"
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-xs font-black truncate" style={{ color: EKARI.text }}>
                                                        {(a.firstName || "").trim()} {(a.surname || "").trim()}
                                                    </div>
                                                    <div className="text-[11px] font-semibold truncate" style={{ color: EKARI.dim }}>
                                                        {handleLabel}
                                                    </div>
                                                </div>
                                                {a.storefrontEnabled && (
                                                    <span
                                                        className="shrink-0 inline-flex items-center rounded-full px-2 py-1 text-[11px] font-black border"
                                                        style={{ borderColor: `${EKARI.gold}55`, color: EKARI.gold, background: "rgba(199,146,87,0.10)" }}
                                                    >
                                                        Storefront
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}

                                {!handleSuggestLoading && handleSuggestions.length === 0 && (
                                    <div className="px-4 py-3 text-xs font-semibold" style={{ color: EKARI.dim }}>
                                        No matching accounts yet.
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {showTagSuggestions && (
                        <>
                            <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                                <div
                                    className="h-8 w-8 rounded-2xl grid place-items-center border"
                                    style={{ borderColor: EKARI.line, background: "rgba(199,146,87,0.10)" }}
                                >
                                    <IoPricetagOutline size={16} color={EKARI.gold} />
                                </div>
                                <div className="text-xs font-black" style={{ color: EKARI.text }}>
                                    Tags
                                </div>
                                {tagSuggestLoading && (
                                    <div className="ml-auto text-[11px] font-semibold" style={{ color: EKARI.dim }}>
                                        Searching…
                                    </div>
                                )}
                            </div>

                            <div className="pb-2">
                                {tagSuggestions.map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => onSelectTagSuggestion(t)}
                                        className="w-full px-4 py-2 hover:bg-black/[0.02] text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="h-9 w-9 rounded-2xl border grid place-items-center"
                                                style={{ borderColor: EKARI.line, background: "rgba(199,146,87,0.10)" }}
                                            >
                                                <IoPricetagOutline size={16} color={EKARI.gold} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs font-black" style={{ color: EKARI.text }}>
                                                    #{t.tag}
                                                </div>
                                                <div className="text-[11px] font-semibold" style={{ color: EKARI.dim }}>
                                                    {t.uses.toLocaleString()} uses
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}

                                {!tagSuggestLoading && tagSuggestions.length === 0 && (
                                    <div className="px-4 py-3 text-xs font-semibold" style={{ color: EKARI.dim }}>
                                        No matching tags yet.
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    const TabsRow = ({ variant }: { variant: "desktop" | "mobile" }) => {
        const wrap = variant === "desktop" ? "mt-3" : "pb-2";
        return (
            <div className={cn("w-full overflow-x-auto no-scrollbar", wrap)}>
                <div className="flex gap-2">
                    {TABS.map((t) => {
                        const isActiveTab = t === active;
                        return (
                            <GlassPill
                                key={t}
                                active={isActiveTab}
                                onClick={() => {
                                    setActive(t);
                                    setPage(0);
                                    if (q.trim()) startSearch(q, t, true);
                                }}
                            >
                                {t}
                            </GlassPill>
                        );
                    })}
                </div>
            </div>
        );
    };

    const PremiumHeaderDesktop = (
        <header className="sticky top-0 z-30">
            <div
                className="border-b bg-white/80 backdrop-blur"
                style={{
                    borderColor: EKARI.line,
                    backgroundImage:
                        "radial-gradient(600px 240px at 12% 0%, rgba(35,63,57,0.10), transparent 60%), radial-gradient(520px 220px at 90% 0%, rgba(199,146,87,0.12), transparent 55%)",
                }}
            >
                <div className="mx-auto max-w-4xl px-4 py-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={goBack}
                            className="h-11 w-11 rounded-2xl border bg-white hover:bg-black/[0.02] grid place-items-center"
                            style={{ borderColor: EKARI.line }}
                            aria-label="Back"
                            title="Back"
                        >
                            <IoArrowBack size={18} color={EKARI.text} />
                        </button>

                        <div className="flex-1">
                            <div className="text-[13px] font-black" style={{ color: EKARI.text }}>
                                Search ekarihub
                            </div>
                            <div className="text-[11px] font-semibold" style={{ color: EKARI.dim }}>
                                Deeds · Events · Discussions · Accounts · Tags
                            </div>
                        </div>

                        <button
                            onClick={goAI}
                            className="h-11 w-11 rounded-2xl border grid place-items-center"
                            style={{ borderColor: EKARI.line, backgroundColor: "rgba(35,63,57,0.08)" }}
                            aria-label="Ask Ekari AI"
                            title="Ask Ekari AI"
                        >
                            <IoSparklesOutline size={18} color={EKARI.forest} />
                        </button>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                        <SearchBar
                            variant="desktop"
                            q={q}
                            setQ={setQ}
                            onSubmit={onSubmit}
                            resetAll={resetAll}
                            EKARI={EKARI}
                        />

                    </div>

                    <SuggestionsDropdown variant="desktop" />
                    <TabsRow variant="desktop" />
                </div>
            </div>
        </header>
    );

    const ResultsHeaderLine = () => {
        if (showDefault) return null;

        return (
            <div className="px-1">
                {isTagFeed ? (
                    <div className="flex items-center justify-between text-xs" style={{ color: EKARI.dim }}>
                        <div>
                            <span>Deeds tagged </span>
                            <span className="font-black" style={{ color: EKARI.text }}>
                                {q.trim()}
                            </span>
                        </div>
                        {currentCount > 0 && (
                            <span className="font-semibold">
                                {currentCount.toLocaleString()} deed{currentCount > 1 ? "s" : ""}
                            </span>
                        )}
                    </div>
                ) : lastQuery ? (
                    <div className="flex items-center justify-between text-xs" style={{ color: EKARI.dim }}>
                        <div className="min-w-0">
                            <span>Results for </span>
                            <span className="font-black" style={{ color: EKARI.text }}>
                                “{lastQuery}”
                            </span>
                            <span>{` · ${active}`}</span>
                        </div>
                        {currentCount > 0 && (
                            <span className="font-semibold">
                                {currentCount.toLocaleString()} result{currentCount > 1 ? "s" : ""}
                            </span>
                        )}
                    </div>
                ) : null}
            </div>
        );
    };

    const DefaultState = () => (
        <div className="space-y-6">
            <div
                className="rounded-3xl border p-5"
                style={{
                    borderColor: "rgba(199,146,87,0.25)",
                    background:
                        "linear-gradient(180deg, rgba(199,146,87,0.10), rgba(35,63,57,0.06))",
                }}
            >
                <div className="flex items-start gap-3">
                    <div
                        className="h-11 w-11 rounded-2xl border grid place-items-center"
                        style={{ borderColor: EKARI.line, background: "rgba(35,63,57,0.08)" }}
                    >
                        <IoSearch size={18} color={EKARI.forest} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-black" style={{ color: EKARI.text }}>
                            Search ekarihub
                        </p>
                        <p className="mt-1 text-[12px] leading-5 font-semibold" style={{ color: EKARI.dim }}>
                            Find deeds, events, discussions, people, and tags across the agribusiness community.
                            Try <span className="font-black">@handle</span> or <span className="font-black">#farmer</span>.
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                            <Chip icon={<IoSparklesOutline size={14} color={EKARI.forest} />} label="Ask Ekari AI" onClick={goAI} />
                            <Chip icon={<IoTrendingUpOutline size={14} color={EKARI.gold} />} label="Try trending" onClick={() => { }} />
                        </div>
                    </div>
                </div>
            </div>

            <CardShell>
                <div className="px-5 pt-5 pb-4 flex items-center">
                    <div>
                        <div className="text-sm font-black" style={{ color: EKARI.text }}>
                            Recent
                        </div>
                        <div className="text-[11px] font-semibold" style={{ color: EKARI.dim }}>
                            Your latest searches
                        </div>
                    </div>
                    <div className="ml-auto">
                        {recents.length > 0 && (
                            <button onClick={clearRecents} className="text-xs font-black hover:underline" style={{ color: EKARI.dim }}>
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                <div className="px-5 pb-5">
                    {recents.length === 0 ? (
                        <p className="text-xs font-semibold" style={{ color: EKARI.dim }}>
                            No recent searches yet.
                        </p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {recents.map((r) => (
                                <Chip
                                    key={r}
                                    icon={<IoTimeOutline size={14} color={EKARI.dim} />}
                                    label={r}
                                    onClick={() => onTapRecent(r)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </CardShell>

            <CardShell>
                <div className="px-5 pt-5 pb-4">
                    <div className="text-sm font-black" style={{ color: EKARI.text }}>
                        Trending
                    </div>
                    <div className="text-[11px] font-semibold" style={{ color: EKARI.dim }}>
                        Popular topics right now
                    </div>
                </div>

                <div className="px-5 pb-5">
                    <div className="flex flex-wrap gap-2">
                        {trending.map((t) => (
                            <Chip
                                key={t}
                                icon={<IoTrendingUpOutline size={14} color={EKARI.gold} />}
                                label={t}
                                onClick={() => onTapTrending(t)}
                            />
                        ))}
                    </div>
                </div>
            </CardShell>
        </div>
    );

    const ResultsList = () => (
        <div className="space-y-3">
            <ResultsHeaderLine />

            <CardShell>
                <div className="divide-y" style={{ borderColor: EKARI.line }}>
                    {(!listData || listData.length === 0) && !loading && (
                        <div className="px-6 py-12 text-center">
                            <div
                                className="mx-auto h-12 w-12 rounded-2xl border grid place-items-center"
                                style={{ borderColor: EKARI.line, background: "rgba(15,23,42,0.02)" }}
                            >
                                <IoSearch size={20} color={EKARI.dim} />
                            </div>
                            <div className="mt-3 text-sm font-black" style={{ color: EKARI.text }}>
                                No results found
                            </div>
                            <div className="mt-1 text-xs font-semibold" style={{ color: EKARI.dim }}>
                                Try a different keyword or broaden your search.
                            </div>
                        </div>
                    )}

                    {active === "Top" &&
                        topData.map((item, idx) => (
                            <div key={idx} className="first:pt-2 last:pb-2">
                                {renderTopItem(item, idx)}
                            </div>
                        ))}

                    {active === "Deeds" &&
                        deedData.map((d) => (
                            <RowButton key={d.id} onClick={() => handleDeedClick(d)} compact>
                                <div className="flex items-center gap-3">
                                    <div className="relative h-[62px] w-[110px] rounded-xl overflow-hidden bg-gray-100 border" style={{ borderColor: EKARI.line }}>
                                        <img
                                            src={d.mediaThumbUrl || PLACEHOLDER_DEED_THUMB}
                                            alt={d.caption || "deed"}
                                            className="h-full w-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="line-clamp-2 text-sm font-black" style={{ color: EKARI.text }}>
                                            {d.caption || ""}
                                        </p>
                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                            <span className="text-xs font-semibold" style={{ color: EKARI.dim }}>
                                                by {d.authorUsername || "ekarihub user"}
                                            </span>
                                            <StatMini label="Likes" value={fmtCompact(d.stats?.likes ?? 0)} />
                                            <StatMini label="Views" value={fmtCompact(d.stats?.views ?? 0)} />
                                        </div>
                                    </div>
                                </div>
                            </RowButton>
                        ))}

                    {active === "Events" &&
                        eventData.map((e) => (
                            <RowButton key={e.id} onClick={() => handleEventClick(e.id)} compact>
                                <div className="flex items-center gap-3">
                                    <div className="relative h-14 w-20 rounded-xl overflow-hidden bg-gray-100 border" style={{ borderColor: EKARI.line }}>
                                        <img src={e.coverUrl || PLACEHOLDER_EVENT_THUMB} alt={e.title || "event"} className="h-full w-full object-cover" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="line-clamp-2 text-sm font-black" style={{ color: EKARI.text }}>
                                            {e.title || ""}
                                        </p>
                                        <p className="mt-1 text-xs font-semibold" style={{ color: EKARI.dim }}>
                                            {e.dateISO
                                                ? new Date(e.dateISO).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                                                : ""}
                                            {e.location ? ` · ${e.location}` : ""}
                                        </p>
                                    </div>
                                </div>
                            </RowButton>
                        ))}

                    {active === "Discussions" &&
                        discData.map((d) => (
                            <RowButton key={d.id} onClick={() => handleDiscussionClick(d.id)} compact>
                                <div className="flex items-center gap-3">
                                    <div
                                        className="flex h-11 w-11 items-center justify-center rounded-2xl border"
                                        style={{ backgroundColor: "rgba(35,63,57,0.08)", borderColor: EKARI.line }}
                                    >
                                        <IoChatbubblesOutline size={18} color={EKARI.forest} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="line-clamp-2 text-sm font-black" style={{ color: EKARI.text }}>
                                            {d.title || ""}
                                        </p>
                                        <p className="mt-1 text-xs font-semibold" style={{ color: EKARI.dim }}>
                                            {fmtCompact(d.repliesCount ?? 0)} replies{d.category ? ` · ${d.category}` : ""}
                                        </p>
                                    </div>
                                </div>
                            </RowButton>
                        ))}

                    {active === "Accounts" &&
                        accData.map((a) => {
                            const handleLabel = a.handle.startsWith("@") ? a.handle : `@${a.handle}`;
                            return (
                                <div key={a.id} className="px-4 py-3">
                                    <div
                                        className="rounded-2xl border bg-white shadow-[0_8px_28px_rgba(15,23,42,0.06)]"
                                        style={{ borderColor: EKARI.line }}
                                    >
                                        <div className="px-3 py-3 flex items-center gap-3">
                                            <button
                                                onClick={() => handleAccountClick(a.handle)}
                                                className="flex flex-1 items-center gap-3 text-left"
                                                type="button"
                                            >
                                                <div className="relative h-11 w-11 rounded-full overflow-hidden border bg-gray-100" style={{ borderColor: EKARI.line }}>
                                                    <Image
                                                        src={a.photoURL || PLACEHOLDER_AVATAR}
                                                        alt={a.firstName || "User"}
                                                        width={120}
                                                        height={120}
                                                        className="h-full w-full object-cover"
                                                    />
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-black truncate" style={{ color: EKARI.text }}>
                                                            {(a.firstName || "").trim()} {(a.surname || "").trim()}
                                                        </p>
                                                        {a.storefrontEnabled && (
                                                            <span
                                                                className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-black border"
                                                                style={{
                                                                    borderColor: `${EKARI.gold}55`,
                                                                    color: EKARI.gold,
                                                                    background: "rgba(199,146,87,0.10)",
                                                                }}
                                                            >
                                                                Storefront
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="mt-0.5 text-xs font-semibold truncate" style={{ color: EKARI.dim }}>
                                                        {handleLabel} · {fmtCompact(a.followers ?? 0)} followers
                                                    </p>
                                                </div>
                                            </button>

                                            {a.storefrontEnabled && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        router.push(`/store/${encodeURIComponent(a.id)}?src=search`);
                                                    }}
                                                    className="shrink-0 h-10 px-4 rounded-xl font-black border hover:bg-black/[0.02]"
                                                    style={{ borderColor: EKARI.line, color: EKARI.forest, background: "white" }}
                                                >
                                                    Visit Store
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                    {active === "Tags" &&
                        tagData.map((t) => (
                            <RowButton key={t.id} onClick={() => handleTagClick(t.tag)} compact>
                                <div className="flex items-center gap-3">
                                    <div
                                        className="h-11 w-11 rounded-2xl border grid place-items-center"
                                        style={{ borderColor: EKARI.line, background: "rgba(199,146,87,0.10)" }}
                                    >
                                        <IoPricetagOutline size={18} color={EKARI.gold} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-black" style={{ color: EKARI.text }}>
                                            #{t.tag}
                                        </p>
                                        <p className="mt-0.5 text-xs font-semibold" style={{ color: EKARI.dim }}>
                                            {t.uses.toLocaleString()} uses
                                        </p>
                                    </div>
                                </div>
                            </RowButton>
                        ))}
                </div>
            </CardShell>

            <div className="mt-5 flex justify-center">
                {loading ? (
                    <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: EKARI.dim }}>
                        <BouncingBallLoader />
                        <span>Searching…</span>
                    </div>
                ) : hasMore && listData && listData.length > 0 ? (
                    <button
                        onClick={loadMore}
                        className="h-11 px-5 rounded-2xl font-black border bg-white hover:bg-black/[0.02]"
                        style={{ borderColor: EKARI.line, color: EKARI.text }}
                    >
                        Load more results
                    </button>
                ) : null}
            </div>
        </div>
    );

    const Body = (
        <main
            className="min-h-screen w-full"
            style={{
                backgroundImage:
                    "radial-gradient(900px 380px at 12% 0%, rgba(35,63,57,0.07), transparent 60%), radial-gradient(760px 340px at 90% 0%, rgba(199,146,87,0.08), transparent 55%)",
            }}
        >
            {/* Desktop premium header */}
            {isDesktop && PremiumHeaderDesktop}

            <section className="w-full max-w-4xl mx-auto px-4 pb-10 pt-4">
                {showDefault ? <DefaultState /> : <ResultsList />}
                {isMobile && <div style={{ height: "env(safe-area-inset-bottom)" }} />}
            </section>
        </main>
    );

    // ✅ MOBILE: fixed inset + premium top bar + scroll area (no AppShell)
    if (isMobile) {
        return (
            <div className="fixed inset-0 flex flex-col bg-white">
                {/* Sticky top bar */}
                <div
                    className="sticky top-0 z-50 border-b bg-white/85 backdrop-blur"
                    style={{
                        borderColor: EKARI.line,
                        backgroundImage:
                            "radial-gradient(520px 220px at 10% 0%, rgba(35,63,57,0.10), transparent 60%), radial-gradient(520px 220px at 92% 0%, rgba(199,146,87,0.12), transparent 55%)",
                    }}
                >
                    <div className="px-3" style={{ paddingTop: "env(safe-area-inset-top)" }}>
                        <div className="h-14 flex items-center gap-2">
                            <button
                                onClick={goBack}
                                className="h-11 w-11 rounded-2xl border bg-white hover:bg-black/[0.02] grid place-items-center"
                                style={{ borderColor: EKARI.line }}
                                aria-label="Back"
                                title="Back"
                            >
                                <IoArrowBack size={18} color={EKARI.text} />
                            </button>

                            <SearchBar
                                variant="mobile"
                                q={q}
                                setQ={setQ}
                                onSubmit={onSubmit}
                                resetAll={resetAll}
                                EKARI={EKARI}
                            />

                            <button
                                onClick={goAI}
                                className="h-11 w-11 rounded-2xl border grid place-items-center"
                                style={{ borderColor: EKARI.line, backgroundColor: "rgba(35,63,57,0.08)" }}
                                aria-label="Ask Ekari AI"
                                title="Ask Ekari AI"
                            >
                                <IoSparklesOutline size={18} color={EKARI.forest} />
                            </button>
                        </div>

                        <SuggestionsDropdown variant="mobile" />
                        <TabsRow variant="mobile" />
                    </div>
                </div>

                {/* Scroll content */}
                <div className="flex-1 overflow-y-auto overscroll-contain">{Body}</div>
            </div>
        );
    }

    // ✅ DESKTOP: keep AppShell
    return <AppShell>{Body}</AppShell>;
}
