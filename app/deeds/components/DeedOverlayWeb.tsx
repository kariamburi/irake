"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    IoAdd,
    IoImageOutline,
    IoMusicalNotesOutline,
} from "react-icons/io5";

import { cn } from "@/lib/utils";
import { Deed } from "../data/deedsFeedWeb";
import { DeedActionRailWeb } from "./DeedActionRailWeb";
import SmartAvatar from "@/app/components/SmartAvatar";
import { AuthorBadgePill } from "@/app/components/AuthorBadgePill";

type Props = {
    item: Deed;
    commented?: boolean;
    liked: boolean;
    saved: boolean;
    muted?: boolean;
    showMute?: boolean;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    saveCount: number;
    onToggleLike: () => void;
    onToggleSave: () => void;
    onShare: () => void;
    onToggleMute?: () => void;
    onOpenComments?: (deedId: string) => void;

    isMobile?: boolean;
    mediaReady?: boolean;

    avatar?: string | null;
    followersCount?: number;
    timeAgo?: string | null;
    timeTitle?: string | null;

    showFollow?: boolean;
    onFollowClick?: () => void;

    authorProfile?: {
        handle?: string | null;
    } | null;
};

function getSoundLabel(item: Deed) {
    const music = (item as any)?.music;
    const title = music?.title?.trim?.();
    const artist = music?.artist?.trim?.();

    if (title && artist) return `${title} • ${artist}`;
    if (title) return title;
    if (artist) return artist;
    return "Original sound";
}

function getAuthorHandle(item: Deed, authorProfile?: { handle?: string | null } | null) {
    const raw =
        authorProfile?.handle?.trim?.() ||
        (item.authorUsername || "").trim() ||
        "";

    if (!raw) return "@unknown";
    return raw.startsWith("@") ? raw : `@${raw}`;
}

function getCaption(item: Deed) {
    return (item.text || "").trim();
}

function formatCount(value?: number) {
    const n = Number(value || 0);

    if (n >= 1_000_000) {
        const v = n / 1_000_000;
        return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`;
    }

    if (n >= 1_000) {
        const v = n / 1_000;
        return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}K`;
    }

    return `${n}`;
}

function getPhotoCount(item: Deed) {
    if (Array.isArray((item as any)?.photoItems) && (item as any).photoItems.length > 0) {
        return (item as any).photoItems.length;
    }

    if (Array.isArray((item as any)?.media) && (item as any).media.length > 0) {
        const onlyImages = (item as any).media.filter((m: any) => {
            const kind = String(m?.kind || m?.mediaType || "").toLowerCase();
            return kind === "image" || kind === "photo";
        });
        if (onlyImages.length > 0) return onlyImages.length;
    }

    return 1;
}

function hasMusic(item: Deed) {
    const music = (item as any)?.music;
    return !!(
        music?.url ||
        music?.title ||
        music?.artist ||
        music?.coverUrl
    );
}

export function DeedOverlayWeb({
    item,
    commented = false,
    liked,
    saved,
    muted = true,
    showMute = false,
    likeCount,
    commentCount,
    shareCount,
    saveCount,
    onToggleLike,
    onToggleSave,
    onShare,
    onToggleMute,
    onOpenComments,

    isMobile = false,
    mediaReady = true,

    avatar,
    followersCount = 0,
    timeAgo,
    timeTitle,

    showFollow = false,
    onFollowClick,
    authorProfile = null,
}: Props) {
    const router = useRouter();
    const [captionExpanded, setCaptionExpanded] = useState(false);

    const caption = getCaption(item);
    const soundLabel = getSoundLabel(item);

    const soundCover = (item as any)?.music?.coverUrl || null;
    const soundAvatar = soundCover || "";
    const isLibrarySound = !!soundCover;

    const isPhotoDeed = item.type === "photo";
    const deedHasMusic = hasMusic(item);
    const photoCount = getPhotoCount(item);

    const shouldShowSoundRow = !isPhotoDeed || deedHasMusic;
    const shouldShowPhotoMetaRow = isPhotoDeed && !deedHasMusic;

    const tags = useMemo(() => {
        const raw = (item as any)?.tags;
        if (!Array.isArray(raw)) return [];
        return raw
            .map((tag: any) => String(tag || "").trim().replace(/^#/, ""))
            .filter(Boolean);
    }, [item]);

    const hasCaption = !!caption;
    const hasTags = tags.length > 0;
    const visibleTags = captionExpanded ? tags : tags.slice(0, 3);
    const showMoreToggle =
        (hasCaption && caption.length > 120) || tags.length > 3;

    const displayAvatar = avatar || item.authorPhotoURL || "";
    const authorHandle = getAuthorHandle(item, authorProfile);
    const onViewProfileClick = () => {
        const raw = (authorProfile?.handle || item.authorUsername || "").trim();
        if (!raw) return;
        const clean = raw.startsWith("@") ? raw : `@${raw}`;
        router.push(`/${clean}`);

    };
    return (
        <>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/82 via-black/18 to-black/8 md:from-black/72 md:via-black/10 md:to-transparent" />

            <div className="pointer-events-none absolute inset-0 z-20 md:hidden">
                <div className="pointer-events-auto absolute bottom-[104px] right-2 flex flex-col items-center gap-3">
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => {
                                if (onViewProfileClick) {
                                    onViewProfileClick();
                                    return;
                                }

                                const raw = (authorProfile?.handle || item.authorUsername || "").trim();
                                if (!raw) return;
                                const clean = raw.startsWith("@") ? raw : `@${raw}`;
                                router.push(`/${clean}`);
                            }}
                            className="group"
                            aria-label="Open author profile"
                        >
                            <div className="h-14 w-14 overflow-hidden rounded-full border-2 border-white bg-white shadow-md ring-1 ring-black/5">
                                {displayAvatar ? (
                                    <img
                                        src={displayAvatar}
                                        alt={authorHandle || "Author"}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="grid h-full w-full place-items-center text-sm font-bold text-[#233F39]">
                                        {authorHandle.replace("@", "").slice(0, 1).toUpperCase()}
                                    </div>
                                )}
                            </div>
                        </button>

                        {showFollow ? (
                            <button
                                type="button"
                                onClick={onFollowClick}
                                aria-label="Follow creator"
                                title="Follow"
                                className="absolute left-1/2 top-full z-10 mt-[-10px] grid h-6 w-6 -translate-x-1/2 -translate-y-[30%] place-items-center rounded-full border-2 border-white bg-[#C79257] text-white shadow-md transition hover:scale-105 active:scale-95"
                            >
                                <IoAdd size={16} />
                            </button>
                        ) : null}
                    </div>

                    <DeedActionRailWeb
                        liked={liked}
                        variant="overlay"
                        commented={commented}
                        saved={saved}
                        muted={muted}
                        showMute={showMute}
                        likeCount={likeCount}
                        commentCount={commentCount}
                        shareCount={shareCount}
                        saveCount={saveCount}
                        onToggleLike={onToggleLike}
                        onOpenComments={() => onOpenComments?.(item.id)}
                        onShare={onShare}
                        onToggleSave={onToggleSave}
                        onToggleMute={onToggleMute}
                    />
                </div>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
                <div
                    className={cn(
                        "absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent transition-opacity duration-200",
                        mediaReady ? "opacity-100" : "opacity-0 pointer-events-none"
                    )}
                />

                <div
                    className={cn(
                        "relative",
                        isMobile
                            ? "p-4 pb-16 pr-[72px]"
                            : "p-4 pb-20 pr-[58px] md:pb-10"
                    )}
                >
                    <div className="pointer-events-auto mb-2 lg:mb-0 max-w-[min(560px,calc(100%-24px))] text-white">
                        <div className="mb-2 flex items-center gap-2">
                            <div
                                onClick={() => onViewProfileClick()}
                                className={cn(
                                    "relative shrink-0 overflow-hidden rounded-full bg-gray-200 cursor-pointer"
                                )}
                                role={"button"}
                                tabIndex={0}
                                onKeyDown={(e) => {

                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        onViewProfileClick();
                                    }
                                }}
                            >
                                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#C79257] via-transparent to-[#233F39] opacity-70" />

                                <SmartAvatar
                                    src={displayAvatar}
                                    alt={authorHandle || item.authorId || "author"}
                                    size={40}
                                    className="ring-2"
                                />
                            </div>

                            <div
                                onClick={() => onViewProfileClick()}
                                className={cn(
                                    "min-w-0 flex flex-col cursor-pointer"
                                )}
                                role={"button"}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (!onViewProfileClick) return;
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        onViewProfileClick();
                                    }
                                }}
                            >
                                <div className="truncate text-sm font-bold text-white/95">
                                    {authorProfile?.handle
                                        ? authorProfile.handle
                                        : item.authorUsername
                                            ? item.authorUsername.startsWith("@")
                                                ? item.authorUsername
                                                : `@${item.authorUsername}`
                                            : (item.authorId ?? "").slice(0, 6)}
                                </div>

                                <AuthorBadgePill badge={(item as any)?.authorBadge} />

                                <div className="flex items-center gap-2 text-[11px] text-white/70">
                                    <span title={`${followersCount} followers`}>
                                        {formatCount(followersCount)} Followers
                                    </span>

                                    {timeAgo ? (
                                        <>
                                            <span className="opacity-60">•</span>
                                            <span title={timeTitle || timeAgo} className="opacity-90">
                                                {timeAgo}
                                            </span>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        {(hasCaption || hasTags) ? (
                            <motion.div
                                className="mt-1 w-full"
                                layout
                                transition={{ type: "spring", stiffness: 260, damping: 26 }}
                            >
                                {hasCaption ? (
                                    <div className="relative w-full">
                                        <motion.p
                                            layout
                                            className={cn(
                                                "w-full cursor-pointer text-[14px] leading-5 text-white/95",
                                                captionExpanded ? "" : "line-clamp-2"
                                            )}
                                            onClick={() => setCaptionExpanded((v) => !v)}
                                        >
                                            {caption}
                                        </motion.p>
                                    </div>
                                ) : null}

                                {hasTags ? (
                                    <motion.div
                                        layout
                                        className="mt-2 flex w-full flex-wrap items-center gap-2"
                                    >
                                        {visibleTags.map((tag) => (
                                            <button
                                                key={tag}
                                                type="button"
                                                className="rounded-full border border-white/25 bg-black/25 px-2.5 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-black/60"
                                                onClick={() =>
                                                    router.push(`/tag/${encodeURIComponent(tag)}`)
                                                }
                                            >
                                                #{tag}
                                            </button>
                                        ))}

                                        {showMoreToggle ? (
                                            <button
                                                type="button"
                                                onClick={() => setCaptionExpanded((v) => !v)}
                                                className="text-[12px] font-semibold text-white/90"
                                            >
                                                {captionExpanded ? "less" : "… more"}
                                            </button>
                                        ) : null}
                                    </motion.div>
                                ) : null}
                            </motion.div>
                        ) : null}

                        {shouldShowSoundRow ? (
                            <div className="mb-1 mt-1 flex items-center gap-2">
                                {isLibrarySound ? (
                                    <div className="h-6 w-6 flex-shrink-0 overflow-hidden rounded-full border border-white/25 bg-black/40">
                                        <img
                                            src={soundAvatar}
                                            alt={soundLabel}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                ) : null}

                                <div className="flex min-w-0 items-center gap-2 text-[12px] text-white/85">
                                    <IoMusicalNotesOutline className="flex-shrink-0" size={16} />
                                    <span className="truncate max-w-[220px] sm:max-w-[280px] md:max-w-[420px]">
                                        {soundLabel}
                                    </span>
                                </div>
                            </div>
                        ) : null}

                        {shouldShowPhotoMetaRow ? (
                            <div className="mb-1 mt-1 flex items-center gap-2 text-[12px] text-white/85">
                                <IoImageOutline className="flex-shrink-0" size={16} />
                                <span className="truncate">
                                    {photoCount} photo{photoCount > 1 ? "s" : ""}
                                </span>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </>
    );
}