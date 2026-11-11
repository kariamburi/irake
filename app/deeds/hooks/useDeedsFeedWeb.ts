"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Deed, FeedCursor, FeedTabKey, fetchChannelPage,
    fetchRecommendedForYouWeb, fetchRecommendedDeedIdsWeb,
} from "../data/deedsFeedWeb";

const FIRST_CACHED = 4;
const FRESH_COUNT = 12;
const REFRESH_COUNT = 16;
const CACHE_MAX = 20;
const CACHE_REVEAL_BATCH = 4;
const CACHE_REVEAL_INTERVAL_MS = 450;
const PAGE_SIZE = 10;
const CACHE_KEY_PREFIX = "ekari:web:feed:v3:";

export type FeedState = {
    items: Deed[];
    cursor: FeedCursor;
    hasMore: boolean;
    loading: boolean;
    loadingMore: boolean;
    initialized: boolean;
};

const empty = (): FeedState => ({
    items: [], cursor: null, hasMore: true,
    loading: false, loadingMore: false, initialized: false,
});
const allTabs: FeedTabKey[] = ["forYou", "trending", "following", "nearby"];
function initialFeeds(): Record<FeedTabKey, FeedState> {
    return { forYou: empty(), trending: empty(), following: empty(), nearby: empty() };
}
const publicTab = (tab: FeedTabKey) => tab === "forYou" || tab === "trending";
const unique = (xs: Deed[]) => {
    const seen = new Set<string>();
    return xs.filter((x) => {
        if (!x?.id || seen.has(x.id)) return false;
        seen.add(x.id);
        return true;
    });
};
const suitable = (x: Deed) => x?.visibility === "public" && x?.status === "ready" &&
    (x.type === "video" ? !!(x.muxPlaybackId || x.mediaUrl)
        : !!(x.photoItems?.length || x.posterUrl));

function readCache(uid: string | null): Deed[] {
    try {
        const raw = window.localStorage.getItem(CACHE_KEY_PREFIX + (uid || "guest"));
        if (!raw) return [];
        const parsed = JSON.parse(raw) as { items?: Deed[] };
        return unique((Array.isArray(parsed.items) ? parsed.items : []).filter(suitable)).slice(0, CACHE_MAX);
    } catch (error) {
        console.warn("WEB_FEED_CACHE_READ_FAILED", error);
        return [];
    }
}

function writeCache(uid: string | null, items: Deed[]) {
    try {
        // Cache metadata only: never download/store full video binaries here.
        const cleaned = unique(items.filter(suitable)).slice(0, CACHE_MAX).map((d) => ({
            ...d,
            createdAt: typeof d.createdAt?.toMillis === "function"
                ? d.createdAt.toMillis()
                : d.createdAt,
        }));
        window.localStorage.setItem(CACHE_KEY_PREFIX + (uid || "guest"), JSON.stringify({
            savedAt: Date.now(), items: cleaned,
        }));
    } catch (error) {
        console.warn("WEB_FEED_CACHE_WRITE_FAILED", error);
    }
}

/** Cached-first browser feed, with immutable per-session recommendation IDs. */
export function useDeedsFeedWeb({
    uid = null, warmAuthor, initialTab = "forYou", refreshKey = 0,
}: {
    uid?: string | null;
    warmAuthor?: (authorId: string) => void;
    initialTab?: FeedTabKey;
    refreshKey?: number;
}) {
    const [activeTab, setActiveTab] = useState<FeedTabKey>(initialTab);
    const [refreshVersion, setRefreshVersion] = useState(0);
    const [feeds, setFeeds] = useState<Record<FeedTabKey, FeedState>>(initialFeeds);
    const stateRef = useRef(feeds);
    const generationRef = useRef(0);
    const busyRef = useRef<Record<FeedTabKey, boolean>>({ forYou: false, trending: false, following: false, nearby: false });
    const moreRef = useRef<Record<FeedTabKey, boolean>>({ forYou: false, trending: false, following: false, nearby: false });
    const recommendationIdsRef = useRef<string[]>([]);
    const recommendationIndexRef = useRef(0);
    const readyUidRef = useRef<string | null | undefined>(undefined);
    const lastRefreshKeyRef = useRef(refreshKey);
    const pendingExplicitRefreshRef = useRef(false);
    const requestRef = useRef(0); // invalidate previous pagination on explicit refresh
    const cacheRevealTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

    const stopCacheReveal = useCallback(() => {
        cacheRevealTimersRef.current.forEach(clearTimeout);
        cacheRevealTimersRef.current = [];
    }, []);


    const modify = useCallback((tab: FeedTabKey, fn: (p: FeedState) => FeedState) => {
        setFeeds((prev) => {
            const next = { ...prev, [tab]: fn(prev[tab]) };
            stateRef.current = next;
            return next;
        });
    }, []);

    const warm = useCallback((items: Deed[]) => {
        if (!warmAuthor) return;
        items.forEach((x) => { if (x.authorId) warmAuthor(x.authorId); });
    }, [warmAuthor]);

    const fetchFresh = useCallback(async (keepExisting: boolean): Promise<void> => {
        if (busyRef.current.forYou) {
            // A manual refresh during startup must not disappear silently.
            if (!keepExisting) pendingExplicitRefreshRef.current = true;
            return;
        }
        busyRef.current.forYou = true;
        const generation = generationRef.current;
        const request = ++requestRef.current;
        if (!keepExisting) stopCacheReveal();
        modify("forYou", (prev) => ({ ...prev, loading: !prev.items.length }));
        try {
            let fresh: Deed[];
            let nextCursor: FeedCursor = null;
            let hasMore: boolean;

            if (uid) {
                // A new seed requests a new recommendation session from the
                // deployed callable. Remaining IDs are stable for pagination.
                const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                const currentIds = stateRef.current.forYou.items.map((item) => item.id);
                const cachedIds = readCache(uid).map((item) => item.id);
                const excludeIds = [...new Set([...currentIds, ...cachedIds])].slice(0, 100);
                const ids = await fetchRecommendedForYouWeb(uid, seed, excludeIds);
                if (!ids.length) throw new Error("No recommendation IDs returned");
                const take = keepExisting ? FRESH_COUNT : REFRESH_COUNT;
                fresh = await fetchRecommendedDeedIdsWeb(ids.slice(0, take), uid);
                recommendationIdsRef.current = ids;
                recommendationIndexRef.current = take;
                hasMore = ids.length > take;
            } else {
                const page = await fetchChannelPage({
                    tab: "forYou", uid: null,
                    limitCount: keepExisting ? FRESH_COUNT : REFRESH_COUNT
                });
                fresh = page.items.filter(suitable);
                nextCursor = page.cursor;
                hasMore = page.hasMore;
                recommendationIdsRef.current = [];
            }
            if (generationRef.current !== generation || requestRef.current !== request) return;
            if (!fresh.length) throw new Error("Server returned no playable deeds");
            warm(fresh);
            const cached = readCache(uid);
            modify("forYou", (prev) => {
                // Background load appends and preserves playback. Explicit
                // refresh rotates fresh deeds to the FIRST visible positions.
                // Startup preserves the current player; manual refresh replaces it.
                const displayed = keepExisting
                    ? unique([...prev.items, ...fresh])
                    : unique(fresh);
                return {
                    ...prev, items: displayed, cursor: nextCursor,
                    hasMore, loading: false, loadingMore: false, initialized: true,
                };
            });
            // Fresh-first order is used on NEXT startup, without moving the
            // currently playing deed while the present session is open.
            if (keepExisting) {
                writeCache(uid, [...fresh, ...cached]);
            } else {
                // Explicit refresh replaces the old cache, not a merge.
                writeCache(uid, fresh);
                setRefreshVersion(v => v + 1);
            }
            console.info("[ForYouWeb] saved recommendation cache", {
                mode: keepExisting ? "background" : "manual-refresh",
                fresh: fresh.length, saved: readCache(uid).length,
                first4: readCache(uid).slice(0, FIRST_CACHED).map(d => d.id),
            });
        } catch (error) {
            console.warn("WEB_FORYOU_REFRESH_FAILED", error);
            if (generationRef.current !== generation || requestRef.current !== request) return;
            // Network/callable failure: keep cached content on screen.
            modify("forYou", (prev) => ({
                ...prev, loading: false, initialized: true,
                hasMore: prev.items.length ? prev.hasMore : false,
            }));
        } finally {
            busyRef.current.forYou = false;
            if (pendingExplicitRefreshRef.current && generationRef.current === generation) {
                pendingExplicitRefreshRef.current = false;
                void fetchFresh(false);
            }
        }
    }, [uid, modify, warm]);

    const loadInitial = useCallback(async (tab: FeedTabKey) => {
        if (!uid && !publicTab(tab)) return;
        if (tab === "forYou") return fetchFresh(true);
        if (busyRef.current[tab] || stateRef.current[tab].initialized) return;
        busyRef.current[tab] = true;
        const generation = generationRef.current;
        modify(tab, (p) => ({ ...p, loading: true }));
        try {
            const page = await fetchChannelPage({ tab, uid, limitCount: PAGE_SIZE });
            if (generationRef.current !== generation) return;
            warm(page.items);
            modify(tab, (p) => ({
                ...p, items: page.items, cursor: page.cursor,
                hasMore: page.hasMore, loading: false, initialized: true
            }));
        } catch (error) {
            console.warn("WEB_FEED_LOAD_FAILED", tab, error);
            if (generationRef.current === generation)
                modify(tab, (p) => ({ ...p, loading: false, initialized: true, hasMore: false }));
        } finally { busyRef.current[tab] = false; }
    }, [uid, fetchFresh, modify, warm]);

    const loadMore = useCallback(async (tab: FeedTabKey) => {
        const now = stateRef.current[tab];
        if (!now.initialized || !now.hasMore || moreRef.current[tab] || busyRef.current[tab]) return;
        moreRef.current[tab] = true;
        const generation = generationRef.current;
        const request = requestRef.current;
        modify(tab, (p) => ({ ...p, loadingMore: true }));
        try {
            let incoming: Deed[] = [];
            let cursor = now.cursor;
            let hasMore = false;
            if (tab === "forYou" && uid && recommendationIdsRef.current.length) {
                const ids = recommendationIdsRef.current;
                const start = recommendationIndexRef.current;
                const end = Math.min(ids.length, start + PAGE_SIZE);
                incoming = await fetchRecommendedDeedIdsWeb(ids.slice(start, end), uid);
                if (generationRef.current !== generation) return;
                recommendationIndexRef.current = end;
                hasMore = end < ids.length;
            } else {
                const page = await fetchChannelPage({ tab, uid, cursor, limitCount: PAGE_SIZE });
                incoming = page.items;
                cursor = page.cursor;
                hasMore = page.hasMore;
            }
            if (generationRef.current !== generation || (tab === "forYou" && requestRef.current !== request)) return;
            warm(incoming);
            modify(tab, (p) => ({
                ...p, items: unique([...p.items, ...incoming]),
                cursor, hasMore, loadingMore: false
            }));
            if (tab === "forYou" && incoming.length) {
                // Newly fetched pages lead NEXT launch's cache, not today's player.
                writeCache(uid, [...incoming, ...readCache(uid)]);
            }
        } catch (error) {
            console.warn("WEB_FEED_MORE_FAILED", tab, error);
            if (generationRef.current === generation)
                modify(tab, (p) => ({ ...p, loadingMore: false }));
        } finally { moreRef.current[tab] = false; }
    }, [uid, modify, warm]);

    const reload = useCallback(async (tab: FeedTabKey) => {
        if (tab === "forYou") return fetchFresh(false);
        if (!uid && !publicTab(tab)) return;
        if (busyRef.current[tab]) return;
        busyRef.current[tab] = true;
        const generation = generationRef.current;
        modify(tab, (p) => ({ ...p, loading: true }));
        try {
            const page = await fetchChannelPage({ tab, uid, limitCount: PAGE_SIZE });
            if (generationRef.current !== generation) return;
            warm(page.items);
            modify(tab, (p) => ({
                ...p, items: page.items,
                cursor: page.cursor, hasMore: page.hasMore,
                loading: false, initialized: true
            }));
        } catch (error) {
            console.warn("WEB_FEED_REFRESH_FAILED", tab, error);
            if (generationRef.current === generation)
                modify(tab, (p) => ({ ...p, loading: false }));
        } finally { busyRef.current[tab] = false; }
    }, [fetchFresh, uid, modify, warm]);

    // Cache bootstrap happens on account transition, not on every rerender.
    useEffect(() => {
        if (readyUidRef.current === uid) return;
        readyUidRef.current = uid;
        generationRef.current += 1;
        const generation = generationRef.current;
        recommendationIdsRef.current = [];
        recommendationIndexRef.current = 0;
        allTabs.forEach((t) => { busyRef.current[t] = false; moreRef.current[t] = false; });
        stopCacheReveal();
        const cached = readCache(uid);
        const next = initialFeeds();
        if (cached.length) {
            next.forYou = { ...next.forYou, items: cached.slice(0, FIRST_CACHED), initialized: true };
        }
        stateRef.current = next;
        setFeeds(next);
        // Reveal the rest of the metadata cache progressively so a fast swiper
        // never has to wait at the end of the first four while networking runs.
        for (let end = FIRST_CACHED + CACHE_REVEAL_BATCH; end <= cached.length + CACHE_REVEAL_BATCH; end += CACHE_REVEAL_BATCH) {
            const revealEnd = Math.min(end, cached.length);
            if (revealEnd <= FIRST_CACHED) break;
            const index = Math.ceil((revealEnd - FIRST_CACHED) / CACHE_REVEAL_BATCH);
            const timer = setTimeout(() => {
                if (generationRef.current !== generation) return;
                modify("forYou", (prev) => ({
                    ...prev,
                    items: unique([...prev.items, ...cached.slice(FIRST_CACHED, revealEnd)]),
                }));
            }, index * CACHE_REVEAL_INTERVAL_MS);
            cacheRevealTimersRef.current.push(timer);
            if (revealEnd === cached.length) break;
        }
        void fetchFresh(true);
    }, [uid, fetchFresh, modify, stopCacheReveal]);

    useEffect(() => {
        if (!uid && !publicTab(activeTab)) setActiveTab("forYou");
        if (activeTab !== "forYou") void loadInitial(activeTab);
    }, [activeTab, uid, loadInitial]);

    useEffect(() => {
        if (lastRefreshKeyRef.current === refreshKey) return;
        lastRefreshKeyRef.current = refreshKey;
        void reload(activeTab);
    }, [refreshKey, activeTab, reload]);

    useEffect(() => () => stopCacheReveal(), [stopCacheReveal]);

    const currentFeed = useMemo(() => feeds[activeTab], [feeds, activeTab]);
    return { activeTab, setActiveTab, feeds, currentFeed, loadInitial, loadMore, reload, refreshVersion };
}
