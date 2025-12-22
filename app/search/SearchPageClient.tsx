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

const TABS: TabKey[] = [
    "Top",
    "Deeds",
    "Events",
    "Discussions",
    "Accounts",
    "Tags",
];

type Deed = {
    id: string;
    mediaThumbUrl?: string;
    caption?: string;
    authorUsername?: string;
    authorId?: string;
    // authorHandle?: string; // 🔹 used for /[handle]/deed/[id]
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
    handle: string; // 🔹 stored WITH '@', e.g. "@mwangi"
    followers?: number;
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

const PLACEHOLDER_DEED_THUMB =
    "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800&auto=format&fit=crop";
const PLACEHOLDER_EVENT_THUMB =
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=800&auto=format&fit=crop";
const PLACEHOLDER_AVATAR =
    "/avatar-placeholder.png";

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

async function fetchSearchEkarihub(
    q: string,
    tab: TabKey,
    page: number
): Promise<SearchResponse> {
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

/**
 * Normalizes what we send to the backend:
 *  - "@mwangi" -> "mwangi"
 *  - "mwangi" stays "mwangi"
 *  - "#farmer" -> "farmer"
 *  - "farmer" stays "farmer"
 *
 * This way both "@handle" / "handle" and "#tag" / "tag" work the same.
 * Display still keeps the original (with @ / #).
 */
function normalizeQueryForBackend(query: string, tab: TabKey): string {
    const trimmed = query.trim();
    if (!trimmed) return "";

    if (trimmed.startsWith("@")) {
        // handle search; backend can then match handleLower / handle
        return trimmed.replace(/^@+/, "");
    }

    if (trimmed.startsWith("#")) {
        // hashtag search
        return trimmed.replace(/^#+/, "");
    }

    if (tab === "Accounts") {
        // user typed "mwangi" on Accounts tab – treat like handle search
        return trimmed.replace(/^@+/, "");
    }

    if (tab === "Tags") {
        // user typed "farmer" on Tags tab – treat like hashtag search
        return trimmed.replace(/^#+/, "");
    }

    return trimmed;
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

                // Option A: purely by uses (most used overall)
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
        if (!loading && hasMore && q.trim()) {
            startSearch(q, active, false);
        }
    }, [loading, hasMore, q, active, startSearch]);

    const goAI = useCallback(() => {
        router.push("/ai");
    }, [router]);

    const showDefault = !q.trim();

    const showHandleSuggestions =
        !showDefault &&
        q.trim().startsWith("@") &&
        (handleSuggestions.length > 0 || handleSuggestLoading);

    const showTagSuggestions =
        !showDefault &&
        (q.trim().startsWith("#") || active === "Tags") &&
        (tagSuggestions.length > 0 || tagSuggestLoading);

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

    const renderTopItem = (item: TopItem, idx: number) => {
        switch (item.type) {
            case "deed": {
                const d = item.deed;
                return (
                    <button
                        key={`top_deed_${idx}_${d.id}`}
                        onClick={() => handleDeedClick(d)}
                        className="flex w-full items-center gap-3 rounded-xl py-3 text-left hover:bg-gray-50"
                    >
                        <img
                            src={d.mediaThumbUrl || PLACEHOLDER_DEED_THUMB}
                            alt={d.caption || "deed"}
                            className="h-[62px] w-[110px] rounded-lg bg-gray-100 object-cover"
                        />
                        <div className="flex-1">
                            <p className="line-clamp-2 text-sm font-semibold text-gray-900">
                                {d.caption || ""}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                                by {d.authorUsername || "ekarihub user"} ·{" "}
                                {(d.stats?.likes ?? 0).toLocaleString()} likes
                            </p>
                        </div>
                    </button>
                );
            }
            case "event": {
                const e = item.event;
                return (
                    <button
                        key={`top_event_${idx}_${e.id}`}
                        onClick={() => handleEventClick(e.id)}
                        className="flex w-full items-center gap-3 rounded-xl py-3 text-left hover:bg-gray-50"
                    >
                        {e.coverUrl ? (
                            <img
                                src={e.coverUrl}
                                alt={e.title || "event"}
                                className="h-14 w-20 rounded-lg bg-gray-100 object-cover"
                            />
                        ) : (
                            <img
                                src={PLACEHOLDER_EVENT_THUMB}
                                alt="event"
                                className="h-14 w-20 rounded-lg bg-gray-100 object-cover"
                            />
                        )}
                        <div className="flex-1">
                            <p className="line-clamp-2 text-sm font-semibold text-gray-900">
                                {e.title || ""}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                                {e.dateISO
                                    ? new Date(e.dateISO).toLocaleDateString(undefined, {
                                        month: "short",
                                        day: "numeric",
                                    })
                                    : ""}
                                {e.location ? ` · ${e.location}` : ""}
                            </p>
                        </div>
                    </button>
                );
            }
            case "discussion": {
                const d = item.discussion;
                return (
                    <button
                        key={`top_disc_${idx}_${d.id}`}
                        onClick={() => handleDiscussionClick(d.id)}
                        className="flex w-full items-center gap-3 rounded-xl py-3 text-left hover:bg-gray-50"
                    >
                        <div
                            className="flex h-9 w-9 items-center justify-center rounded-full"
                            style={{ backgroundColor: EKARI.soft }}
                        >
                            <IoChatbubblesOutline size={18} color={EKARI.forest} />
                        </div>
                        <div className="flex-1">
                            <p className="line-clamp-2 text-sm font-semibold text-gray-900">
                                {d.title || ""}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                                {d.repliesCount ?? 0} replies
                            </p>
                        </div>
                    </button>
                );
            }
            case "account": {
                const a = item.account;
                const handleLabel = a.handle.startsWith("@") ? a.handle : `@${a.handle}`;
                return (
                    <button
                        key={`top_acc_${idx}_${a.id}`}
                        onClick={() => handleAccountClick(a.handle)}
                        className="flex w-full items-center gap-3 rounded-xl py-3 text-left hover:bg-gray-50"
                    >
                        <Image
                            src={a.photoURL || "/avatar-placeholder.png"}
                            alt={a.firstName || "User"}
                            width={400}
                            height={400}
                            className="h-11 w-11 rounded-full bg-gray-100 object-cover"
                        />

                        <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900">
                                {a.firstName} {a.surname}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-500">{handleLabel}</p>
                        </div>
                    </button>
                );
            }
            case "tag": {
                const t = item.tag;
                return (
                    <button
                        key={`top_tag_${idx}_${t.id}`}
                        onClick={() => handleTagClick(t.tag)}
                        className="flex w-full items-center gap-2 rounded-xl py-3 text-left hover:bg-gray-50"
                    >
                        <IoPricetagOutline size={18} color={EKARI.gold} />
                        <span className="text-sm font-semibold text-gray-900">#{t.tag}</span>
                        <span className="ml-auto text-xs text-gray-500">
                            {t.uses.toLocaleString()} uses
                        </span>
                    </button>
                );
            }
        }
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

    /* ------------------------------ UI (Body) ------------------------------ */

    const Body = (
        <main className="min-h-screen w-full bg-white">
            {/* Header (keep for desktop only to avoid double header on mobile) */}
            {isDesktop && (
                <header
                    className="sticky top-0 z-30 border-b bg-gradient-to-br from-white to-gray-50/70 backdrop-blur"
                    style={{ borderColor: EKARI.line }}
                >
                    <div className="mx-auto flex max-w-3xl flex-col px-4 pt-3 pb-1">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={goBack}
                                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100"
                                aria-label="Back"
                            >
                                <IoArrowBack size={20} color={EKARI.text} />
                            </button>

                            <form
                                onSubmit={onSubmit}
                                className="flex flex-1 items-center gap-2 rounded-xl border bg-gray-50 px-3 py-2 text-sm shadow-sm"
                                style={{ borderColor: EKARI.line }}
                            >
                                <IoSearch size={16} color={EKARI.dim} />
                                <input
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Search deeds, events, discussions, accounts, tags…"
                                    className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                                />
                                {q && (
                                    <button
                                        type="button"
                                        onClick={() => {
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
                                        }}
                                        className="flex items-center justify-center"
                                    >
                                        <span className="text-xs text-gray-400 hover:text-gray-600">
                                            Clear
                                        </span>
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    className="hidden rounded-full px-3 py-1 text-xs font-semibold text-white md:inline-flex"
                                    style={{ backgroundColor: EKARI.forest }}
                                >
                                    Search
                                </button>
                            </form>

                            <button
                                onClick={goAI}
                                className="ml-1 flex h-10 w-10 items-center justify-center rounded-full"
                                style={{ backgroundColor: EKARI.soft }}
                                aria-label="Ask Ekari AI"
                            >
                                <IoSparklesOutline size={20} color={EKARI.forest} />
                            </button>
                        </div>

                        {(showHandleSuggestions || showTagSuggestions) && (
                            <div className="mt-2 w-full">
                                <div className="w-full rounded-xl border bg-white shadow-sm">
                                    {showHandleSuggestions && (
                                        <>
                                            {handleSuggestLoading && (
                                                <div className="px-3 py-2 text-xs text-gray-500">
                                                    Searching accounts…
                                                </div>
                                            )}
                                            {handleSuggestions.map((a) => {
                                                const handleLabel = a.handle.startsWith("@")
                                                    ? a.handle
                                                    : `@${a.handle}`;
                                                return (
                                                    <button
                                                        key={a.id}
                                                        type="button"
                                                        onClick={() => onSelectHandleSuggestion(a)}
                                                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
                                                    >
                                                        <Image
                                                            src={a.photoURL || "/avatar-placeholder.png"}
                                                            alt={a.firstName || "User"}
                                                            width={400}
                                                            height={400}
                                                            className="h-8 w-8 rounded-full bg-gray-100 object-cover"
                                                        />
                                                        <div className="flex-1">
                                                            <p className="text-xs font-semibold text-gray-900">
                                                                {a.firstName} {a.surname}
                                                            </p>
                                                            <p className="text-[11px] text-gray-500">
                                                                {handleLabel}
                                                            </p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                            {!handleSuggestLoading && handleSuggestions.length === 0 && (
                                                <div className="px-3 py-2 text-xs text-gray-500">
                                                    No matching accounts yet.
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {showTagSuggestions && (
                                        <>
                                            {tagSuggestLoading && (
                                                <div className="px-3 py-2 text-xs text-gray-500">
                                                    Searching tags…
                                                </div>
                                            )}
                                            {tagSuggestions.map((t) => (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    onClick={() => onSelectTagSuggestion(t)}
                                                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
                                                >
                                                    <IoPricetagOutline size={16} color={EKARI.gold} />
                                                    <span className="text-xs font-semibold text-gray-900">
                                                        #{t.tag}
                                                    </span>
                                                    <span className="ml-auto text-[11px] text-gray-500">
                                                        {t.uses.toLocaleString()} uses
                                                    </span>
                                                </button>
                                            ))}
                                            {!tagSuggestLoading && tagSuggestions.length === 0 && (
                                                <div className="px-3 py-2 text-xs text-gray-500">
                                                    No matching tags yet.
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mx-auto flex w-full max-w-3xl items-center overflow-x-auto px-4 pb-2 pt-1 no-scrollbar">
                        <div className="relative flex gap-2">
                            {TABS.map((t) => {
                                const isActiveTab = t === active;
                                return (
                                    <button
                                        key={t}
                                        type="button"
                                        className="flex h-8 w-[92px] items-center justify-center rounded-full border text-xs font-semibold transition"
                                        style={{
                                            borderColor: isActiveTab ? EKARI.forest : "#E5E7EB",
                                            backgroundColor: isActiveTab ? EKARI.forest : "#FFFFFF",
                                            color: isActiveTab ? "#FFFFFF" : EKARI.text,
                                            boxShadow: isActiveTab
                                                ? "0 1px 2px rgba(0,0,0,0.08)"
                                                : undefined,
                                        }}
                                        onClick={() => {
                                            setActive(t);
                                            setPage(0);
                                            if (q.trim()) startSearch(q, t, true);
                                        }}
                                    >
                                        {t}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </header>
            )}

            {/* Body */}
            <section className="w-full max-w-3xl px-4 pb-10 pt-4">
                {showDefault ? (
                    <div className="space-y-6">
                        <div
                            className="rounded-2xl border px-4 py-3 text-xs"
                            style={{
                                borderColor: "#D1FAE5",
                                backgroundColor: "rgba(230,242,239,0.9)",
                                color: EKARI.forest,
                            }}
                        >
                            <p className="font-semibold">Search ekarihub</p>
                            <p
                                className="mt-1 text-[11px]"
                                style={{ color: "rgba(35,63,57,0.85)" }}
                            >
                                Find deeds, events, discussions, people, and tags across the
                                agribusiness community. Try “maize”, “soil health”, “avocado
                                export”, <strong>@handle</strong> or <strong>#farmer</strong>.
                            </p>
                        </div>

                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <h2 className="text-sm font-bold text-gray-900">Recent</h2>
                                {recents.length > 0 && (
                                    <button
                                        onClick={clearRecents}
                                        className="text-xs font-medium text-gray-500 hover:text-gray-700"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>

                            {recents.length === 0 ? (
                                <p className="text-xs text-gray-500">No recent searches yet.</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {recents.map((r) => (
                                        <button
                                            key={r}
                                            onClick={() => onTapRecent(r)}
                                            className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
                                            style={{
                                                backgroundColor: EKARI.chip,
                                                borderColor: EKARI.chipBorder,
                                                color: EKARI.text,
                                            }}
                                        >
                                            <IoTimeOutline size={14} />
                                            <span>{r}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <h2 className="text-sm font-bold text-gray-900">Trending</h2>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {trending.map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => onTapTrending(t)}
                                        className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
                                        style={{
                                            backgroundColor: EKARI.chip,
                                            borderColor: EKARI.chipBorder,
                                            color: EKARI.text,
                                        }}
                                    >
                                        <IoTrendingUpOutline size={14} color={EKARI.gold} />
                                        <span>{t}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {isTagFeed && (
                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <div>
                                    <span>Deeds tagged with </span>
                                    <span className="font-semibold text-gray-800">{q.trim()}</span>
                                </div>
                                {currentCount > 0 && (
                                    <span>
                                        {currentCount.toLocaleString()} deed{currentCount > 1 ? "s" : ""} so far
                                    </span>
                                )}
                            </div>
                        )}

                        {lastQuery && (
                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <div>
                                    <span>Results for </span>
                                    <span className="font-semibold text-gray-800">“{lastQuery}”</span>
                                    <span>{` · ${active}`}</span>
                                </div>
                                {currentCount > 0 && (
                                    <span>
                                        {currentCount.toLocaleString()} result{currentCount > 1 ? "s" : ""}
                                    </span>
                                )}
                            </div>
                        )}

                        <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
                            {(!listData || listData.length === 0) && !loading && (
                                <div className="px-4 py-10 text-center text-sm text-gray-500">
                                    No results found. Try a different keyword or broaden your search.
                                </div>
                            )}

                            {active === "Top" &&
                                topData.map((item, idx) => (
                                    <div key={idx} className="px-4 first:pt-3 last:pb-3">
                                        {renderTopItem(item, idx)}
                                    </div>
                                ))}

                            {active === "Deeds" &&
                                deedData.map((d) => (
                                    <button
                                        key={d.id}
                                        onClick={() => handleDeedClick(d)}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                                    >
                                        <img
                                            src={d.mediaThumbUrl || PLACEHOLDER_DEED_THUMB}
                                            alt={d.caption || "deed"}
                                            className="h-[62px] w-[110px] rounded-lg bg-gray-100 object-cover"
                                        />
                                        <div className="flex-1">
                                            <p className="line-clamp-2 text-sm font-semibold text-gray-900">
                                                {d.caption || ""}
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                by {d.authorUsername || "ekarihub user"} ·{" "}
                                                {(d.stats?.likes ?? 0).toLocaleString()} likes ·{" "}
                                                {(d.stats?.views ?? 0).toLocaleString()} views
                                            </p>
                                        </div>
                                    </button>
                                ))}

                            {active === "Events" &&
                                eventData.map((e) => (
                                    <button
                                        key={e.id}
                                        onClick={() => handleEventClick(e.id)}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                                    >
                                        {e.coverUrl ? (
                                            <img
                                                src={e.coverUrl}
                                                alt={e.title || "event"}
                                                className="h-14 w-20 rounded-lg bg-gray-100 object-cover"
                                            />
                                        ) : (
                                            <img
                                                src={PLACEHOLDER_EVENT_THUMB}
                                                alt="event"
                                                className="h-14 w-20 rounded-lg bg-gray-100 object-cover"
                                            />
                                        )}
                                        <div className="flex-1">
                                            <p className="line-clamp-2 text-sm font-semibold text-gray-900">
                                                {e.title || ""}
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                {e.dateISO
                                                    ? new Date(e.dateISO).toLocaleDateString(undefined, {
                                                        month: "short",
                                                        day: "numeric",
                                                    })
                                                    : ""}
                                                {e.location ? ` · ${e.location}` : ""}
                                            </p>
                                        </div>
                                    </button>
                                ))}

                            {active === "Discussions" &&
                                discData.map((d) => (
                                    <button
                                        key={d.id}
                                        onClick={() => handleDiscussionClick(d.id)}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                                    >
                                        <div
                                            className="flex h-9 w-9 items-center justify-center rounded-full"
                                            style={{ backgroundColor: EKARI.soft }}
                                        >
                                            <IoChatbubblesOutline size={18} color={EKARI.forest} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="line-clamp-2 text-sm font-semibold text-gray-900">
                                                {d.title || ""}
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                {d.repliesCount ?? 0} replies{d.category ? ` · ${d.category}` : ""}
                                            </p>
                                        </div>
                                    </button>
                                ))}

                            {active === "Accounts" &&
                                accData.map((a) => {
                                    const handleLabel = a.handle.startsWith("@") ? a.handle : `@${a.handle}`;
                                    return (
                                        <button
                                            key={a.id}
                                            onClick={() => handleAccountClick(a.handle)}
                                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                                        >
                                            <Image
                                                src={a.photoURL || "/avatar-placeholder.png"}
                                                alt={a.firstName || "User"}
                                                width={400}
                                                height={400}
                                                className="h-11 w-11 rounded-full bg-gray-100 object-cover"
                                            />
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold text-gray-900">
                                                    {a.firstName} {a.surname}
                                                </p>
                                                <p className="mt-0.5 text-xs text-gray-500">
                                                    {handleLabel} · {(a.followers ?? 0).toLocaleString()} followers
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}

                            {active === "Tags" &&
                                tagData.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleTagClick(t.tag)}
                                        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-gray-50"
                                    >
                                        <IoPricetagOutline size={18} color={EKARI.gold} />
                                        <span className="text-sm font-semibold text-gray-900">#{t.tag}</span>
                                        <span className="ml-auto text-xs text-gray-500">
                                            {t.uses.toLocaleString()} uses
                                        </span>
                                    </button>
                                ))}
                        </div>

                        <div className="mt-4 flex justify-center">
                            {loading ? (
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <BouncingBallLoader />
                                    <span>Searching…</span>
                                </div>
                            ) : hasMore && listData && listData.length > 0 ? (
                                <button
                                    onClick={loadMore}
                                    className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                                >
                                    Load more results
                                </button>
                            ) : null}
                        </div>
                    </div>
                )}

                {isMobile && <div style={{ height: "env(safe-area-inset-bottom)" }} />}
            </section>
        </main>
    );

    // ✅ MOBILE: fixed inset + sticky header + scroll area (no AppShell)
    if (isMobile) {
        return (
            <div className="fixed inset-0 flex flex-col bg-white">
                {/* Sticky top bar */}
                <div className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
                    <div
                        className="px-3"
                        style={{ paddingTop: "env(safe-area-inset-top)" }}
                    >
                        <div className="h-14 flex items-center gap-2">
                            <button
                                onClick={goBack}
                                className="h-10 w-10 rounded-full border border-gray-200 grid place-items-center"
                                aria-label="Back"
                                title="Back"
                            >
                                <IoArrowBack size={18} color={EKARI.text} />
                            </button>

                            {/* Search input (mobile top bar) */}
                            <form
                                onSubmit={onSubmit}
                                className="flex flex-1 items-center gap-2 rounded-full border bg-gray-50 px-3 py-2 text-sm"
                                style={{ borderColor: EKARI.line }}
                            >
                                <IoSearch size={16} color={EKARI.dim} />
                                <input
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Search…"
                                    className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                                />
                                {q && (
                                    <button
                                        type="button"
                                        onClick={() => {
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
                                        }}
                                        className="px-2"
                                        aria-label="Clear"
                                    >
                                        <span className="text-xs text-gray-400 hover:text-gray-600">Clear</span>
                                    </button>
                                )}
                            </form>

                            <button
                                onClick={goAI}
                                className="h-10 w-10 rounded-full grid place-items-center"
                                style={{ backgroundColor: EKARI.soft }}
                                aria-label="Ask Ekari AI"
                                title="Ask Ekari AI"
                            >
                                <IoSparklesOutline size={18} color={EKARI.forest} />
                            </button>
                        </div>

                        {/* Suggestions dropdown (mobile, below search bar) */}
                        {(showHandleSuggestions || showTagSuggestions) && (
                            <div className="pb-2">
                                <div className="w-full rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                                    {showHandleSuggestions && (
                                        <>
                                            {handleSuggestLoading && (
                                                <div className="px-3 py-2 text-xs text-gray-500">
                                                    Searching accounts…
                                                </div>
                                            )}
                                            {handleSuggestions.map((a) => {
                                                const handleLabel = a.handle.startsWith("@") ? a.handle : `@${a.handle}`;
                                                return (
                                                    <button
                                                        key={a.id}
                                                        type="button"
                                                        onClick={() => onSelectHandleSuggestion(a)}
                                                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
                                                    >
                                                        <Image
                                                            src={a.photoURL || "/avatar-placeholder.png"}
                                                            alt={a.firstName || "User"}
                                                            width={400}
                                                            height={400}
                                                            className="h-8 w-8 rounded-full bg-gray-100 object-cover"
                                                        />
                                                        <div className="flex-1">
                                                            <p className="text-xs font-semibold text-gray-900">
                                                                {a.firstName} {a.surname}
                                                            </p>
                                                            <p className="text-[11px] text-gray-500">{handleLabel}</p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                            {!handleSuggestLoading && handleSuggestions.length === 0 && (
                                                <div className="px-3 py-2 text-xs text-gray-500">
                                                    No matching accounts yet.
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {showTagSuggestions && (
                                        <>
                                            {tagSuggestLoading && (
                                                <div className="px-3 py-2 text-xs text-gray-500">
                                                    Searching tags…
                                                </div>
                                            )}
                                            {tagSuggestions.map((t) => (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    onClick={() => onSelectTagSuggestion(t)}
                                                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
                                                >
                                                    <IoPricetagOutline size={16} color={EKARI.gold} />
                                                    <span className="text-xs font-semibold text-gray-900">#{t.tag}</span>
                                                    <span className="ml-auto text-[11px] text-gray-500">
                                                        {t.uses.toLocaleString()} uses
                                                    </span>
                                                </button>
                                            ))}
                                            {!tagSuggestLoading && tagSuggestions.length === 0 && (
                                                <div className="px-3 py-2 text-xs text-gray-500">
                                                    No matching tags yet.
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Tabs (mobile) */}
                        <div className="w-full overflow-x-auto pb-2 no-scrollbar">
                            <div className="flex gap-2">
                                {TABS.map((t) => {
                                    const isActiveTab = t === active;
                                    return (
                                        <button
                                            key={t}
                                            type="button"
                                            className="shrink-0 flex h-8 px-4 items-center justify-center rounded-full border text-xs font-semibold transition"
                                            style={{
                                                borderColor: isActiveTab ? EKARI.forest : "#E5E7EB",
                                                backgroundColor: isActiveTab ? EKARI.forest : "#FFFFFF",
                                                color: isActiveTab ? "#FFFFFF" : EKARI.text,
                                            }}
                                            onClick={() => {
                                                setActive(t);
                                                setPage(0);
                                                if (q.trim()) startSearch(q, t, true);
                                            }}
                                        >
                                            {t}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
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
