"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    IoPersonOutline,
    IoCalendarOutline,
    IoPlayCircleOutline,
} from "react-icons/io5";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, db } from "@/lib/firebase";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import { DeedStats } from "@/lib/fire-queries";
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

type LiveSuggestion =
    | { type: "search"; label: string; query: string }
    | { type: "deed"; deed: Deed }
    | { type: "event"; event: EventItem }
    | { type: "discussion"; discussion: DiscussionItem }
    | { type: "account"; account: Account }
    | { type: "tag"; tag: Hashtag };

/* -------------------- Theme -------------------- */

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

/* -------------------- Helpers -------------------- */

function normalizeQueryForBackend(query: string, tab: TabKey) {
    const trimmed = query.trim();
    if (!trimmed) return "";

    if (trimmed.startsWith("@")) return trimmed.replace(/^@+/, "");
    if (trimmed.startsWith("#")) return trimmed.replace(/^#+/, "");
    if (tab === "Accounts") return trimmed.replace(/^@+/, "");
    if (tab === "Tags") return trimmed.replace(/^#+/, "");
    return trimmed;
}

const cn = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");

function fmtCompact(n: number) {
    const x = Number(n || 0);
    if (x >= 1_000_000) return (x / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (x >= 1_000) return (x / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(x);
}

function CardShell({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="overflow-hidden rounded-3xl border bg-white shadow-[0_10px_40px_rgba(15,23,42,0.06)]"
            style={{ borderColor: EKARI.line }}
        >
            {children}
        </div>
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
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold hover:bg-black/[0.02]"
            style={{
                backgroundColor: EKARI.chip,
                borderColor: EKARI.chipBorder,
                color: EKARI.text,
            }}
            type="button"
        >
            {icon}
            <span className="max-w-[240px] truncate">{label}</span>
        </button>
    );
}

function Section({
    title,
    count,
    children,
}: {
    title: string;
    count?: number;
    children: React.ReactNode;
}) {
    return (
        <section className="mt-4">
            <div className="flex items-center justify-between px-4 pb-2">
                <h2 className="text-[14px] font-semibold tracking-[-0.01em]" style={{ color: EKARI.text }}>
                    {title}
                </h2>
                {typeof count === "number" ? (
                    <span className="text-[12px] font-medium" style={{ color: EKARI.dim }}>
                        {count}
                    </span>
                ) : null}
            </div>
            <CardShell>{children}</CardShell>
        </section>
    );
}

type SearchBarProps = {
    q: string;
    setQ: (v: string) => void;
    onSubmit: (e?: React.FormEvent) => void;
    resetAll: () => void;
    onBack: () => void;
    onFocus: () => void;
    onArrowDown: () => void;
    onArrowUp: () => void;
    onEnterHighlighted: () => void;
    onEscape: () => void;
};

const SearchBar = React.memo(function SearchBar({
    q,
    setQ,
    onSubmit,
    resetAll,
    onBack,
    onFocus,
    onArrowDown,
    onArrowUp,
    onEnterHighlighted,
    onEscape,
}: SearchBarProps) {
    return (
        <form onSubmit={onSubmit} className="flex items-center gap-3 px-3 py-2">
            <button
                type="button"
                onClick={onBack}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#111827] transition hover:bg-black/5"
                aria-label="Back"
            >
                <IoArrowBack size={22} />
            </button>

            <div className="flex h-11 flex-1 items-center rounded-full bg-[#F1F1F2] px-4">
                <IoSearch size={18} className="shrink-0 text-black/55" />

                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onFocus={onFocus}
                    onKeyDown={(e) => {
                        if (e.key === "ArrowDown") {
                            e.preventDefault();
                            onArrowDown();
                            return;
                        }

                        if (e.key === "ArrowUp") {
                            e.preventDefault();
                            onArrowUp();
                            return;
                        }

                        if (e.key === "Enter") {
                            if (q.trim()) {
                                e.preventDefault();
                                onEnterHighlighted();
                            }
                            return;
                        }

                        if (e.key === "Escape") {
                            e.preventDefault();
                            onEscape();
                        }
                    }}
                    placeholder="Search"
                    autoFocus
                    className="ml-3 flex-1 bg-transparent text-[17px] font-medium tracking-[-0.01em] text-[#111827] outline-none placeholder:font-normal placeholder:text-black/45"
                    style={{ fontSize: 17 }}
                />

                {!!q && (
                    <button
                        type="button"
                        onClick={resetAll}
                        className="grid h-7 w-7 place-items-center rounded-full bg-black/10 text-black/65 transition hover:bg-black/15"
                        aria-label="Clear"
                    >
                        <IoClose size={15} />
                    </button>
                )}
            </div>

            {!!q.trim() && (
                <button
                    type="submit"
                    className="shrink-0 text-[15px] font-semibold text-[#111827]"
                >
                    Search
                </button>
            )}
        </form>
    );
});
/* -------------------- Page -------------------- */

export default function SearchPageClient() {
    const router = useRouter();
    const sp = useSearchParams();
    const isDesktop = useIsDesktop();

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

    const [handleSuggestions, setHandleSuggestions] = useState<Account[]>([]);
    const [handleSuggestLoading, setHandleSuggestLoading] = useState(false);
    const [tagSuggestions, setTagSuggestions] = useState<Hashtag[]>([]);
    const [tagSuggestLoading, setTagSuggestLoading] = useState(false);

    const [liveSuggestions, setLiveSuggestions] = useState<LiveSuggestion[]>([]);
    const [liveSuggestLoading, setLiveSuggestLoading] = useState(false);
    const [showLiveDropdown, setShowLiveDropdown] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const [bootstrappedFromURL, setBootstrappedFromURL] = useState(false);

    const hideDropdownTimer = useRef<number | null>(null);

    /* --------- Recents --------- */

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

    /* --------- Trending --------- */

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
            } catch {
                setTrending(TRENDING_DEFAULT);
            }
        }

        loadTrendingFromHashtags();

        return () => {
            cancelled = true;
        };
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

        const id = window.setTimeout(async () => {
            try {
                const res = await fetchSearchEkarihub(backendQ, "Accounts", 0);
                if (cancelled) return;
                setHandleSuggestions((res.accounts || []).slice(0, 6));
            } catch {
                if (!cancelled) setHandleSuggestions([]);
            } finally {
                if (!cancelled) setHandleSuggestLoading(false);
            }
        }, 220);

        return () => {
            cancelled = true;
            clearTimeout(id);
        };
    }, [q]);

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

        const id = window.setTimeout(async () => {
            try {
                const res = await fetchSearchEkarihub(backendQ, "Tags", 0);
                if (cancelled) return;
                setTagSuggestions((res.tags || []).slice(0, 8));
            } catch {
                if (!cancelled) setTagSuggestions([]);
            } finally {
                if (!cancelled) setTagSuggestLoading(false);
            }
        }, 220);

        return () => {
            cancelled = true;
            clearTimeout(id);
        };
    }, [q, active]);

    /* --------- Live dropdown for normal search --------- */

    useEffect(() => {
        const trimmed = q.trim();
        const isSpecial = trimmed.startsWith("@") || trimmed.startsWith("#");

        if (!trimmed || isSpecial) {
            setLiveSuggestions([]);
            setLiveSuggestLoading(false);
            return;
        }

        const backendQ = normalizeQueryForBackend(trimmed, "Top");
        if (!backendQ || backendQ.length < 2) {
            setLiveSuggestions([
                { type: "search", label: `Search "${trimmed}"`, query: trimmed },
            ]);
            setLiveSuggestLoading(false);
            return;
        }

        let cancelled = false;
        setLiveSuggestLoading(true);

        const id = window.setTimeout(async () => {
            try {
                const res = await fetchSearchEkarihub(backendQ, "Top", 0);
                if (cancelled) return;

                const next: LiveSuggestion[] = [
                    { type: "search", label: `Search "${trimmed}"`, query: trimmed },
                ];

                (res.accounts || []).slice(0, 2).forEach((account) => {
                    next.push({ type: "account", account });
                });

                (res.tags || []).slice(0, 2).forEach((tag) => {
                    next.push({ type: "tag", tag });
                });

                (res.deeds || []).slice(0, 2).forEach((deed) => {
                    next.push({ type: "deed", deed });
                });

                (res.events || []).slice(0, 1).forEach((event) => {
                    next.push({ type: "event", event });
                });

                (res.discussions || []).slice(0, 1).forEach((discussion) => {
                    next.push({ type: "discussion", discussion });
                });

                setLiveSuggestions(next.slice(0, 8));
            } catch {
                if (!cancelled) {
                    setLiveSuggestions([
                        { type: "search", label: `Search "${trimmed}"`, query: trimmed },
                    ]);
                }
            } finally {
                if (!cancelled) setLiveSuggestLoading(false);
            }
        }, 220);

        return () => {
            cancelled = true;
            clearTimeout(id);
        };
    }, [q]);

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
                        setDeedData(res.deeds || []);
                        setEventData(res.events || []);
                        setDiscData(res.discussions || []);
                        setAccData(res.accounts || []);
                        setTagData(res.tags || []);
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

    /* --------- URL bootstrap --------- */

    useEffect(() => {
        if (!sp || bootstrappedFromURL) return;

        const qParam = sp.get("q");
        const tagParam = sp.get("tag");
        const tabParam = sp.get("tab") as TabKey | null;

        let incomingQuery = "";
        let incomingTab: TabKey = "Top";

        if (tagParam) {
            incomingQuery = `#${tagParam}`;
            incomingTab = tabParam && TABS.includes(tabParam) ? tabParam : "Deeds";
        } else if (qParam) {
            incomingQuery = qParam.trim();
            if (incomingQuery.startsWith("@")) incomingTab = "Accounts";
            else if (incomingQuery.startsWith("#")) incomingTab = "Tags";
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

    /* --------- Actions --------- */

    const closeDropdownSoon = useCallback(() => {
        if (hideDropdownTimer.current) window.clearTimeout(hideDropdownTimer.current);
        hideDropdownTimer.current = window.setTimeout(() => {
            setShowLiveDropdown(false);
        }, 120);
    }, []);

    const openDropdownNow = useCallback(() => {
        if (hideDropdownTimer.current) window.clearTimeout(hideDropdownTimer.current);
        setShowLiveDropdown(true);
    }, []);

    const onSubmit = useCallback(
        (e?: React.FormEvent) => {
            e?.preventDefault();
            const trimmed = q.trim();
            if (!trimmed) return;

            let targetTab: TabKey = "Top";

            if (trimmed.startsWith("@")) targetTab = "Accounts";
            else if (trimmed.startsWith("#")) targetTab = "Tags";

            setActive(targetTab);
            setShowLiveDropdown(false);
            startSearch(trimmed, targetTab, true);
            router.replace(`/search?q=${encodeURIComponent(trimmed)}`);
        },
        [q, startSearch, router]
    );

    const onTapRecent = useCallback(
        (term: string) => {
            setQ(term);
            setActive("Top");
            setShowLiveDropdown(false);
            startSearch(term, "Top", true);
            router.replace(`/search?q=${encodeURIComponent(term)}`);
        },
        [startSearch, router]
    );

    const onTapTrending = useCallback(
        (term: string) => {
            setQ(term);
            setActive("Top");
            setShowLiveDropdown(false);
            startSearch(term, "Top", true);
            router.replace(`/search?q=${encodeURIComponent(term)}`);
        },
        [startSearch, router]
    );

    const resetAll = useCallback(() => {
        setQ("");
        setLastQuery("");
        setActive("Top");
        setPage(0);
        setHasMore(false);
        setTopData([]);
        setDeedData([]);
        setEventData([]);
        setDiscData([]);
        setAccData([]);
        setTagData([]);
        setHandleSuggestions([]);
        setTagSuggestions([]);
        setLiveSuggestions([]);
        setShowLiveDropdown(false);
        setHighlightedIndex(0);
        router.replace("/search");
    }, [router]);

    const loadMore = useCallback(() => {
        if (!loading && hasMore && q.trim()) startSearch(q, active, false);
    }, [loading, hasMore, q, active, startSearch]);

    const goAI = useCallback(() => {
        router.push("/ai");
    }, [router]);

    /* --------- Navigation helpers --------- */

    const handleDeedClick = useCallback(
        (d: Deed) => {
            const handle = d.authorUsername || d.authorId || "deed";
            setShowLiveDropdown(false);
            router.push(`/${encodeURIComponent(handle)}/deed/${d.id}`);
        },
        [router]
    );

    const handleEventClick = useCallback(
        (id: string) => {
            setShowLiveDropdown(false);
            router.push(`/events/${id}`);
        },
        [router]
    );

    const handleDiscussionClick = useCallback(
        (id: string) => {
            setShowLiveDropdown(false);
            router.push(`/discussions/${id}`);
        },
        [router]
    );

    const handleAccountClick = useCallback(
        (handle: string) => {
            setShowLiveDropdown(false);
            router.push(`/${handle}`);
        },
        [router]
    );

    const handleTagClick = useCallback(
        (tag: string) => {
            const label = `#${tag}`;
            setQ(label);
            setActive("Deeds");
            setPage(0);
            setShowLiveDropdown(false);
            startSearch(label, "Deeds", true);
            router.push(`/search?tag=${encodeURIComponent(tag)}&tab=Deeds`);
        },
        [router, startSearch]
    );

    const onSelectHandleSuggestion = useCallback(
        (acc: Account) => {
            const normalizedHandle = acc.handle.startsWith("@") ? acc.handle.replace(/^@/, "") : acc.handle;
            const display = `@${normalizedHandle}`;
            setQ(display);
            setHandleSuggestions([]);
            setShowLiveDropdown(false);
            router.push(`/${normalizedHandle}`);
        },
        [router]
    );

    const onSelectTagSuggestion = useCallback(
        (tag: Hashtag) => {
            const label = `#${tag.tag}`;
            setQ(label);
            setTagSuggestions([]);
            setActive("Deeds");
            setPage(0);
            setShowLiveDropdown(false);
            startSearch(label, "Deeds", true);
            router.push(`/search?tag=${encodeURIComponent(tag.tag)}&tab=Deeds`);
        },
        [router, startSearch]
    );

    const onSelectLiveSuggestion = useCallback(
        (item: LiveSuggestion) => {
            if (item.type === "search") {
                setQ(item.query);
                setActive("Top");
                setShowLiveDropdown(false);
                startSearch(item.query, "Top", true);
                router.replace(`/search?q=${encodeURIComponent(item.query)}`);
                return;
            }

            if (item.type === "account") return handleAccountClick(item.account.handle);
            if (item.type === "tag") return handleTagClick(item.tag.tag);
            if (item.type === "deed") return handleDeedClick(item.deed);
            if (item.type === "event") return handleEventClick(item.event.id);
            if (item.type === "discussion") return handleDiscussionClick(item.discussion.id);
        },
        [handleAccountClick, handleTagClick, handleDeedClick, handleEventClick, handleDiscussionClick, startSearch, router]
    );

    /* --------- Derived --------- */

    const showDefault = !q.trim();

    const showHandleSuggestions =
        !showDefault && q.trim().startsWith("@") && (handleSuggestions.length > 0 || handleSuggestLoading);

    const showTagSuggestions =
        !showDefault &&
        q.trim().startsWith("#") &&
        (tagSuggestions.length > 0 || tagSuggestLoading);

    const showMixedLiveSuggestions =
        !showDefault &&
        !q.trim().startsWith("@") &&
        !q.trim().startsWith("#") &&
        (liveSuggestions.length > 0 || liveSuggestLoading);

    const shouldShowDropdown =
        showLiveDropdown && (showHandleSuggestions || showTagSuggestions || showMixedLiveSuggestions);

    useEffect(() => {
        setHighlightedIndex(0);
    }, [q, showHandleSuggestions, showTagSuggestions, showMixedLiveSuggestions]);

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
            default:
                return [];
        }
    }, [active, topData, deedData, eventData, discData, accData, tagData]);

    const currentCount = listData?.length ?? 0;
    const dropdownItems = useMemo(() => {
        if (showHandleSuggestions) {
            return handleSuggestions.map((acc) => ({ type: "account" as const, account: acc }));
        }

        if (showTagSuggestions) {
            return tagSuggestions.map((tag) => ({ type: "tag" as const, tag }));
        }

        if (showMixedLiveSuggestions) {
            return liveSuggestions;
        }

        return [];
    }, [
        showHandleSuggestions,
        showTagSuggestions,
        showMixedLiveSuggestions,
        handleSuggestions,
        tagSuggestions,
        liveSuggestions,
    ]);
    useEffect(() => {
        if (dropdownItems.length === 0) {
            setHighlightedIndex(0);
            return;
        }

        if (highlightedIndex > dropdownItems.length - 1) {
            setHighlightedIndex(0);
        }
    }, [dropdownItems, highlightedIndex]);
    /* --------- UI pieces --------- */
    const moveHighlightDown = useCallback(() => {
        if (!dropdownItems.length) return;
        setShowLiveDropdown(true);
        setHighlightedIndex((prev) => (prev + 1) % dropdownItems.length);
    }, [dropdownItems.length]);

    const moveHighlightUp = useCallback(() => {
        if (!dropdownItems.length) return;
        setShowLiveDropdown(true);
        setHighlightedIndex((prev) =>
            prev <= 0 ? dropdownItems.length - 1 : prev - 1
        );
    }, [dropdownItems.length]);

    const activateHighlightedItem = useCallback(() => {
        if (!dropdownItems.length) return;

        const item = dropdownItems[highlightedIndex];
        if (!item) return;

        if (item.type === "account") {
            onSelectHandleSuggestion(item.account);
            return;
        }

        if (item.type === "tag" && "tag" in item && !("query" in item)) {
            onSelectTagSuggestion(item.tag);
            return;
        }

        onSelectLiveSuggestion(item as LiveSuggestion);
    }, [
        dropdownItems,
        highlightedIndex,
        onSelectHandleSuggestion,
        onSelectTagSuggestion,
        onSelectLiveSuggestion,
    ]);

    const closeDropdown = useCallback(() => {
        setShowLiveDropdown(false);
    }, []);
    function StatMini({ label, value }: { label: string; value: string }) {
        return (
            <span
                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold"
                style={{ borderColor: EKARI.line, color: EKARI.text, background: "white" }}
            >
                <span style={{ color: EKARI.dim }}>{label}</span>
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
                        "w-full px-4 text-left transition hover:bg-black/[0.02] focus:outline-none",
                        compact ? "py-3" : "py-4"
                    )}
                    type="button"
                >
                    <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">{children}</div>
                        <div className="flex shrink-0 items-center gap-2">
                            {right}
                            <span
                                className="grid h-8 w-8 place-items-center rounded-full border opacity-60 transition group-hover:opacity-100"
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
                            <div
                                className="relative h-[62px] w-[110px] overflow-hidden rounded-xl border bg-gray-100"
                                style={{ borderColor: EKARI.line }}
                            >
                                <img
                                    src={d.mediaThumbUrl || PLACEHOLDER_DEED_THUMB}
                                    alt={d.caption || "deed"}
                                    className="h-full w-full object-cover"
                                />
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className="line-clamp-2 text-[15px] font-semibold leading-5" style={{ color: EKARI.text }}>
                                    {d.caption || "Untitled deed"}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <span className="text-[12px] font-medium" style={{ color: EKARI.dim }}>
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
                            <div
                                className="relative h-14 w-20 overflow-hidden rounded-xl border bg-gray-100"
                                style={{ borderColor: EKARI.line }}
                            >
                                <img
                                    src={e.coverUrl || PLACEHOLDER_EVENT_THUMB}
                                    alt={e.title || "event"}
                                    className="h-full w-full object-cover"
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="line-clamp-2 text-[15px] font-semibold leading-5" style={{ color: EKARI.text }}>
                                    {e.title || "Untitled event"}
                                </p>
                                <p className="mt-1 text-[12px] font-medium" style={{ color: EKARI.dim }}>
                                    {e.dateISO
                                        ? new Date(e.dateISO).toLocaleDateString(undefined, {
                                            month: "short",
                                            day: "numeric",
                                        })
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
                                <p className="line-clamp-2 text-[15px] font-semibold leading-5" style={{ color: EKARI.text }}>
                                    {d.title || "Untitled discussion"}
                                </p>
                                <p className="mt-1 text-[12px] font-medium" style={{ color: EKARI.dim }}>
                                    {d.category ? `${d.category} · ` : ""}
                                    {fmtCompact(d.repliesCount || 0)} replies
                                </p>
                            </div>
                        </div>
                    </RowButton>
                );
            }

            case "account": {
                const a = item.account;
                const rawHandle = a.handle || "";
                const normalizedHandle = rawHandle.startsWith("@") ? rawHandle.replace(/^@/, "") : rawHandle;
                const handleLabel = `@${normalizedHandle}`;
                const name = [a.firstName, a.surname].filter(Boolean).join(" ").trim();

                return (
                    <RowButton key={`top_acc_${idx}_${a.id}`} onClick={() => handleAccountClick(normalizedHandle)}>
                        <div className="flex items-center gap-3">
                            <div
                                className="h-12 w-12 overflow-hidden rounded-full border bg-gray-100"
                                style={{ borderColor: EKARI.line }}
                            >
                                <img
                                    src={a.photoURL || PLACEHOLDER_AVATAR}
                                    alt={handleLabel}
                                    className="h-full w-full object-cover"
                                />
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[15px] font-semibold" style={{ color: EKARI.text }}>
                                    {name || normalizedHandle}
                                </p>
                                <p className="mt-1 text-[12px] font-medium" style={{ color: EKARI.dim }}>
                                    {handleLabel} · {fmtCompact(a.followers || 0)} followers
                                </p>
                            </div>
                        </div>
                    </RowButton>
                );
            }

            case "tag": {
                const t = item.tag;
                return (
                    <RowButton key={`top_tag_${idx}_${t.id}`} onClick={() => handleTagClick(t.tag)} compact>
                        <div className="flex items-center gap-3">
                            <div
                                className="flex h-11 w-11 items-center justify-center rounded-2xl border"
                                style={{ backgroundColor: "rgba(199,146,87,0.10)", borderColor: EKARI.line }}
                            >
                                <IoPricetagOutline size={18} color={EKARI.gold} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[15px] font-semibold" style={{ color: EKARI.text }}>
                                    #{t.tag}
                                </p>
                                <p className="mt-1 text-[12px] font-medium" style={{ color: EKARI.dim }}>
                                    {fmtCompact(t.uses || 0)} uses
                                </p>
                            </div>
                        </div>
                    </RowButton>
                );
            }

            default:
                return null;
        }
    };

    const renderDeedRow = (d: Deed, idx: number) => (
        <RowButton key={`deed_${idx}_${d.id}`} onClick={() => handleDeedClick(d)}>
            <div className="flex items-center gap-3">
                <div
                    className="relative h-[72px] w-[120px] overflow-hidden rounded-xl border bg-gray-100"
                    style={{ borderColor: EKARI.line }}
                >
                    <img
                        src={d.mediaThumbUrl || PLACEHOLDER_DEED_THUMB}
                        alt={d.caption || "deed"}
                        className="h-full w-full object-cover"
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[15px] font-semibold leading-5" style={{ color: EKARI.text }}>
                        {d.caption || "Untitled deed"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-medium" style={{ color: EKARI.dim }}>
                            by {d.authorUsername || "ekarihub user"}
                        </span>
                        <StatMini label="Likes" value={fmtCompact(d.stats?.likes ?? 0)} />
                        <StatMini label="Views" value={fmtCompact(d.stats?.views ?? 0)} />
                    </div>
                </div>
            </div>
        </RowButton>
    );

    const renderEventRow = (e: EventItem, idx: number) => (
        <RowButton key={`event_${idx}_${e.id}`} onClick={() => handleEventClick(e.id)}>
            <div className="flex items-center gap-3">
                <div
                    className="relative h-[68px] w-[96px] overflow-hidden rounded-xl border bg-gray-100"
                    style={{ borderColor: EKARI.line }}
                >
                    <img
                        src={e.coverUrl || PLACEHOLDER_EVENT_THUMB}
                        alt={e.title || "event"}
                        className="h-full w-full object-cover"
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[15px] font-semibold leading-5" style={{ color: EKARI.text }}>
                        {e.title || "Untitled event"}
                    </p>
                    <p className="mt-1 text-[12px] font-medium" style={{ color: EKARI.dim }}>
                        {e.dateISO
                            ? new Date(e.dateISO).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                            })
                            : ""}
                        {e.location ? ` · ${e.location}` : ""}
                    </p>
                    {!!e.organizerName && (
                        <p className="mt-1 text-[12px] font-medium" style={{ color: EKARI.dim }}>
                            by {e.organizerName}
                        </p>
                    )}
                </div>
            </div>
        </RowButton>
    );

    const renderDiscussionRow = (d: DiscussionItem, idx: number) => (
        <RowButton key={`discussion_${idx}_${d.id}`} onClick={() => handleDiscussionClick(d.id)}>
            <div className="flex items-center gap-3">
                <div
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border"
                    style={{ backgroundColor: "rgba(35,63,57,0.08)", borderColor: EKARI.line }}
                >
                    <IoChatbubblesOutline size={18} color={EKARI.forest} />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[15px] font-semibold leading-5" style={{ color: EKARI.text }}>
                        {d.title || "Untitled discussion"}
                    </p>
                    {!!d.excerpt && (
                        <p className="mt-1 line-clamp-2 text-[12px] font-medium" style={{ color: EKARI.dim }}>
                            {d.excerpt}
                        </p>
                    )}
                    <p className="mt-1 text-[12px] font-medium" style={{ color: EKARI.dim }}>
                        {d.category ? `${d.category} · ` : ""}
                        {fmtCompact(d.repliesCount || 0)} replies
                    </p>
                </div>
            </div>
        </RowButton>
    );

    const renderAccountRow = (a: Account, idx: number) => {
        const rawHandle = a.handle || "";
        const normalizedHandle = rawHandle.startsWith("@") ? rawHandle.replace(/^@/, "") : rawHandle;
        const handleLabel = `@${normalizedHandle}`;
        const name = [a.firstName, a.surname].filter(Boolean).join(" ").trim();

        return (
            <RowButton key={`account_${idx}_${a.id}`} onClick={() => handleAccountClick(normalizedHandle)}>
                <div className="flex items-center gap-3">
                    <div
                        className="h-12 w-12 overflow-hidden rounded-full border bg-gray-100"
                        style={{ borderColor: EKARI.line }}
                    >
                        <img
                            src={a.photoURL || PLACEHOLDER_AVATAR}
                            alt={handleLabel}
                            className="h-full w-full object-cover"
                        />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold" style={{ color: EKARI.text }}>
                            {name || normalizedHandle}
                        </p>
                        <p className="mt-1 text-[12px] font-medium" style={{ color: EKARI.dim }}>
                            {handleLabel} · {fmtCompact(a.followers || 0)} followers
                        </p>
                    </div>
                </div>
            </RowButton>
        );
    };

    const renderTagRow = (t: Hashtag, idx: number) => (
        <RowButton key={`tag_${idx}_${t.id}`} onClick={() => handleTagClick(t.tag)}>
            <div className="flex items-center gap-3">
                <div
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border"
                    style={{ backgroundColor: "rgba(199,146,87,0.10)", borderColor: EKARI.line }}
                >
                    <IoPricetagOutline size={18} color={EKARI.gold} />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold" style={{ color: EKARI.text }}>
                        #{t.tag}
                    </p>
                    <p className="mt-1 text-[12px] font-medium" style={{ color: EKARI.dim }}>
                        {fmtCompact(t.uses || 0)} uses
                    </p>
                </div>
            </div>
        </RowButton>
    );

    const renderLiveDropdown = () => {
        if (!shouldShowDropdown) return null;

        return (
            <div
                className="px-3 pt-1"
                onMouseDown={(e) => e.preventDefault()}
            >
                <CardShell>
                    {showHandleSuggestions && (
                        <div>
                            {handleSuggestLoading && handleSuggestions.length === 0 ? (
                                <div className="px-4 py-4 text-[13px] font-medium" style={{ color: EKARI.dim }}>
                                    Searching accounts…
                                </div>
                            ) : (
                                handleSuggestions.map((acc, idx) => {
                                    const rawHandle = acc.handle || "";
                                    const normalizedHandle = rawHandle.startsWith("@")
                                        ? rawHandle.replace(/^@/, "")
                                        : rawHandle;
                                    const handleLabel = `@${normalizedHandle}`;
                                    const name = [acc.firstName, acc.surname].filter(Boolean).join(" ").trim();

                                    return (
                                        <button
                                            key={`hs_${acc.id}_${idx}`}
                                            type="button"
                                            onClick={() => onSelectHandleSuggestion(acc)}
                                            className={cn(
                                                "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-black/[0.02]",
                                                highlightedIndex === idx && "bg-[#F5F5F5]"
                                            )}
                                        >
                                            <div
                                                className="h-10 w-10 overflow-hidden rounded-full border bg-gray-100"
                                                style={{ borderColor: EKARI.line }}
                                            >
                                                <img
                                                    src={acc.photoURL || PLACEHOLDER_AVATAR}
                                                    alt={handleLabel}
                                                    className="h-full w-full object-cover"
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-[14px] font-semibold" style={{ color: EKARI.text }}>
                                                    {name || normalizedHandle}
                                                </p>
                                                <p className="truncate text-[12px] font-medium" style={{ color: EKARI.dim }}>
                                                    {handleLabel}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {showTagSuggestions && (
                        <div>
                            {tagSuggestLoading && tagSuggestions.length === 0 ? (
                                <div className="px-4 py-4 text-[13px] font-medium" style={{ color: EKARI.dim }}>
                                    Searching tags…
                                </div>
                            ) : (
                                tagSuggestions.map((tag, idx) => (
                                    <button
                                        key={`ts_${tag.id}_${idx}`}
                                        type="button"
                                        onClick={() => onSelectTagSuggestion(tag)}
                                        className={cn(
                                            "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-black/[0.02]",
                                            highlightedIndex === idx && "bg-black/[0.03]"
                                        )}
                                    >
                                        <div
                                            className="flex h-10 w-10 items-center justify-center rounded-2xl border"
                                            style={{ backgroundColor: "rgba(199,146,87,0.10)", borderColor: EKARI.line }}
                                        >
                                            <IoPricetagOutline size={16} color={EKARI.gold} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[14px] font-semibold" style={{ color: EKARI.text }}>
                                                #{tag.tag}
                                            </p>
                                            <p className="truncate text-[12px] font-medium" style={{ color: EKARI.dim }}>
                                                {fmtCompact(tag.uses || 0)} uses
                                            </p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    )}

                    {showMixedLiveSuggestions && (
                        <div>
                            {liveSuggestLoading && liveSuggestions.length === 0 ? (
                                <div className="px-4 py-4 text-[13px] font-medium" style={{ color: EKARI.dim }}>
                                    Searching…
                                </div>
                            ) : (
                                liveSuggestions.map((item, idx) => {
                                    if (item.type === "search") {
                                        return (
                                            <button
                                                key={`ls_search_${idx}`}
                                                type="button"
                                                onClick={() => onSelectLiveSuggestion(item)}
                                                className={cn(
                                                    "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-black/[0.02]",
                                                    highlightedIndex === idx && "bg-black/[0.03]"
                                                )}
                                            >
                                                <div
                                                    className="flex h-10 w-10 items-center justify-center rounded-2xl border"
                                                    style={{ borderColor: EKARI.line, backgroundColor: "rgba(35,63,57,0.06)" }}
                                                >
                                                    <IoSearch size={17} color={EKARI.forest} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-[14px] font-semibold" style={{ color: EKARI.text }}>
                                                        {item.label}
                                                    </p>
                                                    <p className="truncate text-[12px] font-medium" style={{ color: EKARI.dim }}>
                                                        Search across deeds, events, discussions, accounts and tags
                                                    </p>
                                                </div>
                                            </button>
                                        );
                                    }

                                    if (item.type === "account") {
                                        const rawHandle = item.account.handle || "";
                                        const normalizedHandle = rawHandle.startsWith("@")
                                            ? rawHandle.replace(/^@/, "")
                                            : rawHandle;
                                        const handleLabel = `@${normalizedHandle}`;
                                        const name = [item.account.firstName, item.account.surname]
                                            .filter(Boolean)
                                            .join(" ")
                                            .trim();

                                        return (
                                            <button
                                                key={`ls_account_${item.account.id}_${idx}`}
                                                type="button"
                                                onClick={() => onSelectLiveSuggestion(item)}
                                                className={cn(
                                                    "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-black/[0.02]",
                                                    highlightedIndex === idx && "bg-black/[0.03]"
                                                )}
                                            >
                                                <div
                                                    className="h-10 w-10 overflow-hidden rounded-full border bg-gray-100"
                                                    style={{ borderColor: EKARI.line }}
                                                >
                                                    <img
                                                        src={item.account.photoURL || PLACEHOLDER_AVATAR}
                                                        alt={handleLabel}
                                                        className="h-full w-full object-cover"
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-[14px] font-semibold" style={{ color: EKARI.text }}>
                                                        {name || normalizedHandle}
                                                    </p>
                                                    <p className="truncate text-[12px] font-medium" style={{ color: EKARI.dim }}>
                                                        {handleLabel}
                                                    </p>
                                                </div>
                                                <IoPersonOutline size={16} color={EKARI.dim} />
                                            </button>
                                        );
                                    }

                                    if (item.type === "tag") {
                                        return (
                                            <button
                                                key={`ls_tag_${item.tag.id}_${idx}`}
                                                type="button"
                                                onClick={() => onSelectLiveSuggestion(item)}
                                                className={cn(
                                                    "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-black/[0.02]",
                                                    highlightedIndex === idx && "bg-black/[0.03]"
                                                )}
                                            >
                                                <div
                                                    className="flex h-10 w-10 items-center justify-center rounded-2xl border"
                                                    style={{ backgroundColor: "rgba(199,146,87,0.10)", borderColor: EKARI.line }}
                                                >
                                                    <IoPricetagOutline size={16} color={EKARI.gold} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-[14px] font-semibold" style={{ color: EKARI.text }}>
                                                        #{item.tag.tag}
                                                    </p>
                                                    <p className="truncate text-[12px] font-medium" style={{ color: EKARI.dim }}>
                                                        {fmtCompact(item.tag.uses || 0)} uses
                                                    </p>
                                                </div>
                                            </button>
                                        );
                                    }

                                    if (item.type === "deed") {
                                        return (
                                            <button
                                                key={`ls_deed_${item.deed.id}_${idx}`}
                                                type="button"
                                                onClick={() => onSelectLiveSuggestion(item)}
                                                className={cn(
                                                    "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-black/[0.02]",
                                                    highlightedIndex === idx && "bg-black/[0.03]"
                                                )}
                                            >
                                                <div
                                                    className="relative h-10 w-14 overflow-hidden rounded-lg border bg-gray-100"
                                                    style={{ borderColor: EKARI.line }}
                                                >
                                                    <img
                                                        src={item.deed.mediaThumbUrl || PLACEHOLDER_DEED_THUMB}
                                                        alt={item.deed.caption || "deed"}
                                                        className="h-full w-full object-cover"
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="line-clamp-1 text-[14px] font-semibold" style={{ color: EKARI.text }}>
                                                        {item.deed.caption || "Untitled deed"}
                                                    </p>
                                                    <p className="truncate text-[12px] font-medium" style={{ color: EKARI.dim }}>
                                                        by {item.deed.authorUsername || "ekarihub user"}
                                                    </p>
                                                </div>
                                                <IoPlayCircleOutline size={16} color={EKARI.dim} />
                                            </button>
                                        );
                                    }

                                    if (item.type === "event") {
                                        return (
                                            <button
                                                key={`ls_event_${item.event.id}_${idx}`}
                                                type="button"
                                                onClick={() => onSelectLiveSuggestion(item)}
                                                className={cn(
                                                    "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-black/[0.02]",
                                                    highlightedIndex === idx && "bg-black/[0.03]"
                                                )}
                                            >
                                                <div
                                                    className="relative h-10 w-14 overflow-hidden rounded-lg border bg-gray-100"
                                                    style={{ borderColor: EKARI.line }}
                                                >
                                                    <img
                                                        src={item.event.coverUrl || PLACEHOLDER_EVENT_THUMB}
                                                        alt={item.event.title || "event"}
                                                        className="h-full w-full object-cover"
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="line-clamp-1 text-[14px] font-semibold" style={{ color: EKARI.text }}>
                                                        {item.event.title || "Untitled event"}
                                                    </p>
                                                    <p className="truncate text-[12px] font-medium" style={{ color: EKARI.dim }}>
                                                        {item.event.location || "Event"}
                                                    </p>
                                                </div>
                                                <IoCalendarOutline size={16} color={EKARI.dim} />
                                            </button>
                                        );
                                    }

                                    return (
                                        <button
                                            key={`ls_disc_${item.discussion.id}_${idx}`}
                                            type="button"
                                            onClick={() => onSelectLiveSuggestion(item)}
                                            className={cn(
                                                "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-black/[0.02]",
                                                highlightedIndex === idx && "bg-black/[0.03]"
                                            )}
                                        >
                                            <div
                                                className="flex h-10 w-10 items-center justify-center rounded-2xl border"
                                                style={{ backgroundColor: "rgba(35,63,57,0.08)", borderColor: EKARI.line }}
                                            >
                                                <IoChatbubblesOutline size={16} color={EKARI.forest} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="line-clamp-1 text-[14px] font-semibold" style={{ color: EKARI.text }}>
                                                    {item.discussion.title || "Untitled discussion"}
                                                </p>
                                                <p className="truncate text-[12px] font-medium" style={{ color: EKARI.dim }}>
                                                    {fmtCompact(item.discussion.repliesCount || 0)} replies
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    )}
                </CardShell>
            </div>
        );
    };

    const renderTopSections = () => {
        const hasAny =
            deedData.length > 0 ||
            eventData.length > 0 ||
            discData.length > 0 ||
            accData.length > 0 ||
            tagData.length > 0 ||
            topData.length > 0;

        if (!hasAny) {
            return (
                <div className="px-4 py-10 text-center text-sm text-black/50">
                    No results found.
                </div>
            );
        }

        return (
            <div className="pb-10">
                {!!deedData.length && (
                    <Section title="Deeds" count={deedData.length}>
                        {deedData.slice(0, 6).map(renderDeedRow)}
                    </Section>
                )}

                {!!eventData.length && (
                    <Section title="Events" count={eventData.length}>
                        {eventData.slice(0, 6).map(renderEventRow)}
                    </Section>
                )}

                {!!discData.length && (
                    <Section title="Discussions" count={discData.length}>
                        {discData.slice(0, 6).map(renderDiscussionRow)}
                    </Section>
                )}

                {!!accData.length && (
                    <Section title="Accounts" count={accData.length}>
                        {accData.slice(0, 6).map(renderAccountRow)}
                    </Section>
                )}

                {!!tagData.length && (
                    <Section title="Tags" count={tagData.length}>
                        {tagData.slice(0, 6).map(renderTagRow)}
                    </Section>
                )}

                {!!topData.length && !deedData.length && !eventData.length && !discData.length && !accData.length && !tagData.length && (
                    <Section title="Top" count={topData.length}>
                        {topData.slice(0, 10).map(renderTopItem)}
                    </Section>
                )}
            </div>
        );
    };

    const renderSingleMode = () => {
        if (active === "Top") return renderTopSections();

        if (currentCount === 0) {
            return (
                <div className="px-4 py-10 text-center text-sm text-black/50">
                    No results found.
                </div>
            );
        }

        return (
            <div className="pb-10">
                {active === "Deeds" && (
                    <Section title={q.startsWith("#") ? `Tag: ${q}` : "Deeds"} count={deedData.length}>
                        {deedData.map(renderDeedRow)}
                    </Section>
                )}

                {active === "Events" && (
                    <Section title="Events" count={eventData.length}>
                        {eventData.map(renderEventRow)}
                    </Section>
                )}

                {active === "Discussions" && (
                    <Section title="Discussions" count={discData.length}>
                        {discData.map(renderDiscussionRow)}
                    </Section>
                )}

                {active === "Accounts" && (
                    <Section title="Accounts" count={accData.length}>
                        {accData.map(renderAccountRow)}
                    </Section>
                )}

                {active === "Tags" && (
                    <Section title="Tags" count={tagData.length}>
                        {tagData.map(renderTagRow)}
                    </Section>
                )}
            </div>
        );
    };

    return (
        <AppShell>
            <main className="min-h-screen w-full bg-white">
                <div className="mx-auto w-full max-w-4xl">
                    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur">
                        <div
                            onFocus={openDropdownNow}
                            onBlur={closeDropdownSoon}
                        >
                            <SearchBar
                                q={q}
                                setQ={(v) => {
                                    setQ(v);
                                    setShowLiveDropdown(true);
                                }}
                                onSubmit={onSubmit}
                                resetAll={resetAll}
                                onBack={goBack}
                                onFocus={openDropdownNow}
                                onArrowDown={moveHighlightDown}
                                onArrowUp={moveHighlightUp}
                                onEnterHighlighted={() => {
                                    if (shouldShowDropdown && dropdownItems.length > 0) {
                                        activateHighlightedItem();
                                    } else {
                                        onSubmit();
                                    }
                                }}
                                onEscape={closeDropdown}
                            />
                        </div>

                        {!showDefault && (
                            <div className="px-4 pb-3">
                                <p className="text-[12px] font-medium text-black/45">
                                    Search results across deeds, events, discussions, accounts and tags
                                </p>
                            </div>
                        )}
                    </div>

                    {renderLiveDropdown()}

                    {showDefault ? (
                        <div className="px-4 pb-10 pt-3">
                            {!!recents.length && (
                                <section className="mb-6">
                                    <div className="mb-3 flex items-center justify-between">
                                        <h2 className="text-[14px] font-semibold" style={{ color: EKARI.text }}>
                                            Recent
                                        </h2>
                                        <button
                                            type="button"
                                            onClick={clearRecents}
                                            className="text-[12px] font-medium"
                                            style={{ color: EKARI.dim }}
                                        >
                                            Clear
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {recents.map((term) => (
                                            <Chip
                                                key={term}
                                                icon={<IoTimeOutline size={14} />}
                                                label={term}
                                                onClick={() => onTapRecent(term)}
                                            />
                                        ))}
                                    </div>
                                </section>
                            )}

                            <section className="mb-6">
                                <div className="mb-3 flex items-center gap-2">
                                    <IoTrendingUpOutline size={16} color={EKARI.forest} />
                                    <h2 className="text-[14px] font-semibold" style={{ color: EKARI.text }}>
                                        Trending
                                    </h2>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {trending.map((term) => (
                                        <Chip
                                            key={term}
                                            label={term}
                                            onClick={() => onTapTrending(term)}
                                        />
                                    ))}
                                </div>
                            </section>

                            {isDesktop && (
                                <section>
                                    <div
                                        className="overflow-hidden rounded-3xl border"
                                        style={{
                                            borderColor: EKARI.line,
                                            background:
                                                "linear-gradient(180deg, rgba(35,63,57,0.05), rgba(199,146,87,0.05))",
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={goAI}
                                            className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-black/[0.02]"
                                        >
                                            <div
                                                className="flex h-11 w-11 items-center justify-center rounded-2xl"
                                                style={{ backgroundColor: "rgba(35,63,57,0.10)" }}
                                            >
                                                <IoSparklesOutline size={20} color={EKARI.forest} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[15px] font-semibold" style={{ color: EKARI.text }}>
                                                    Ask Ekari AI
                                                </p>
                                                <p className="mt-1 text-[12px] font-medium" style={{ color: EKARI.dim }}>
                                                    Try a smarter search experience
                                                </p>
                                            </div>
                                            <IoChevronForwardOutline size={18} color={EKARI.dim} />
                                        </button>
                                    </div>
                                </section>
                            )}
                        </div>
                    ) : (
                        <>
                            {loading && (
                                <div className="flex justify-center py-8">
                                    <BouncingBallLoader />
                                </div>
                            )}

                            {!loading && (
                                <div className="px-3">
                                    {renderSingleMode()}

                                    {hasMore && (
                                        <div className="flex justify-center pb-10 pt-2">
                                            <button
                                                type="button"
                                                onClick={loadMore}
                                                className="rounded-full border px-4 py-2 text-[13px] font-semibold transition hover:bg-black/[0.02]"
                                                style={{ borderColor: EKARI.line, color: EKARI.text }}
                                            >
                                                Load more
                                            </button>
                                        </div>
                                    )}

                                    {!hasMore && !!lastQuery && currentCount > 0 && (
                                        <div className="pb-10 text-center text-[12px] font-medium" style={{ color: EKARI.dim }}>
                                            End of results
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
        </AppShell>
    );
}