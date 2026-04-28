"use client";

import React from "react";
import {
    IoArrowRedo,
    IoBookmark,
    IoChatbubble,
    IoEllipsisHorizontalCircle,
    IoHeart,
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
    onMoreClick?: () => void;
    canSupport?: boolean;
    onSupportClick?: () => void;
    authordeeds?: boolean;
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
    authordeeds = false,
    variant = "overlay",
}: {
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
    active?: boolean;
    authordeeds?: boolean;
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
            className="group flex flex-col items-center gap-1 md:gap-1"
        >
            <div
                className={[
                    "grid place-items-center rounded-full transition will-change-transform",
                    "active:scale-95 md:hover:scale-[1.04]",
                    "h-9 w-9 md:h-11 md:w-11",
                    isDesktop && !authordeeds ? "" : "ring-1 ring-white/10",
                ].join(" ")}
                style={
                    isDesktop && !authordeeds
                        ? {
                            background: EKARI_THEME.white,
                            border: `1px solid ${EKARI_THEME.border}`,
                            boxShadow: "0 4px 14px rgba(17,24,39,0.06)",
                        }
                        : undefined
                }
            >
                {icon}
            </div>

            <span
                className="select-none text-[13px] font-extrabold leading-none tracking-[0.01em] md:text-[13px]"
                style={
                    isDesktop && !authordeeds
                        ? { color: EKARI_THEME.forest }
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
    canSupport = false,
    onSupportClick,
    onMoreClick,
    authordeeds,
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
        <div className="pointer-events-auto flex flex-col items-center gap-2 pb-0 md:gap-2 md:pb-0">
            {canSupport ? (
                <ActionButton
                    active={false}
                    label="Uplift"
                    authordeeds={authordeeds}
                    onClick={onSupportClick}
                    title="Uplift this deed"
                    variant={variant}
                    icon={
                        <span
                            style={
                                isDesktop
                                    ? { fontSize: 24, lineHeight: 1 }
                                    : {
                                        fontSize: 24,
                                        lineHeight: 1,
                                        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))",
                                    }
                            }
                        >
                            💰
                        </span>
                    }
                />
            ) : null}

            <ActionButton
                active={liked}
                authordeeds={authordeeds}
                label={formatCount(likeCount)}
                onClick={onToggleLike}
                title={liked ? "Unlike" : "Like"}
                variant={variant}
                icon={<IoHeart size={28} style={iconStyle(liked)} />}
            />

            <ActionButton
                active={commented}
                authordeeds={authordeeds}
                label={formatCount(commentCount)}
                onClick={onOpenComments}
                title="Comments"
                variant={variant}
                icon={<IoChatbubble size={28} style={iconStyle(commented)} />}
            />

            <ActionButton
                active={false}
                authordeeds={authordeeds}
                label={formatCount(shareCount)}
                onClick={onShare}
                title="Share"
                variant={variant}
                icon={<IoArrowRedo size={28} style={iconStyle(false)} />}
            />

            <ActionButton
                active={saved}
                authordeeds={authordeeds}
                label={formatCount(saveCount)}
                onClick={onToggleSave}
                title={saved ? "Unsave" : "Save"}
                variant={variant}
                icon={<IoBookmark size={28} style={iconStyle(saved)} />}
            />
            <ActionButton
                active={false}
                authordeeds={authordeeds}
                label="More"
                onClick={onMoreClick}
                title="More options"
                variant={variant}
                icon={<IoEllipsisHorizontalCircle size={28} style={iconStyle(false)} />}
            />

        </div>
    );
}