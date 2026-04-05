"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IoClose, IoMenu, IoSearch } from "react-icons/io5";


import RightRail from "@/app/components/RightRail";
import { FeedTabKey } from "./deeds/data/deedsFeedWeb";
import { useDeedsFeedWeb } from "./deeds/hooks/useDeedsFeedWeb";
import { DeedsScrollerWeb } from "./deeds/components/DeedsScrollerWeb";

const TABS: FeedTabKey[] = ["forYou", "following", "nearby"];

const LABEL: Record<FeedTabKey, string> = {
    forYou: "For You",
    following: "Following",
    nearby: "Nearby",
};

const DESKTOP_BREAKPOINT = 1024;
const DESKTOP_LEFT_W = 320;
const DESKTOP_RAIL_W = 380;

type FeedShellProfile = {
    photoURL?: string | null;
    handle?: string | null;
    firstName?: string | null;
    surname?: string | null;
} | null;

type Props = {
    uid?: string | null;
    profile?: FeedShellProfile;
    warmAuthor?: (authorId: string) => void;
    dataSaverOn?: boolean;
    hlsMaxHeight?: number;
    onOpenMenu?: () => void;
};

function cx(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(" ");
}

function useIsDesktop() {
    const [desktop, setDesktop] = useState(false);

    useEffect(() => {
        const check = () => setDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    return desktop;
}

const CARD_ASPECT = 9 / 16;
const CARD_ASPECT_INV = 16 / 9;

function useDeedBox(params: {
    railOpen: boolean;
    topOffsetPx: number;
    isMobile: boolean;
}) {
    const { railOpen, topOffsetPx, isMobile } = params;
    const [box, setBox] = useState<{ w: number; h: number }>({ w: 360, h: 640 });

    useEffect(() => {
        const recalc = () => {
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            if (isMobile) {
                setBox({ w: vw, h: vh });
                return;
            }

            const targetH = Math.max(520, vh - topOffsetPx);
            const targetW = Math.round(targetH * CARD_ASPECT);

            const railW = railOpen ? DESKTOP_RAIL_W : 0;
            const leftW = DESKTOP_LEFT_W;
            const sideGutter = vw >= 1280 ? 56 : 24;
            const usableW = Math.max(320, vw - leftW - railW - sideGutter * 2);

            if (targetW <= usableW) {
                setBox({ w: targetW, h: targetH });
            } else {
                const w = Math.floor(usableW);
                const h = Math.floor(w / CARD_ASPECT_INV);
                setBox({ w, h });
            }
        };

        recalc();
        window.addEventListener("resize", recalc);
        return () => window.removeEventListener("resize", recalc);
    }, [railOpen, topOffsetPx, isMobile]);

    return box;
}

function DesktopTopBar(props: {
    uid?: string | null;
    profile?: FeedShellProfile;
    activeTab: FeedTabKey;
    onTabChange: (next: FeedTabKey) => void;
    onSearch: () => void;
}) {
    const { uid, profile, activeTab, onTabChange, onSearch } = props;
    const router = useRouter();

    return (
        <div className="flex w-full max-w-[760px] items-center justify-between rounded-full border border-black/10 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
            <div className="flex items-center gap-1 rounded-full bg-black/5 p-1">
                {TABS.map((k) => {
                    const locked = !uid && k !== "forYou";
                    const active = activeTab === k;

                    return (
                        <button
                            key={k}
                            type="button"
                            onClick={() => {
                                if (locked) {
                                    router.push("/getstarted?next=/deeds");
                                    return;
                                }
                                onTabChange(k);
                            }}
                            className={cx(
                                "min-w-[104px] rounded-full px-4 py-2 text-sm font-semibold transition",
                                active ? "bg-black text-white" : "text-black/75 hover:bg-black/5",
                                locked && "opacity-60"
                            )}
                        >
                            {LABEL[k]}
                        </button>
                    );
                })}
            </div>

            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={onSearch}
                    className="grid h-11 w-11 place-items-center rounded-full bg-black/5 text-black"
                    aria-label="Search"
                >
                    <IoSearch size={20} />
                </button>

                <button
                    type="button"
                    onClick={() =>
                        router.push(
                            uid
                                ? profile?.handle
                                    ? `/${profile.handle}`
                                    : "/getstarted"
                                : "/getstarted?next=/deeds"
                        )
                    }
                    className="h-11 w-11 overflow-hidden rounded-full border border-black/10 bg-black/5"
                    aria-label="Profile"
                >
                    <img
                        src={profile?.photoURL ?? "/avatar-placeholder.png"}
                        alt="Me"
                        className="h-full w-full object-cover"
                    />
                </button>
            </div>
        </div>
    );
}

function MobileTabs(props: {
    uid?: string | null;
    activeTab: FeedTabKey;
    onTabChange: (next: FeedTabKey) => void;
}) {
    const { uid, activeTab, onTabChange } = props;

    return (
        <div className="rounded-full bg-black/35 p-1 backdrop-blur-md">
            <div className="flex items-center gap-1">
                {TABS.map((k) => {
                    const locked = !uid && k !== "forYou";
                    const active = activeTab === k;

                    return (
                        <button
                            key={k}
                            type="button"
                            onClick={() => {
                                if (locked) return;
                                onTabChange(k);
                            }}
                            className={cx(
                                "min-w-[86px] rounded-full px-3 py-2 text-sm font-bold transition",
                                active ? "bg-white text-black" : "text-white/90",
                                locked && "opacity-60"
                            )}
                        >
                            {LABEL[k]}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function DesktopLeftPanel(props: {
    uid?: string | null;
    photoURL?: string | null;
    handle?: string | null;
}) {
    const { uid, photoURL, handle } = props;

    const items = [
        { label: "Deeds", href: "/deeds" },
        { label: "ekariMarket", href: "/market" },
        { label: "Nexus", href: "/nexus" },
        { label: "Deed studio", href: uid ? "/studio/upload" : "/getstarted?next=/studio/upload" },
        { label: "Notifications", href: uid ? "/notifications" : "/getstarted?next=/notifications" },
        { label: "Bonga", href: uid ? "/bonga" : "/getstarted?next=/bonga" },
        { label: "ekari AI", href: "/ai" },
        { label: "Profile", href: uid ? (handle ? `/${handle}` : "/getstarted") : "/getstarted?next=/deeds" },
        { label: "About ekarihub", href: "/about" },
    ];

    return (
        <div className="flex h-full flex-col px-5 py-5">
            <div className="mb-5 flex items-center justify-between gap-3">
                <a href="/deeds" className="flex items-center gap-2">
                    <img src="/ekarihub-logo.png" alt="ekarihub" className="h-11 w-auto" />
                </a>

                <a
                    href="/search"
                    className="flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.02] px-4 py-3 text-[15px] font-semibold text-black/80"
                >
                    <IoSearch size={18} />
                    <span>Search</span>
                </a>
            </div>

            <nav className="flex-1 space-y-1 border-t border-black/10 pt-4">
                {items.map((item) => (
                    <a
                        key={item.label}
                        href={item.href}
                        className="block rounded-2xl px-4 py-3 text-[18px] font-medium text-[#35524b] transition hover:bg-black/[0.03]"
                    >
                        {item.label}
                    </a>
                ))}
            </nav>

            <div className="mt-4 border-t border-black/10 pt-4">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-[#9b8755] bg-black/5">
                        <img
                            src={photoURL ?? "/avatar-placeholder.png"}
                            alt="Me"
                            className="h-full w-full object-cover"
                        />
                    </div>

                    <div className="min-w-0">
                        <div className="truncate text-[18px] font-semibold text-[#35524b]">
                            {handle ? `@${handle}` : "ekarihub"}
                        </div>
                        <div className="text-sm text-[#35524b]/65">
                            Collaborate • Innovate • Cultivate
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FeedShell({
    uid,
    profile,
    warmAuthor,
    dataSaverOn = false,
    hlsMaxHeight,
    onOpenMenu,
}: Props) {
    const router = useRouter();
    const isDesktop = useIsDesktop();
    const isMobile = !isDesktop;

    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const [commentsId, setCommentsId] = useState<string | null>(null);

    const feed = useDeedsFeedWeb({
        uid,
        warmAuthor,
        initialTab: "forYou",
    });

    const currentFeed = feed.currentFeed;

    const tabBarH = isDesktop ? 84 : 56;

    const { w: cardW, h: cardH } = useDeedBox({
        railOpen: !!commentsId && isDesktop,
        topOffsetPx: tabBarH,
        isMobile,
    });

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

    useEffect(() => {
        if (!isDesktop && commentsId) {
            const prevOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = prevOverflow;
            };
        }
    }, [commentsId, isDesktop]);

    const renderScroller = (desktop: boolean) => {
        if (currentFeed.loading && !currentFeed.initialized) {
            return (
                <div
                    className={cx(
                        "flex items-center justify-center",
                        desktop ? "text-black/60" : "text-white/80"
                    )}
                    style={{ height: cardH }}
                >
                    Loading deeds...
                </div>
            );
        }

        if (!currentFeed.loading && currentFeed.items.length === 0) {
            return (
                <div
                    className={cx(
                        "flex items-center justify-center px-6 text-center",
                        desktop ? "text-black/60" : "text-white/80"
                    )}
                    style={{ height: cardH }}
                >
                    {emptyText}
                </div>
            );
        }

        return (
            <DeedsScrollerWeb
                items={currentFeed.items}
                uid={uid}
                cardH={cardH}
                scrollerRef={scrollerRef}
                dataSaverOn={dataSaverOn}
                hlsMaxHeight={hlsMaxHeight}
                loading={currentFeed.loading}
                onNeedMore={(index) => {
                    const remaining = currentFeed.items.length - 1 - index;
                    if (remaining <= 2) {
                        feed.loadMore(feed.activeTab);
                    }
                }}
                onOpenComments={(deedId) => setCommentsId(deedId)}
            />
        );
    };

    if (isDesktop) {
        return (
            <div className="relative min-h-[100svh] w-full bg-[#f8f8f8] text-black">
                <div
                    className="mx-auto grid min-h-[100svh] w-full"
                    style={{
                        gridTemplateColumns: `${DESKTOP_LEFT_W}px minmax(0,1fr) ${commentsId ? `${DESKTOP_RAIL_W}px` : "280px"
                            }`,
                    }}
                >
                    <aside className="sticky top-0 h-[100svh] border-r border-black/10 bg-white">
                        <DesktopLeftPanel
                            uid={uid}
                            photoURL={profile?.photoURL ?? null}
                            handle={profile?.handle ?? null}
                        />
                    </aside>

                    <main className="relative min-h-[100svh] overflow-hidden">
                        <div className="mx-auto flex h-full w-full flex-col items-center">
                            <div
                                className="sticky top-0 z-40 flex w-full justify-center px-6 pt-3"
                                style={{ height: tabBarH }}
                            >
                                <DesktopTopBar
                                    uid={uid}
                                    profile={profile}
                                    activeTab={feed.activeTab}
                                    onTabChange={(next) => {
                                        if (!uid && next !== "forYou") {
                                            router.push("/getstarted?next=/deeds");
                                            return;
                                        }
                                        feed.setActiveTab(next);
                                    }}
                                    onSearch={() => router.push("/search")}
                                />
                            </div>

                            <section
                                ref={scrollerRef}
                                tabIndex={0}
                                className="no-scrollbar h-full overflow-y-scroll outline-none"
                                style={{
                                    width: cardW,
                                    maxWidth: cardW,
                                    scrollSnapType: "y mandatory",
                                    overscrollBehaviorY: "contain",
                                    paddingBottom: 24,
                                }}
                            >
                                {renderScroller(true)}
                            </section>
                        </div>
                    </main>

                    <aside className="sticky top-0 h-[100svh] border-l border-black/10 bg-white">
                        {commentsId ? (
                            <RightRail
                                open={!!commentsId}
                                mode="sidebar"
                                deedId={commentsId ?? undefined}
                                onClose={() => setCommentsId(null)}
                                currentUser={{
                                    uid: uid || undefined,
                                    photoURL: profile?.photoURL ?? null,
                                    handle: profile?.handle ?? null,
                                    // firstName: profile?.firstName ?? null,
                                    // surname: profile?.surname ?? null,
                                }}
                            />
                        ) : (
                            <div className="flex h-full items-start justify-center px-8 pt-24 text-center text-sm text-black/45">
                                Open comments to show the side panel.
                            </div>
                        )}
                    </aside>
                </div>

                {currentFeed.loadingMore && currentFeed.items.length > 0 && (
                    <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white shadow-lg">
                        Loading more...
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="relative h-[100svh] w-full overflow-hidden bg-black text-white">
            <section
                ref={scrollerRef}
                tabIndex={0}
                className="no-scrollbar h-[100svh] w-full overflow-y-scroll scroll-smooth outline-none"
                style={{
                    scrollSnapType: "y mandatory",
                    overscrollBehaviorY: "contain",
                }}
            >
                <div className="pointer-events-none sticky top-0 z-50 px-3 pt-2">
                    <div className="pointer-events-auto flex items-center justify-between">
                        <button
                            type="button"
                            onClick={onOpenMenu}
                            className="grid h-10 w-10 place-items-center rounded-full bg-black/35 text-white backdrop-blur-md"
                            aria-label="Open menu"
                        >
                            <IoMenu size={20} />
                        </button>

                        <MobileTabs
                            uid={uid}
                            activeTab={feed.activeTab}
                            onTabChange={(next) => {
                                if (!uid && next !== "forYou") {
                                    router.push("/getstarted?next=/deeds");
                                    return;
                                }
                                feed.setActiveTab(next);
                            }}
                        />

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => router.push("/search")}
                                className="grid h-10 w-10 place-items-center rounded-full bg-black/35 text-white backdrop-blur-md"
                                aria-label="Search"
                            >
                                <IoSearch size={18} />
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    router.push(
                                        uid
                                            ? profile?.handle
                                                ? `/${profile.handle}`
                                                : "/getstarted"
                                            : "/getstarted?next=/deeds"
                                    )
                                }
                                className="h-10 w-10 overflow-hidden rounded-full border border-white/20 bg-white/10"
                                aria-label="Profile"
                            >
                                <img
                                    src={profile?.photoURL ?? "/avatar-placeholder.png"}
                                    alt="Me"
                                    className="h-full w-full object-cover"
                                />
                            </button>
                        </div>
                    </div>
                </div>

                {renderScroller(false)}

                {currentFeed.loadingMore && currentFeed.items.length > 0 && (
                    <div className="pointer-events-none fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white/90 backdrop-blur-md">
                        Loading more...
                    </div>
                )}
            </section>

            <div
                className={cx(
                    "fixed inset-0 z-[90] transition",
                    commentsId ? "pointer-events-auto" : "pointer-events-none"
                )}
                aria-hidden={!commentsId}
            >
                <div
                    className={cx(
                        "absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity",
                        commentsId ? "opacity-100" : "opacity-0"
                    )}
                    onClick={() => setCommentsId(null)}
                />

                <div
                    className={cx(
                        "absolute inset-x-0 bottom-0 h-[80vh] max-h-[88vh]",
                        "rounded-t-2xl bg-white shadow-xl",
                        "transition-transform duration-300 will-change-transform",
                        commentsId ? "translate-y-0" : "translate-y-full"
                    )}
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-gray-300" />

                    <button
                        type="button"
                        onClick={() => setCommentsId(null)}
                        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/5 text-black"
                        aria-label="Close comments"
                    >
                        <IoClose size={18} />
                    </button>

                    <RightRail
                        open={!!commentsId}
                        mode="sheet"
                        deedId={commentsId ?? undefined}
                        onClose={() => setCommentsId(null)}
                        currentUser={{
                            uid: uid || undefined,
                            photoURL: profile?.photoURL ?? null,
                            handle: profile?.handle ?? null,
                            // firstName: profile?.firstName ?? null,
                            // surname: profile?.surname ?? null,
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

export default FeedShell;