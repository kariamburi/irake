"use client";

import React from "react";
import {
    IoArrowRedo,
    IoBookmark,
    IoChatbubble,
    IoEllipsisHorizontalCircle,
    IoHeart,
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

function formatCount(value?: number) {
    const count = Number(value ?? 0);

    if (count >= 1_000_000) {
        return `${(count / 1_000_000).toFixed(count % 1_000_000 ? 1 : 0)}M`;
    }

    if (count >= 1_000) {
        return `${(count / 1_000).toFixed(count % 1_000 ? 1 : 0)}K`;
    }

    return String(count);
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
            className="group flex flex-col items-center gap-1"
        >
            <div
                className={[
                    "grid h-9 w-9 place-items-center rounded-full transition will-change-transform active:scale-95 md:h-11 md:w-11 md:hover:scale-[1.04]",
                    isDesktop && !authordeeds ? "" : "ring-1 ring-white/10",
                ].join(" ")}
                style={
                    isDesktop && !authordeeds
                        ? {
                              background: "rgba(255,255,255,0.12)",
                              border: "1px solid rgba(255,255,255,0.30)",
                              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                              backdropFilter: "blur(8px)",
                          }
                        : undefined
                }
            >
                {icon}
            </div>

            <span
                className="select-none text-[13px] font-extrabold leading-none tracking-[0.01em]"
                style={{
                    color: "#FFFFFF",
                    textShadow: "0 2px 5px rgba(0,0,0,0.55)",
                }}
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
    likeCount,
    commentCount,
    shareCount,
    saveCount,
    onToggleLike,
    onOpenComments,
    onShare,
    onToggleSave,
    canSupport = false,
    onSupportClick,
    onMoreClick,
    authordeeds,
    variant = "overlay",
}: Props) {
    const isDesktop = variant === "desktop";
    const inactiveColor = isDesktop ? "#FFFFFF" : "#C79257";
    const activeColor = isDesktop ? "#FB7185" : "#16A34A";

    const iconStyle = (active: boolean): React.CSSProperties => ({
        color: active ? activeColor : inactiveColor,
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))",
    });

    return (
        <div className="pointer-events-auto flex flex-col items-center gap-4">
            {canSupport ? (
                <ActionButton
                    label="Uplift"
                    authordeeds={authordeeds}
                    onClick={onSupportClick}
                    title="Uplift this deed"
                    variant={variant}
                    icon={
                        <span
                            style={{
                                fontSize: 24,
                                lineHeight: 1,
                                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))",
                            }}
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
