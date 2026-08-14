"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    Deed,
    FeedCursor,
    FeedTabKey,
    fetchChannelPage,
} from "../data/deedsFeedWeb";

const PAGE_SIZE = 10;

export type FeedState = {
    items: Deed[];
    cursor: FeedCursor;
    hasMore: boolean;
    loading: boolean;
    loadingMore: boolean;
    initialized: boolean;
};

const EMPTY_FEED: FeedState = {
    items: [],
    cursor: null,
    hasMore: true,
    loading: false,
    loadingMore: false,
    initialized: false,
};

function createFeedsState(): Record<FeedTabKey, FeedState> {
    return {
        trending: { ...EMPTY_FEED },
        forYou: { ...EMPTY_FEED },
        following: { ...EMPTY_FEED },
        nearby: { ...EMPTY_FEED },
    };
}

function createTabBooleanRecord(): Record<FeedTabKey, boolean> {
    return {
        trending: false,
        forYou: false,
        following: false,
        nearby: false,
    };
}

function createTabNumberRecord(): Record<FeedTabKey, number> {
    return {
        trending: 0,
        forYou: 0,
        following: 0,
        nearby: 0,
    };
}

function isPublicTab(tab: FeedTabKey) {
    return tab === "forYou" || tab === "trending";
}

export function useDeedsFeedWeb(params: {
    uid?: string | null;
    warmAuthor?: (authorId: string) => void;
    initialTab?: FeedTabKey;
}) {
    const {
        uid = null,
        warmAuthor,
        initialTab = "forYou",
    } = params;

    const [activeTab, setActiveTab] =
        useState<FeedTabKey>(initialTab);

    const [feeds, setFeeds] =
        useState<Record<FeedTabKey, FeedState>>(
            createFeedsState
        );

    const mounted = useRef(true);

    const feedsRef = useRef(feeds);

    const loadingMoreRef =
        useRef<Record<FeedTabKey, boolean>>(
            createTabBooleanRecord()
        );

    const loadMoreCooldownRef =
        useRef<Record<FeedTabKey, number>>(
            createTabNumberRecord()
        );

    useEffect(() => {
        feedsRef.current = feeds;
    }, [feeds]);

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
        };
    }, []);

    /*
     * Guests may browse Trending and For You.
     * Following and Nearby still require a signed-in user.
     */
    useEffect(() => {
        if (!uid && !isPublicTab(activeTab)) {
            setActiveTab("forYou");
        }
    }, [uid, activeTab]);

    const setFeedState = useCallback(
        (
            tab: FeedTabKey,
            updater: (prev: FeedState) => FeedState
        ) => {
            setFeeds((prev) => ({
                ...prev,
                [tab]: updater(prev[tab]),
            }));
        },
        []
    );

    const warmItems = useCallback(
        (items: Deed[]) => {
            if (!warmAuthor) return;

            items.forEach((item) => {
                if (item?.authorId) {
                    warmAuthor(item.authorId);
                }
            });
        },
        [warmAuthor]
    );

    const loadInitial = useCallback(
        async (tab: FeedTabKey) => {
            const current = feedsRef.current[tab];

            if (current.loading || current.initialized) {
                return;
            }

            if (!uid && !isPublicTab(tab)) {
                return;
            }

            setFeedState(tab, (prev) => ({
                ...prev,
                loading: true,
                loadingMore: false,
            }));

            try {
                const page = await fetchChannelPage({
                    tab,
                    cursor: null,
                    limitCount: PAGE_SIZE,
                    uid,
                });

                const items =
                    Array.isArray(page?.items)
                        ? page.items
                        : [];

                warmItems(items);

                if (!mounted.current) {
                    return;
                }

                setFeedState(tab, () => ({
                    items,
                    cursor: page?.cursor ?? null,
                    hasMore: !!page?.hasMore,
                    loading: false,
                    loadingMore: false,
                    initialized: true,
                }));
            } catch (error) {
                console.log(
                    `${tab} initial load error:`,
                    error
                );

                if (!mounted.current) {
                    return;
                }

                setFeedState(tab, (prev) => ({
                    ...prev,
                    loading: false,
                    loadingMore: false,
                    initialized: true,
                    hasMore: false,
                }));
            }
        },
        [setFeedState, uid, warmItems]
    );

    const loadMore = useCallback(
        async (tab: FeedTabKey) => {
            const current =
                feedsRef.current[tab];

            const now = Date.now();

            if (!current.initialized) return;
            if (current.loading) return;
            if (loadingMoreRef.current[tab]) return;
            if (!current.hasMore) return;

            if (!uid && !isPublicTab(tab)) {
                return;
            }

            if (
                now -
                loadMoreCooldownRef.current[tab] <
                800
            ) {
                return;
            }

            loadingMoreRef.current[tab] = true;
            loadMoreCooldownRef.current[tab] = now;

            setFeedState(tab, (prev) => ({
                ...prev,
                loadingMore: true,
            }));

            try {
                const page =
                    await fetchChannelPage({
                        tab,
                        cursor: current.cursor,
                        limitCount: PAGE_SIZE,
                        uid,
                    });

                const fetchedItems =
                    Array.isArray(page?.items)
                        ? page.items
                        : [];

                warmItems(fetchedItems);

                if (!mounted.current) {
                    return;
                }

                setFeedState(tab, (prev) => {
                    const seen = new Set(
                        prev.items.map((x) => x.id)
                    );

                    const incoming =
                        fetchedItems.filter(
                            (x) => !seen.has(x.id)
                        );

                    return {
                        ...prev,
                        items: [
                            ...prev.items,
                            ...incoming,
                        ],
                        cursor:
                            page?.cursor ?? null,
                        /*
                         * For Trending a page can theoretically contain
                         * already-seen items while still having older
                         * scan windows available, so preserve server
                         * hasMore instead of forcing false on duplicates.
                         */
                        hasMore: !!page?.hasMore,
                        loadingMore: false,
                        initialized: true,
                    };
                });
            } catch (error) {
                console.log(
                    `${tab} loadMore error:`,
                    error
                );

                if (!mounted.current) {
                    return;
                }

                setFeedState(tab, (prev) => ({
                    ...prev,
                    loadingMore: false,
                }));
            } finally {
                loadingMoreRef.current[tab] =
                    false;
            }
        },
        [setFeedState, uid, warmItems]
    );

    const reload = useCallback(
        async (tab: FeedTabKey) => {
            if (!uid && !isPublicTab(tab)) {
                return;
            }

            setFeedState(tab, (prev) => ({
                ...prev,
                loading: prev.items.length === 0,
                loadingMore: false,
            }));

            try {
                const page =
                    await fetchChannelPage({
                        tab,
                        cursor: null,
                        limitCount: PAGE_SIZE,
                        uid,
                    });

                const items =
                    Array.isArray(page?.items)
                        ? page.items
                        : [];

                warmItems(items);

                if (!mounted.current) {
                    return;
                }

                setFeedState(tab, () => ({
                    items,
                    cursor: page?.cursor ?? null,
                    hasMore: !!page?.hasMore,
                    loading: false,
                    loadingMore: false,
                    initialized: true,
                }));
            } catch (error) {
                console.log(
                    `${tab} refresh error:`,
                    error
                );

                if (!mounted.current) {
                    return;
                }

                setFeedState(tab, (prev) => ({
                    ...prev,
                    loading: false,
                    loadingMore: false,
                }));
            }
        },
        [setFeedState, uid, warmItems]
    );

    /*
     * Reset all channel caches whenever the signed-in account changes.
     * This also refreshes public channels so blocked-user filtering is
     * recalculated for the new viewer.
     *
     * loadInitial(activeTab) below performs the actual fresh request.
     */
    useEffect(() => {
        const reset = createFeedsState();

        setFeeds(reset);
        feedsRef.current = reset;

        loadingMoreRef.current =
            createTabBooleanRecord();

        loadMoreCooldownRef.current =
            createTabNumberRecord();
    }, [uid]);

    useEffect(() => {
        loadInitial(activeTab);
    }, [activeTab, loadInitial]);

    const currentFeed = useMemo(
        () => feeds[activeTab],
        [feeds, activeTab]
    );

    return {
        activeTab,
        setActiveTab,
        feeds,
        currentFeed,
        loadInitial,
        loadMore,
        reload,
    };
}