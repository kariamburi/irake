"use client";

import React from "react";
import {
    IoArrowRedo,
    IoBookmark,
    IoBookmarkOutline,
    IoChatbubble,
    IoHeart,
    IoHeartOutline,
    IoVolumeHigh,
    IoVolumeMute,
} from "react-icons/io5";

type Props = {
    liked: boolean;
    commented?: boolean;
    saved: boolean;
    muted?: boolean;
    showMute?: boolean;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    saveCount: number;
    onToggleLike: () => void;
    onOpenComments?: () => void;
    onShare: () => void;
    onToggleSave: () => void;
    onToggleMute?: () => void;
    variant?: "overlay" | "desktop";
};

const EKARI_THEME = {
    forest: "#233F39",
    gold: "#C79257",
    green: "#16A34A",
    white: "#FFFFFF",
    border: "#E5E7EB",
};

function formatCount(n?: number) {
    const value = Number(n ?? 0);
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}M`;
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(value % 1_000 ? 1 : 0)}K`;
    }
    return String(value);
}

function ActionButton({
    icon,
    label,
    onClick,
    active = false,
    title,
    variant = "overlay",
}: {
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
    active?: boolean;
    title?: string;
    variant?: "overlay" | "desktop";
}) {
    const isDesktop = variant === "desktop";

    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            title={title}
            className="group flex flex-col items-center gap-1.5 md:gap-2"
        >
            <div
                className={[
                    "grid place-items-center rounded-full transition will-change-transform",
                    "active:scale-95 md:hover:scale-[1.04]",
                    "h-10 w-10 md:h-12 md:w-12",
                    isDesktop ? "" : "ring-1 ring-white/10",
                ].join(" ")}
                style={
                    isDesktop
                        ? {
                            background: EKARI_THEME.white,
                            border: `1px solid ${EKARI_THEME.border}`,
                            boxShadow: "0 4px 14px rgba(17,24,39,0.06)",
                        }
                        : {
                            // background: "rgba(0,0,0,0.34)",
                            // backdropFilter: "blur(10px)",
                            // boxShadow:
                            //    "0 10px 24px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(255,255,255,0.06)",
                        }
                }
            >
                {icon}
            </div>

            <span
                className="select-none text-[13px] font-extrabold leading-none tracking-[0.01em] md:text-[13px]"
                style={
                    isDesktop
                        ? {
                            color: EKARI_THEME.forest,
                        }
                        : {
                            color: EKARI_THEME.white,
                            textShadow: "0 2px 4px rgba(0,0,0,0.55)",
                        }
                }
            >
                {label}
            </span>
        </button>
    );
}

export function DeedActionRailWeb({
    liked,
    commented = false,
    saved,
    muted = true,
    showMute = false,
    likeCount,
    commentCount,
    shareCount,
    saveCount,
    onToggleLike,
    onOpenComments,
    onShare,
    onToggleSave,
    onToggleMute,
    variant = "overlay",
}: Props) {
    const inactiveColor = EKARI_THEME.gold;
    const activeColor = EKARI_THEME.green;
    const isDesktop = variant === "desktop";

    const iconStyle = (active: boolean) =>
        isDesktop
            ? { color: active ? activeColor : inactiveColor }
            : {
                color: active ? activeColor : inactiveColor,
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))",
            };

    return (
        <div className="pointer-events-auto flex flex-col items-center gap-3 pb-1 md:gap-4 md:pb-2">
            <ActionButton
                active={liked}
                label={formatCount(likeCount)}
                onClick={onToggleLike}
                title={liked ? "Unlike" : "Like"}
                variant={variant}
                icon={
                    liked ? (
                        <IoHeart size={28} style={iconStyle(true)} />
                    ) : (
                        <IoHeart size={28} style={iconStyle(false)} />
                    )
                }
            />

            <ActionButton
                active={commented}
                label={formatCount(commentCount)}
                onClick={onOpenComments}
                title="Comments"
                variant={variant}
                icon={<IoChatbubble size={28} style={iconStyle(commented)} />}
            />

            <ActionButton
                active={false}
                label={formatCount(shareCount)}
                onClick={onShare}
                title="Share"
                variant={variant}
                icon={<IoArrowRedo size={28} style={iconStyle(false)} />}
            />

            <ActionButton
                active={saved}
                label={formatCount(saveCount)}
                onClick={onToggleSave}
                title={saved ? "Unsave" : "Save"}
                variant={variant}
                icon={
                    saved ? (
                        <IoBookmark size={28} style={iconStyle(true)} />
                    ) : (
                        <IoBookmark size={28} style={iconStyle(false)} />
                    )
                }
            />


        </div>
    );
}