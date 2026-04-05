"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    query,
    where,
} from "firebase/firestore";

import OpenInAppBanner from "@/app/components/OpenInAppBanner";
import { EkariSideMenuSheet } from "@/app/components/EkariSideMenuSheet";
import RightRail from "@/app/components/RightRail";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";

import { db } from "@/lib/firebase";
import { useInboxTotalsWeb } from "@/hooks/useInboxTotalsWeb";
import { useAuth } from "@/app/hooks/useAuth";
import { useUserProfile } from "@/app/providers/UserProfileProvider";

import {
    fetchAuthorPageExcluding,
    type Deed,
    type FeedCursor,
} from "@/app/deeds/data/deedsFeedWeb";
import { DeedsScrollerWeb } from "@/app/deeds/components/DeedsScrollerWeb";
import { DesktopDeedRailWeb } from "@/app/deeds/components/DesktopDeedRailWeb";
import { GlobalMuteProviderWeb } from "@/app/deeds/hooks/useGlobalMuteWeb";
import { IoArrowBack } from "react-icons/io5";

type Props = {
    handle: string;
    deedId: string;
    startDeedId?: string;
};

type ResolvedAuthor = {
    authorId: string;
    handle: string | null;
    name: string | null;
    photoURL: string | null;
    selectedDeed?: Deed | null;
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

function useWarmAuthorStub() {
    return React.useCallback((_authorId: string) => {
        // no-op for now
    }, []);
}

function cleanHandleValue(raw: string | null | undefined) {
    return String(raw ?? "").trim().replace(/^@/, "");
}

function mapPinnedDeedFromDoc(docSnap: any): Deed | null {
    const d = typeof docSnap?.data === "function" ? docSnap.data() : null;
    if (!d) return null;

    const id = String(docSnap.id ?? "");
    const authorId = String(d?.authorId ?? "").trim();

    if (!id || !authorId) return null;

    return {
        id,
        authorId,

        authorUsername:
            typeof d?.authorUsername === "string" ? d.authorUsername : undefined,

        authorPhotoURL:
            typeof d?.authorPhotoURL === "string" ? d.authorPhotoURL : undefined,

        muxPlaybackId:
            typeof d?.muxPlaybackId === "string"
                ? d.muxPlaybackId
                : typeof d?.playbackId === "string"
                    ? d.playbackId
                    : typeof d?.mux?.playbackId === "string"
                        ? d.mux.playbackId
                        : undefined,

        posterUrl:
            d?.posterUrl ??
            d?.thumbnailUrl ??
            d?.thumbUrl ??
            d?.mux?.thumbnailUrl ??
            null,

        mediaUrl:
            d?.mediaUrl ??
            d?.videoUrl ??
            null,

        mediaType:
            d?.muxPlaybackId || d?.mediaUrl || d?.videoUrl
                ? "video"
                : "photo",

        text:
            d?.text ??
            d?.caption ??
            d?.description ??
            "",

        createdAt: d?.createdAt ?? null,
        visibility:
            d?.visibility === "public" ||
                d?.visibility === "followers" ||
                d?.visibility === "private"
                ? d.visibility
                : "public",

        tags: Array.isArray(d?.tags) ? d.tags.filter((x: any) => typeof x === "string") : [],

        stats: {
            views: Number(d?.stats?.views ?? d?.views ?? 0),
            likes: Number(d?.stats?.likes ?? d?.likes ?? 0),
            saves: Number(d?.stats?.saves ?? d?.saves ?? d?.bookmarks ?? 0),
            comments: Number(d?.stats?.comments ?? d?.comments ?? 0),
            shares: Number(d?.stats?.shares ?? d?.shares ?? 0),
            bookmarks:
                d?.stats?.bookmarks != null || d?.bookmarks != null
                    ? Number(d?.stats?.bookmarks ?? d?.bookmarks ?? 0)
                    : undefined,
            completions:
                d?.stats?.completions != null ? Number(d.stats.completions) : undefined,
            watchMs:
                d?.stats?.watchMs != null ? Number(d.stats.watchMs) : undefined,
        },

        durationMs: d?.durationMs != null ? Number(d.durationMs) : undefined,
        music: d?.music ?? undefined,
        authorBadge: d?.authorBadge ?? undefined,

        media: Array.isArray(d?.media) ? d.media : [],
        photoItems: Array.isArray(d?.media)
            ? d.media
                .filter((m: any) => {
                    const kind = String(m?.mediaType ?? m?.kind ?? "").toLowerCase();
                    return kind === "photo" || kind === "image" || !!m?.url || !!m?.sources?.full;
                })
                .map((m: any) => ({
                    url: m?.sources?.full ?? m?.url ?? "",
                    previewUrl: m?.sources?.small ?? m?.thumbUrl ?? null,
                }))
                .filter((p: any) => !!p.url)
            : [],

        type:
            d?.muxPlaybackId || d?.mediaUrl || d?.videoUrl
                ? "video"
                : "photo",

        aspectRatio: d?.aspectRatio != null ? String(d.aspectRatio) : null,
        videoWidth: d?.videoWidth != null ? Number(d.videoWidth) : null,
        videoHeight: d?.videoHeight != null ? Number(d.videoHeight) : null,
        orientation: null,

        countyTag: d?.countyTag != null ? String(d.countyTag) : null,
        countryTag: d?.countryTag != null ? String(d.countryTag) : null,
        status: d?.status != null ? String(d.status).toLowerCase() : null,
        aspectRatioValue: null,
    };
}

async function resolveAuthorFromRoute(handle: string, deedId: string): Promise<ResolvedAuthor | null> {

    const cleanHandle = cleanHandleValue(handle);

    if (deedId) {
        try {
            const deedSnap = await getDoc(doc(db, "deeds", deedId));
            if (deedSnap.exists()) {

                const d = deedSnap.data() as any;
                const authorId = String(d?.authorId ?? "").trim();
                const selectedDeed = mapPinnedDeedFromDoc(deedSnap);

                if (authorId) {
                    return {
                        authorId,
                        handle: cleanHandleValue(d?.authorUsername || cleanHandle) || null,
                        name: null,
                        photoURL: typeof d?.authorPhotoURL === "string" ? d.authorPhotoURL : null,
                        selectedDeed,
                    };
                }
            }
        } catch (error) {
            console.warn("resolveAuthorFromRoute deed lookup failed:", error);
        }
    }

    if (!cleanHandle) return null;

    try {
        const candidates = [cleanHandle, `@${cleanHandle}`];

        for (const candidate of candidates) {
            const snap = await getDocs(
                query(collection(db, "users"), where("handle", "==", candidate), limit(1))
            );

            if (!snap.empty) {
                const userDoc = snap.docs[0];
                const data = userDoc.data() as any;

                return {
                    authorId: userDoc.id,
                    handle: cleanHandleValue(data?.handle || candidate) || null,
                    name:
                        typeof data?.name === "string"
                            ? data.name
                            : [data?.firstName, data?.surname].filter(Boolean).join(" ") || null,
                    photoURL: typeof data?.photoURL === "string" ? data.photoURL : null,
                    selectedDeed: null,
                };
            }
        }
    } catch (error) {
        console.warn("resolveAuthorFromRoute handle lookup failed:", error);
    }

    return null;
}

export default function AuthorDeedPageClient({
    handle,
    deedId,
    startDeedId,
}: Props) {
    const router = useRouter();
    const isDesktop = useIsDesktop();
    const scrollerRef = useRef<HTMLDivElement | null>(null);

    const { user, loading: authLoading, signOutUser } = useAuth();
    const { profile, loading: profileLoading } = useUserProfile();
    const { unreadDM, notifTotal } = useInboxTotalsWeb(!!user?.uid, user?.uid);

    const warmAuthor = useWarmAuthorStub();

    const [menuOpen, setMenuOpen] = useState(false);
    const [author, setAuthor] = useState<ResolvedAuthor | null>(null);
    const [items, setItems] = useState<Deed[]>([]);
    const [cursor, setCursor] = useState<FeedCursor>(null);
    const [hasMore, setHasMore] = useState(false);
    const [initialIndex, setInitialIndex] = useState(0);
    const [pageLoading, setPageLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);

    const [commentsId, setCommentsId] = useState<string | null>(null);
    const [commentedMap, setCommentedMap] = useState<Record<string, boolean>>({});
    const [activeDeed, setActiveDeed] = useState<Deed | null>(null);
    const [activeDeedId, setActiveDeedId] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [following, setFollowing] = useState<Set<string>>(new Set());

    const loading = authLoading || profileLoading || pageLoading;
    const pageHeight = typeof window !== "undefined" ? window.innerHeight : 800;

    const profileHref = useMemo(() => {
        const myHandle = (profile as any)?.handle ?? null;
        return myHandle ? `/${myHandle}` : "/getstarted";
    }, [profile]);

    const profileForShell = useMemo(
        () => ({
            photoURL: profile?.photoURL ?? (user as any)?.photoURL ?? null,
            handle: profile?.handle ?? null,
            name:
                (profile as any)?.name ??
                [((profile as any)?.firstName), ((profile as any)?.surname)]
                    .filter(Boolean)
                    .join(" ") ??
                null,
        }),
        [profile, user]
    );

    const selectedDeedId = String(deedId ?? "").trim();

    const openComments = useCallback((nextDeedId: string) => {
        setCommentsId(nextDeedId);
    }, []);

    const closeComments = useCallback(() => {
        setCommentsId(null);
    }, []);

    const markCommented = useCallback((nextDeedId: string) => {
        setCommentedMap((prev) => ({
            ...prev,
            [nextDeedId]: true,
        }));
    }, []);

    const handleActiveItemChange = useCallback(
        (item: Deed, index: number) => {
            setActiveDeed(item);
            setActiveDeedId(item.id);
            setActiveIndex(index);

            const nextHandle = cleanHandleValue(item.authorUsername || author?.handle || handle);
            const nextHref = `/${nextHandle}/deed/${item.id}`;
            window.history.replaceState(null, "", nextHref);
        },
        [author?.handle, handle]
    );

    useEffect(() => {
        let cancelled = false;

        async function run() {
            setPageLoading(true);
            setErrorText(null);

            try {

                const resolvedAuthor = await resolveAuthorFromRoute(handle, selectedDeedId);

                if (!resolvedAuthor?.authorId) {
                    if (!cancelled) {
                        setAuthor(null);
                        setItems([]);
                        setHasMore(false);
                        setCursor(null);
                        setInitialIndex(0);
                        setErrorText("Creator not found.");
                    }
                    return;
                }

                if (cancelled) return;

                setAuthor(resolvedAuthor);
                warmAuthor(resolvedAuthor.authorId);

                const selectedDeed = resolvedAuthor.selectedDeed ?? null;

                if (!selectedDeed) {
                    if (!cancelled) {
                        setItems([]);
                        setCursor(null);
                        setHasMore(false);
                        setInitialIndex(0);
                        setErrorText("Selected deed not found.");
                    }
                    return;
                }

                const restPack = await fetchAuthorPageExcluding(
                    resolvedAuthor.authorId,
                    [selectedDeed.id],
                    null,
                    10,
                    user?.uid ?? null
                );

                if (cancelled) return;

                setItems([selectedDeed, ...restPack.items]);
                setCursor(restPack.cursor);
                setHasMore(restPack.hasMore);
                setInitialIndex(0);
                setActiveDeed(selectedDeed);
                setActiveDeedId(selectedDeed.id);
                setActiveIndex(0);
            } catch (error) {
                console.error("AUTHOR_DEED_ROUTE_LOAD_FAILED", error);
                if (!cancelled) {
                    setErrorText("Failed to load this deed.");
                }
            } finally {
                if (!cancelled) {
                    setPageLoading(false);
                }
            }
        }

        run();

        return () => {
            cancelled = true;
        };
    }, [handle, selectedDeedId, user?.uid, warmAuthor]);

    useEffect(() => {
        if (!user?.uid) {
            setFollowing(new Set());
            return;
        }

        const q = query(
            collection(db, "follows"),
            where("followerId", "==", user.uid)
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
                console.error("FOLLOWING_SNAPSHOT_FAILED", { error, uid: user?.uid });
                setFollowing(new Set());
            }
        );

        return () => {
            try {
                unsub();
            } catch { }
        };
    }, [user?.uid]);

    useEffect(() => {
        if (!commentsId) return;
        if (!activeDeedId) return;
        if (commentsId === activeDeedId) return;

        setCommentsId(activeDeedId);
    }, [activeDeedId, commentsId]);

    useEffect(() => {
        if (!user?.uid) {
            setCommentedMap({});
            return;
        }

        const visibleIds = items
            .slice(Math.max(0, activeIndex - 2), Math.min(items.length, activeIndex + 5))
            .map((d) => d.id)
            .filter(Boolean);

        if (!visibleIds.length) return;

        const unsubs: Array<() => void> = [];

        visibleIds.forEach((visibleDeedId) => {
            const q = query(
                collection(db, "comments"),
                where("deedId", "==", visibleDeedId),
                where("userId", "==", user.uid),
                limit(1)
            );

            const unsub = onSnapshot(q, (snap) => {
                setCommentedMap((prev) => {
                    const next = !snap.empty;
                    if (prev[visibleDeedId] === next) return prev;

                    return {
                        ...prev,
                        [visibleDeedId]: next,
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
    }, [user?.uid, activeIndex, items]);

    const loadMore = useCallback(async () => {
        if (!author?.authorId || !hasMore || loadingMore) return;

        try {
            setLoadingMore(true);

            const pinnedId = items[0]?.id ? [items[0].id] : [];

            const page = await fetchAuthorPageExcluding(
                author.authorId,
                pinnedId,
                cursor,
                8,
                user?.uid ?? null
            );

            setItems((prev) => {
                const seen = new Set(prev.map((x) => x.id));
                const next = [...prev];

                for (const item of page.items) {
                    if (!seen.has(item.id)) {
                        seen.add(item.id);
                        next.push(item);
                    }
                }

                return next;
            });

            setCursor(page.cursor);
            setHasMore(page.hasMore);
        } catch (error) {
            console.error("AUTHOR_DEED_LOAD_MORE_FAILED", error);
        } finally {
            setLoadingMore(false);
        }
    }, [author?.authorId, hasMore, loadingMore, cursor, user?.uid, items]);

    const goToIndex = useCallback(
        (nextIndex: number) => {
            const root = scrollerRef.current;
            if (!root) return;

            const maxIndex = Math.max(0, items.length - 1);
            const clamped = Math.max(0, Math.min(maxIndex, nextIndex));

            root.scrollTo({
                top: clamped * pageHeight,
                behavior: "smooth",
            });
        },
        [items.length, pageHeight]
    );

    const goPrev = useCallback(() => {
        goToIndex(activeIndex - 1);
    }, [activeIndex, goToIndex]);

    const goNext = useCallback(() => {
        goToIndex(activeIndex + 1);
    }, [activeIndex, goToIndex]);

    const canGoPrev = activeIndex > 0;
    const canGoNext = activeIndex < items.length - 1;
    const desktopRailOpen = isDesktop && !!commentsId;

    const contentLoading = (
        <div className="relative min-h-[100svh]">
            <OpenInAppBanner
                webUrl={typeof window !== "undefined" ? window.location.href : "https://ekarihub.com/"}
                appUrl="ekarihub://"
                title="Open ekarihub"
                subtitle="Best experience in the app."
            />

            <div className="flex h-[100svh] w-full items-center justify-center">
                <div className="flex h-full w-full items-center justify-center bg-black px-6 text-center text-sm text-white/80">
                    <BouncingBallLoader />
                </div>
            </div>
        </div>
    );

    const contentError = (
        <div className="relative min-h-[100svh] bg-black text-white">
            <OpenInAppBanner
                webUrl={typeof window !== "undefined" ? window.location.href : "https://ekarihub.com/"}
                appUrl="ekarihub://"
                title="Open ekarihub"
                subtitle="Best experience in the app."
            />

            <div className="mx-auto flex min-h-[100svh] max-w-2xl flex-col items-center justify-center px-6 text-center">
                <h1 className="text-xl font-bold">{errorText || "Something went wrong"}</h1>
                <button
                    type="button"
                    onClick={() => router.push(`/${cleanHandleValue(handle)}`)}
                    className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black"
                >
                    Open profile
                </button>
            </div>
        </div>
    );

    const contentEmpty = (
        <div className="relative min-h-[100svh] bg-black text-white">
            <OpenInAppBanner
                webUrl={typeof window !== "undefined" ? window.location.href : "https://ekarihub.com/"}
                appUrl="ekarihub://"
                title="Open ekarihub"
                subtitle="Best experience in the app."
            />

            <div className="mx-auto flex min-h-[100svh] max-w-2xl flex-col items-center justify-center px-6 text-center">
                <h1 className="text-xl font-bold">No deeds found</h1>
                <p className="mt-2 text-sm text-white/70">
                    This creator does not have visible deeds yet.
                </p>
            </div>
        </div>
    );

    const contentLive = (
        <GlobalMuteProviderWeb initialMuted={true}>
            <div className="relative min-h-[100svh] bg-black text-white">
                <OpenInAppBanner
                    webUrl={typeof window !== "undefined" ? window.location.href : "https://ekarihub.com/"}
                    appUrl="ekarihub://"
                    title="Open ekarihub"
                    subtitle="Best experience in the app."
                />

                <div className="relative h-[100svh] w-full overflow-hidden text-white">
                    <div className="flex h-full w-full">
                        <div className="relative h-full min-w-0 flex-1 overflow-hidden">
                            <div className="mx-auto flex h-full w-full max-w-[980px] items-stretch justify-center gap-4 xl:gap-6">
                                <div className="relative flex h-full w-full items-stretch justify-center gap-4 xl:gap-6">
                                    <section
                                        ref={scrollerRef}
                                        tabIndex={0}
                                        className="h-[100svh] w-full overflow-y-scroll scroll-smooth outline-none no-scrollbar lg:w-[420px] xl:w-[460px]"
                                        style={{
                                            scrollSnapType: "y mandatory",
                                            overscrollBehaviorY: "contain",
                                            paddingBottom: isDesktop
                                                ? "0px"
                                                : "calc(72px + env(safe-area-inset-bottom))",
                                        }}
                                    >
                                        <div className="sticky top-0 z-40 border-b border-white/10 bg-black/35 backdrop-blur-md">
                                            <div className="mx-auto flex h-14 w-full max-w-[460px] items-center gap-3 px-4">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        router.push(`/${cleanHandleValue(author?.handle || handle)}`)
                                                    }
                                                    className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/10 text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition hover:bg-white/15 active:scale-[0.98]"
                                                    aria-label="Go back"
                                                >
                                                    <IoArrowBack className="text-[18px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]" />
                                                </button>

                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-sm font-bold tracking-[0.01em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,1)]">
                                                        @{cleanHandleValue(author?.handle || handle)}
                                                    </div>
                                                    <div className="truncate text-[11px] font-medium text-white/75 drop-shadow-[0_1px_6px_rgba(0,0,0,0.95)]">
                                                        Creator deeds
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {items.length === 0 ? (
                                            <div className="grid h-[calc(100svh-56px)] place-items-center text-sm text-white/70">
                                                No deeds yet.
                                            </div>
                                        ) : (
                                            <DeedsScrollerWeb
                                                items={items}
                                                uid={user?.uid ?? null}
                                                cardH={pageHeight}
                                                scrollerRef={scrollerRef}
                                                commentedMap={commentedMap}
                                                loading={loadingMore}
                                                onNeedMore={(index) => {
                                                    const remaining = items.length - 1 - index;
                                                    if (remaining <= 4) {
                                                        loadMore();
                                                    }
                                                }}
                                                onOpenComments={openComments}
                                                onActiveItemChange={handleActiveItemChange}
                                                initialIndex={initialIndex}
                                            />
                                        )}

                                        {loadingMore && items.length > 0 && (
                                            <div className="pointer-events-none fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white/90 backdrop-blur-md">
                                                Loading more.
                                            </div>
                                        )}
                                    </section>

                                    {isDesktop ? (
                                        <div className="hidden lg:flex w-[96px] xl:w-[108px] items-center justify-center">
                                            <DesktopDeedRailWeb
                                                item={activeDeed}
                                                uid={user?.uid ?? null}
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
                                    "hidden lg:block bg-white h-full shrink-0 transition-all duration-300",
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
                                        uid: user?.uid || undefined,
                                        photoURL: profileForShell.photoURL ?? undefined,
                                        handle: profileForShell.handle ?? undefined,
                                        name: profileForShell.name ?? undefined,
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
                                            uid: user?.uid || undefined,
                                            photoURL: profileForShell.photoURL ?? undefined,
                                            handle: profileForShell.handle ?? undefined,
                                            name: profileForShell.name ?? undefined,
                                        }}
                                        className="!flex !h-full !w-full"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>

                <EkariSideMenuSheet
                    open={menuOpen}
                    onClose={() => setMenuOpen(false)}
                    uid={user?.uid}
                    handle={(profile as any)?.handle ?? null}
                    photoURL={(profile as any)?.photoURL ?? null}
                    profileHref={profileHref}
                    unreadDM={user?.uid ? unreadDM ?? 0 : 0}
                    notifTotal={user?.uid ? notifTotal ?? 0 : 0}
                    onLogout={signOutUser}
                />
            </div>
        </GlobalMuteProviderWeb>
    );

    if (loading) {
        return <div>{contentLoading}</div>;
    }

    if (errorText) {
        return <div>{contentError}</div>;
    }

    if (!items.length) {
        return <div>{contentEmpty}</div>;
    }

    return <div>{contentLive}</div>;
}