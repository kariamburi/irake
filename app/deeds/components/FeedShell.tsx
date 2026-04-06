"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { FeedTabKey, Deed } from "../data/deedsFeedWeb";
import { useDeedsFeedWeb } from "../hooks/useDeedsFeedWeb";
import { GlobalMuteProviderWeb } from "../hooks/useGlobalMuteWeb";
import { DeedsScrollerWeb } from "./DeedsScrollerWeb";
import RightRail from "@/app/components/RightRail";
import { DesktopDeedRailWeb } from "./DesktopDeedRailWeb";
import { DeedsTopBar } from "./DeedsTopBar";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import { DeedStageShell } from "./DeedStageShell";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Props = {
    uid?: string | null;
    profile?: {
        photoURL?: string | null;
        handle?: string | null;
        name?: string | null;
    } | null;
    warmAuthor?: (authorId: string) => void;
    cardH?: number;
    dataSaverOn?: boolean;
    hlsMaxHeight?: number;
    onOpenMenu?: () => void;
    loading?: boolean;
    refreshKey?: number;
};

function useIsDesktop(breakpoint = 1024) {
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        const update = () => setIsDesktop(window.innerWidth >= breakpoint);
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, [breakpoint]);

    return isDesktop;
}

function isTypingTarget(target: EventTarget | null) {
    const el = target as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    return tag === "input" || tag === "textarea" || el.isContentEditable;
}

export function FeedShell(props: Props) {
    const { refreshKey = 0 } = props;

    const [persistedTab, setPersistedTab] = useState<FeedTabKey>("forYou");
    const [instanceKey, setInstanceKey] = useState(0);

    useEffect(() => {
        if (!refreshKey) return;
        setInstanceKey((prev) => prev + 1);
    }, [refreshKey]);

    return (
        <FeedShellInner
            key={`${persistedTab}-${instanceKey}`}
            {...props}
            initialTab={persistedTab}
            onTabChangePersist={setPersistedTab}
        />
    );
}

type FeedShellInnerProps = Props & {
    initialTab: FeedTabKey;
    onTabChangePersist: (tab: FeedTabKey) => void;
};

function FeedShellInner({
    uid,
    profile,
    warmAuthor,
    cardH,
    dataSaverOn = false,
    hlsMaxHeight,
    onOpenMenu,
    loading,
    initialTab,
    onTabChangePersist,
}: FeedShellInnerProps) {
    const router = useRouter();
    const scrollerRef = useRef<HTMLDivElement | null>(null);

    const [commentsId, setCommentsId] = useState<string | null>(null);
    const [commentedMap, setCommentedMap] = useState<Record<string, boolean>>({});
    const [activeDeedId, setActiveDeedId] = useState<string | null>(null);
    const [activeDeed, setActiveDeed] = useState<Deed | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [following, setFollowing] = useState<Set<string>>(new Set());

    const isDesktop = useIsDesktop();

    const feed = useDeedsFeedWeb({
        uid,
        warmAuthor,
        initialTab,
    });

    const currentFeed = feed.currentFeed;

    const pageHeight =
        cardH || (typeof window !== "undefined" ? window.innerHeight : 800);

    const showLoading = loading || (currentFeed.loading && !currentFeed.initialized);

    const emptyText = useMemo(() => {
        if (feed.activeTab === "following") {
            return uid
                ? "Follow creators to see their latest deeds."
                : "Sign in to see deeds from creators you follow.";
        }

        if (feed.activeTab === "nearby") {
            return uid
                ? "No nearby deeds yet."
                : "Sign in to see nearby deeds.";
        }

        return "No deeds yet.";
    }, [feed.activeTab, uid]);

    const openComments = (deedId: string) => {
        setCommentsId(deedId);
    };

    const closeComments = () => {
        setCommentsId(null);
    };

    const markCommented = (deedId: string) => {
        setCommentedMap((prev) => ({
            ...prev,
            [deedId]: true,
        }));
    };

    const handleActiveItemChange = (item: Deed, index: number) => {
        setActiveDeedId(item.id);
        setActiveDeed(item);
        setActiveIndex(index);
    };

    useEffect(() => {
        if (!commentsId) return;
        if (!activeDeedId) return;
        if (commentsId === activeDeedId) return;

        setCommentsId(activeDeedId);
    }, [activeDeedId, commentsId]);

    useEffect(() => {
        if (!uid) {
            setFollowing(new Set());
            return;
        }

        const q = query(
            collection(db, "follows"),
            where("followerId", "==", uid)
        );

        const unsub = onSnapshot(
            q,
            (snap) => {
                const next = new Set<string>();

                snap.forEach((docSnap) => {
                    const data = docSnap.data() as { followingId?: unknown };
                    if (typeof data?.followingId === "string" && data.followingId.trim()) {
                        next.add(data.followingId.trim());
                    }
                });

                setFollowing(next);
            },
            (error) => {
                console.error("FOLLOWING_SNAPSHOT_FAILED", {
                    error,
                    uid,
                });
                setFollowing(new Set());
            }
        );

        return () => {
            try {
                unsub();
            } catch { }
        };
    }, [uid]);

    const goToIndex = React.useCallback(
        (nextIndex: number) => {
            const root = scrollerRef.current;
            if (!root) return;
            const maxIndex = Math.max(0, currentFeed.items.length - 1);
            const clamped = Math.max(0, Math.min(maxIndex, nextIndex));
            root.scrollTo({
                top: clamped * pageHeight,
                behavior: "smooth",
            });
        },
        [currentFeed.items.length, pageHeight]
    );

    const goPrev = React.useCallback(() => {
        goToIndex(activeIndex - 1);
    }, [activeIndex, goToIndex]);

    const goNext = React.useCallback(() => {
        goToIndex(activeIndex + 1);
    }, [activeIndex, goToIndex]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (isTypingTarget(e.target)) return;

            if (e.key === "ArrowDown" || e.key === "PageDown") {
                e.preventDefault();
                goNext();
                return;
            }

            if (e.key === "ArrowUp" || e.key === "PageUp") {
                e.preventDefault();
                goPrev();
            }
        };

        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [goNext, goPrev]);

    useEffect(() => {
        if (!uid) {
            setCommentedMap({});
            return;
        }

        const visibleIds = currentFeed.items
            .slice(Math.max(0, activeIndex - 2), Math.min(currentFeed.items.length, activeIndex + 5))
            .map((d) => d.id)
            .filter(Boolean);

        if (!visibleIds.length) return;

        const unsubs: Array<() => void> = [];

        visibleIds.forEach((deedId) => {
            const q = query(
                collection(db, "comments"),
                where("deedId", "==", deedId),
                where("userId", "==", uid),
                limit(1)
            );

            const unsub = onSnapshot(q, (snap) => {
                setCommentedMap((prev) => {
                    const next = !snap.empty;
                    if (prev[deedId] === next) return prev;

                    return {
                        ...prev,
                        [deedId]: next,
                    };
                });
            });

            unsubs.push(unsub);
        });

        return () => {
            unsubs.forEach((fn) => {
                try {
                    fn();
                } catch { }
            });
        };
    }, [uid, activeIndex, currentFeed.items]);

    const desktopRailOpen = isDesktop && !!commentsId;
    const canGoPrev = activeIndex > 0;
    const canGoNext = activeIndex < currentFeed.items.length - 1;

    const loadingMoreRef = useRef(false);

    useEffect(() => {
        loadingMoreRef.current = !!currentFeed.loadingMore;
    }, [currentFeed.loadingMore]);

    useEffect(() => {
        setActiveIndex(0);
        setActiveDeedId(currentFeed.items[0]?.id ?? null);
        setActiveDeed(currentFeed.items[0] ?? null);

        const root = scrollerRef.current;
        if (root) {
            root.scrollTo({ top: 0, behavior: "auto" });
        }
    }, [feed.activeTab]);

    return (
        <GlobalMuteProviderWeb initialMuted={true}>
            <div className="relative h-[100svh] w-full overflow-hidden text-white">
                <div className="flex h-full w-full">
                    <div className="relative h-full min-w-0 flex-1 overflow-hidden">
                        <div className="mx-auto flex h-full w-full max-w-[980px] items-stretch justify-center gap-4 xl:gap-6">
                            <div className="relative flex h-full w-full items-stretch justify-center gap-4 lg:min-w-0 xl:gap-6">
                                <section
                                    ref={scrollerRef}
                                    tabIndex={0}
                                    className="h-[100svh] w-full overflow-y-scroll outline-none no-scrollbar lg:w-[420px] xl:w-[460px]"
                                    style={{
                                        scrollSnapType: "y mandatory",
                                        overscrollBehaviorY: "contain",
                                        paddingBottom:
                                            showLoading || (!currentFeed.loading && currentFeed.items.length === 0)
                                                ? "0px"
                                                : isDesktop
                                                    ? "0px"
                                                    : "calc(72px + env(safe-area-inset-bottom))",
                                    }}
                                >
                                    <DeedsTopBar
                                        uid={uid}
                                        profile={profile}
                                        activeTab={feed.activeTab}
                                        isDesktop={isDesktop}
                                        onChangeTab={(k) => {
                                            const locked = !uid && k !== "forYou";
                                            if (locked) {
                                                router.push("/getstarted?next=/deeds");
                                                return;
                                            }

                                            onTabChangePersist(k);
                                            feed.setActiveTab(k);
                                        }}
                                        onOpenSearch={() => router.push("/search")}
                                        onOpenProfile={() =>
                                            router.push(
                                                uid
                                                    ? `/${profile?.handle ?? ""}`
                                                    : "/getstarted?next=/deeds"
                                            )
                                        }
                                        onOpenDive={() => router.push("/nexus")}
                                        onOpenMenu={onOpenMenu}
                                    />

                                    {showLoading && (
                                        <DeedStageShell>
                                            <div className="text-sm text-white/80">
                                                <BouncingBallLoader />
                                            </div>
                                        </DeedStageShell>
                                    )}

                                    {!currentFeed.loading && currentFeed.items.length === 0 ? (
                                        <DeedStageShell>
                                            <div className="text-sm text-white/80">
                                                {emptyText}
                                            </div>
                                        </DeedStageShell>
                                    ) : (
                                        <DeedsScrollerWeb
                                            items={currentFeed.items}
                                            uid={uid}
                                            cardH={pageHeight}
                                            scrollerRef={scrollerRef}
                                            commentedMap={commentedMap}
                                            dataSaverOn={dataSaverOn}
                                            hlsMaxHeight={hlsMaxHeight}
                                            loading={currentFeed.loading}
                                            onNeedMore={(index) => {
                                                const remaining = currentFeed.items.length - 1 - index;

                                                if (remaining <= 4 && !loadingMoreRef.current && currentFeed.hasMore) {
                                                    feed.loadMore(feed.activeTab);
                                                }
                                            }}
                                            onOpenComments={openComments}
                                            onActiveItemChange={handleActiveItemChange}
                                        />
                                    )}

                                    {currentFeed.loadingMore && currentFeed.items.length > 0 && (
                                        <div className="pointer-events-none fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white/90 backdrop-blur-md">
                                            Loading more.
                                        </div>
                                    )}
                                </section>

                                {isDesktop ? (
                                    <div className="hidden w-[96px] items-center justify-center lg:flex xl:w-[108px]">
                                        <DesktopDeedRailWeb
                                            item={activeDeed}
                                            uid={uid}
                                            following={following}
                                            commented={activeDeed ? !!commentedMap[activeDeed.id] : false}
                                            onOpenComments={openComments}
                                            onPrev={goPrev}
                                            onNext={goNext}
                                            canGoPrev={canGoPrev}
                                            canGoNext={canGoNext}
                                        />
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    {isDesktop ? (
                        <div
                            className={[
                                "hidden h-full shrink-0 bg-white transition-all duration-300 lg:block",
                                desktopRailOpen ? "w-[400px]" : "w-0",
                            ].join(" ")}
                        >
                            <RightRail
                                open={!!commentsId}
                                mode="sidebar"
                                deedId={commentsId ?? undefined}
                                onClose={closeComments}
                                onsuccesfulcomment={markCommented}
                                currentUser={{
                                    uid: uid || undefined,
                                    photoURL: profile?.photoURL ?? undefined,
                                    handle: profile?.handle ?? undefined,
                                    name: profile?.name ?? undefined,
                                }}
                            />
                        </div>
                    ) : null}
                </div>

                {!isDesktop ? (
                    <div
                        className={[
                            "fixed inset-0 z-[90] transition",
                            commentsId ? "pointer-events-auto" : "pointer-events-none",
                        ].join(" ")}
                        aria-hidden={!commentsId}
                    >
                        <div
                            className={[
                                "absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity",
                                commentsId ? "opacity-100" : "opacity-0",
                            ].join(" ")}
                            onClick={closeComments}
                        />

                        <div
                            className={[
                                "absolute inset-x-0 bottom-0 h-[82vh] max-h-[90vh]",
                                "rounded-t-2xl bg-white shadow-xl",
                                "transition-transform duration-300 will-change-transform",
                                commentsId ? "translate-y-0" : "translate-y-full",
                            ].join(" ")}
                            role="dialog"
                            aria-modal="true"
                        >
                            <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-gray-300" />

                            <div className="h-[calc(100%-12px)]">
                                <RightRail
                                    open={!!commentsId}
                                    mode="sheet"
                                    deedId={commentsId ?? undefined}
                                    onClose={closeComments}
                                    onsuccesfulcomment={markCommented}
                                    currentUser={{
                                        uid: uid || undefined,
                                        photoURL: profile?.photoURL ?? undefined,
                                        handle: profile?.handle ?? undefined,
                                        name: profile?.name ?? undefined,
                                    }}
                                    className="!flex !h-full !w-full"
                                />
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </GlobalMuteProviderWeb>
    );
}