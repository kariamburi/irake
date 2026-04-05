"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { IoAdd, IoCheckmark, IoChevronDown, IoChevronUp } from "react-icons/io5";

import { Deed } from "../data/deedsFeedWeb";
import { DeedActionRailWeb } from "./DeedActionRailWeb";
import { useGlobalMuteWeb } from "../hooks/useGlobalMuteWeb";
import { useDeedEngagementWeb } from "../hooks/useDeedEngagementWeb";

type Props = {
    item?: Deed | null;
    uid?: string | null;
    following?: Set<string>;
    commented?: boolean;
    onOpenComments?: (deedId: string) => void;
    onPrev?: () => void;
    onNext?: () => void;
    canGoPrev?: boolean;
    canGoNext?: boolean;
};

function cleanId(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

export function DesktopDeedRailWeb({
    item,
    uid,
    following,
    commented = false,
    onOpenComments,
    onPrev,
    onNext,
    canGoPrev = false,
    canGoNext = false,
}: Props) {
    const router = useRouter();
    const { muted, toggleMute } = useGlobalMuteWeb();

    const safeItemId = cleanId(item?.id);

    const {
        liked,
        likeCount,
        commentedCount,
        saved,
        toggleLike,
        toggleSave,
        totalBookmarks,
        totalShares,
        share,
    } = useDeedEngagementWeb(safeItemId, uid);

    const [followPending] = useState(false);
    const [justFollowed] = useState(false);

    if (!item || !safeItemId) return null;

    const isPhoto = item.type === "photo";
    const cleanUid = cleanId(uid);
    const cleanAuthorId = cleanId(item.authorId);

    const isFollowing = !!cleanAuthorId && !!following?.has(cleanAuthorId);

    const canFollow =
        !!cleanUid &&
        !!cleanAuthorId &&
        cleanAuthorId !== cleanUid;

    const showFollowBadge = canFollow && !isFollowing && !justFollowed;

    const requireAuth = (nextAction: () => void) => {
        if (!cleanUid) {
            router.push("/getstarted?next=/deeds");
            return;
        }
        nextAction();
    };

    const onLikeClick = () => requireAuth(toggleLike);
    const onSaveClick = () => requireAuth(toggleSave);

    const onShareClick = async () => {
        await share({
            authorHandle: item.authorUsername ?? null,
            caption: item.text ?? null,
        });
    };

    return (
        <div className="hidden h-full flex-col items-center justify-center gap-5 lg:flex">
            <button
                type="button"
                onClick={onPrev}
                disabled={!canGoPrev}
                aria-label="Previous deed"
                className={[
                    "grid h-14 w-14 place-items-center rounded-full border transition",
                    canGoPrev
                        ? "bg-white/85 text-[#233F39] shadow-sm hover:bg-white"
                        : "cursor-not-allowed bg-white/50 text-gray-300",
                ].join(" ")}
            >
                <IoChevronUp size={28} />
            </button>

            <div className="flex flex-col items-center gap-3">
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => {
                            const raw = (item.authorUsername || "").trim();
                            if (!raw) return;
                            const clean = raw.startsWith("@") ? raw : `@${raw}`;
                            router.push(`/${clean}`);
                        }}
                        className="group"
                        aria-label="Open author profile"
                    >
                        <div className="h-14 w-14 overflow-hidden rounded-full border-2 border-white bg-white shadow-md ring-1 ring-black/5">
                            {item.authorPhotoURL ? (
                                <img
                                    src={item.authorPhotoURL}
                                    alt={item.authorUsername || "Author"}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="grid h-full w-full place-items-center text-sm font-bold text-[#233F39]">
                                    {(item.authorUsername || "U").slice(0, 1).toUpperCase()}
                                </div>
                            )}
                        </div>
                    </button>

                    {showFollowBadge ? (
                        <button
                            type="button"
                            disabled={followPending}
                            aria-label="Follow creator"
                            title="Follow"
                            className={[
                                "absolute left-1/2 top-full z-10 mt-[-10px] grid h-6 w-6 -translate-x-1/2 -translate-y-[30%] place-items-center rounded-full",
                                "border-2 border-white bg-[#C79257] text-white shadow-md transition",
                                followPending ? "opacity-70" : "hover:scale-105 active:scale-95",
                            ].join(" ")}
                        >
                            <IoAdd size={16} />
                        </button>
                    ) : null}

                    {canFollow && (isFollowing || justFollowed) ? (
                        <div
                            className="absolute left-1/2 top-full z-10 mt-[-10px] grid h-6 w-6 -translate-x-1/2 -translate-y-[30%] place-items-center rounded-full border-2 border-white bg-[#16A34A] text-white shadow-md"
                            aria-label="Following"
                            title="Following"
                        >
                            <IoCheckmark size={14} />
                        </div>
                    ) : null}
                </div>

                <DeedActionRailWeb
                    liked={liked}
                    variant="desktop"
                    commented={commented}
                    saved={saved}
                    muted={muted}
                    showMute={!isPhoto}
                    likeCount={likeCount}
                    commentCount={commentedCount}
                    shareCount={totalShares}
                    saveCount={totalBookmarks}
                    onToggleLike={onLikeClick}
                    onOpenComments={() => onOpenComments?.(safeItemId)}
                    onShare={onShareClick}
                    onToggleSave={onSaveClick}
                    onToggleMute={toggleMute}
                />
            </div>

            <button
                type="button"
                onClick={onNext}
                disabled={!canGoNext}
                aria-label="Next deed"
                className={[
                    "grid h-14 w-14 place-items-center rounded-full border transition",
                    canGoNext
                        ? "bg-white/85 text-[#233F39] shadow-sm hover:bg-white"
                        : "cursor-not-allowed bg-white/50 text-gray-300",
                ].join(" ")}
            >
                <IoChevronDown size={28} />
            </button>
        </div>
    );
}