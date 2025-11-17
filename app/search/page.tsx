"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { app } from "@/lib/firebase";
import AppShell from "@/app/components/AppShell";

/* -------------------- Types -------------------- */

type TabKey = "Top" | "Deeds" | "Events" | "Discussions" | "Accounts" | "Tags";

const TABS: TabKey[] = ["Top", "Deeds", "Events", "Discussions", "Accounts", "Tags"];

type Deed = {
  id: string;
  thumbUrl?: string;
  caption?: string;
  authorName?: string;
  authorId?: string;
  likes?: number;
  plays?: number;
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
  avatarUrl?: string;
  displayName: string;
  handle: string;
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

/* -------------------- Constants -------------------- */

const RECENTS_KEY = "ekari.search.recents";

const BRAND = {
  forest: "#233F39",
  gold: "#C79257",
  text: "#0E1116",
  dim: "rgba(14,17,22,0.6)",
  line: "rgba(14,17,22,0.08)",
  chip: "rgba(14,17,22,0.06)",
  chipBorder: "rgba(14,17,22,0.12)",
  surface: "#FFFFFF",
  surface2: "#F7F7F7",
};

const PLACEHOLDER_DEED_THUMB =
  "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800&auto=format&fit=crop";
const PLACEHOLDER_EVENT_THUMB =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=800&auto=format&fit=crop";
const PLACEHOLDER_AVATAR =
  "https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=400&auto=format&fit=crop";

const TRENDING_DEFAULT = [
  "maize spacing",
  "avocado export",
  "dairy feed ratios",
  "tomato diseases",
  "poultry housing",
];

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

/* -------------------- Page Component -------------------- */

export default function SearchPage() {
  const router = useRouter();

  const [q, setQ] = useState("");
  const [lastQuery, setLastQuery] = useState(""); // for “Results for …”
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
  const [trending] = useState<string[]>(TRENDING_DEFAULT);

  // For underline position (desktop)
  const tabIndex = useMemo(() => TABS.indexOf(active), [active]);
  const TAB_WIDTH = 92;

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

  /* --------- Search logic --------- */
  const startSearch = useCallback(
    async (query: string, tab: TabKey, reset = false) => {
      const trimmed = query.trim();
      if (!trimmed) {
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
          setLastQuery(trimmed);
        }

        const res = await fetchSearchEkarihub(trimmed, tab, nextPage);

        setHasMore(!!res.hasMore);
        if (!reset) setPage(nextPage);

        const merge = <T,>(prev: T[], incoming?: T[], override?: boolean) =>
          override ? incoming || [] : [...prev, ...(incoming || [])];

        if (tab === "Top") {
          setTopData(merge(topData, res.top, reset));

          // Seed other tabs on first Top search
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

        if (reset) saveRecent(trimmed);
      } catch (e) {
        console.warn("Search error", e);
        // keep this simple for now
        if (typeof window !== "undefined") {
          window.alert("Search error. Please check your connection and try again.");
        }
      } finally {
        setLoading(false);
      }
    },
    [page, topData, deedData, eventData, discData, accData, tagData, saveRecent]
  );

  const onSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      startSearch(q, active, true);
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
    router.push("/ai"); // adjust if your Ekari AI route is different
  }, [router]);

  const showDefault = !q.trim();

  /* --------- Render helpers --------- */

  const handleDeedClick = (id: string) => router.push(`/deed/${id}`);
  const handleEventClick = (id: string) => router.push(`/events/${id}`);
  const handleDiscussionClick = (id: string) => router.push(`/discussions/${id}`);
  const handleAccountClick = (id: string) => router.push(`/profile/${id}`);
  const handleTagClick = (tag: string) => router.push(`/tags/${encodeURIComponent(tag)}`);

  const renderTopItem = (item: TopItem, idx: number) => {
    switch (item.type) {
      case "deed": {
        const d = item.deed;
        return (
          <button
            key={`top_deed_${idx}_${d.id}`}
            onClick={() => handleDeedClick(d.id)}
            className="flex w-full items-center gap-3 rounded-xl py-3 text-left hover:bg-gray-50"
          >
            <img
              src={d.thumbUrl || PLACEHOLDER_DEED_THUMB}
              alt={d.caption || "deed"}
              className="h-[62px] w-[110px] rounded-lg bg-gray-100 object-cover"
            />
            <div className="flex-1">
              <p className="line-clamp-2 text-sm font-semibold text-gray-900">
                {d.caption || ""}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                by {d.authorName || "Ekarihub user"} · {(d.likes ?? 0).toLocaleString()} likes
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
              <div className="h-14 w-20 rounded-lg bg-gray-100" />
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
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50">
              <IoChatbubblesOutline size={18} color={BRAND.forest} />
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
        return (
          <button
            key={`top_acc_${idx}_${a.id}`}
            onClick={() => handleAccountClick(a.id)}
            className="flex w-full items-center gap-3 rounded-xl py-3 text-left hover:bg-gray-50"
          >
            <img
              src={a.avatarUrl || PLACEHOLDER_AVATAR}
              alt={a.displayName}
              className="h-11 w-11 rounded-full bg-gray-100 object-cover"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">{a.displayName}</p>
              <p className="mt-0.5 text-xs text-gray-500">@{a.handle}</p>
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
            <IoPricetagOutline size={18} color={BRAND.gold} />
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

  /* --------- JSX --------- */

  return (
    <AppShell>
      <main className="min-h-screen w-full bg-gray-50">
        {/* Header */}
        <header
          className="sticky top-0 z-30 border-b bg-gradient-to-br from-white to-gray-50/70 backdrop-blur"
          style={{ borderColor: BRAND.line }}
        >
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
            <button
              onClick={() => router.back()}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100"
              aria-label="Back"
            >
              <IoArrowBack size={20} color={BRAND.text} />
            </button>

            <form
              onSubmit={onSubmit}
              className="flex flex-1 items-center gap-2 rounded-xl border bg-gray-50 px-3 py-2 text-sm shadow-sm"
              style={{ borderColor: BRAND.line }}
            >
              <IoSearch size={16} color={BRAND.dim} />
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
                className="hidden rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800 md:inline-flex"
              >
                Search
              </button>
            </form>

            <button
              onClick={goAI}
              className="ml-1 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 hover:bg-emerald-100"
              aria-label="Ask Ekari AI"
            >
              <IoSparklesOutline size={20} color={BRAND.forest} />
            </button>
          </div>

          {/* Tabs */}
          <div className="mx-auto flex w-full max-w-3xl items-center overflow-x-auto px-4 pb-2 pt-1 no-scrollbar relative">
            <div className="relative flex gap-2">
              {TABS.map((t, index) => {
                const isActive = t === active;
                return (
                  <button
                    key={t}
                    type="button"
                    className={[
                      "flex h-8 w-[92px] items-center justify-center rounded-full border text-xs font-semibold transition",
                      isActive
                        ? "border-emerald-900 bg-emerald-900 text-white shadow-sm"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                    ].join(" ")}
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

              {/* Underline indicator (simple transform, mainly visible on desktop) */}
              <div
                className="pointer-events-none absolute -bottom-0.5 h-0.5 w-7 rounded-full bg-emerald-900 transition-transform duration-200"
                style={{
                  transform: `translateX(${tabIndex * TAB_WIDTH + (TAB_WIDTH - 28) / 2}px)`,
                }}
              />
            </div>
          </div>
        </header>

        {/* Body */}
        <section className="mx-auto w-full max-w-3xl px-4 pb-10 pt-4">
          {showDefault ? (
            <div className="space-y-6">
              {/* Small intro / hint */}
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-900">
                <p className="font-semibold">Search ekarihub</p>
                <p className="mt-1 text-[11px] text-emerald-900/80">
                  Find deeds, events, discussions, people, and tags across the entire
                  agribusiness community. Try searching for a crop (“maize”), a topic
                  (“soil health”), or a market (“avocado export”).
                </p>
              </div>

              {/* Recents */}
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
                          backgroundColor: BRAND.chip,
                          borderColor: BRAND.chipBorder,
                          color: BRAND.text,
                        }}
                      >
                        <IoTimeOutline size={14} />
                        <span>{r}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Trending */}
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
                        backgroundColor: BRAND.chip,
                        borderColor: BRAND.chipBorder,
                        color: BRAND.text,
                      }}
                    >
                      <IoTrendingUpOutline size={14} color={BRAND.gold} />
                      <span>{t}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Results header */}
              {lastQuery && (
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div>
                    <span>Results for </span>
                    <span className="font-semibold text-gray-800">“{lastQuery}”</span>
                    <span>{` · ${active}`}</span>
                  </div>
                  {currentCount > 0 && (
                    <span>{currentCount.toLocaleString()} result{currentCount > 1 ? "s" : ""}</span>
                  )}
                </div>
              )}

              {/* Results list */}
              <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
                {(!listData || listData.length === 0) && !loading && (
                  <div className="px-4 py-10 text-center text-sm text-gray-500">
                    No results found. Try a different keyword or broaden your search.
                  </div>
                )}

                {/* TOP */}
                {active === "Top" &&
                  topData.map((item, idx) => (
                    <div key={idx} className="px-4 first:pt-3 last:pb-3">
                      {renderTopItem(item, idx)}
                    </div>
                  ))}

                {/* DEEDS */}
                {active === "Deeds" &&
                  deedData.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleDeedClick(d.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                    >
                      <img
                        src={d.thumbUrl || PLACEHOLDER_DEED_THUMB}
                        alt={d.caption || "deed"}
                        className="h-[62px] w-[110px] rounded-lg bg-gray-100 object-cover"
                      />
                      <div className="flex-1">
                        <p className="line-clamp-2 text-sm font-semibold text-gray-900">
                          {d.caption || ""}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          by {d.authorName || "Ekarihub user"} ·{" "}
                          {(d.likes ?? 0).toLocaleString()} likes ·{" "}
                          {(d.plays ?? 0).toLocaleString()} plays
                        </p>
                      </div>
                    </button>
                  ))}

                {/* EVENTS */}
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
                        <div className="h-14 w-20 rounded-lg bg-gray-100" />
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

                {/* DISCUSSIONS */}
                {active === "Discussions" &&
                  discData.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleDiscussionClick(d.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50">
                        <IoChatbubblesOutline size={18} color={BRAND.forest} />
                      </div>
                      <div className="flex-1">
                        <p className="line-clamp-2 text-sm font-semibold text-gray-900">
                          {d.title || ""}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {d.repliesCount ?? 0} replies
                          {d.category ? ` · ${d.category}` : ""}
                        </p>
                      </div>
                    </button>
                  ))}

                {/* ACCOUNTS */}
                {active === "Accounts" &&
                  accData.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => handleAccountClick(a.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                    >
                      <img
                        src={a.avatarUrl || PLACEHOLDER_AVATAR}
                        alt={a.displayName}
                        className="h-11 w-11 rounded-full bg-gray-100 object-cover"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {a.displayName}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          @{a.handle} · {(a.followers ?? 0).toLocaleString()} followers
                        </p>
                      </div>
                    </button>
                  ))}

                {/* TAGS */}
                {active === "Tags" &&
                  tagData.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleTagClick(t.tag)}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-gray-50"
                    >
                      <IoPricetagOutline size={18} color={BRAND.gold} />
                      <span className="text-sm font-semibold text-gray-900">
                        #{t.tag}
                      </span>
                      <span className="ml-auto text-xs text-gray-500">
                        {t.uses.toLocaleString()} uses
                      </span>
                    </button>
                  ))}
              </div>

              {/* Footer: loading / load more */}
              <div className="mt-4 flex justify-center">
                {loading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="h-3 w-3 animate-spin rounded-full border border-emerald-800 border-t-transparent" />
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
        </section>
      </main>
    </AppShell>
  );
}
