"use client";

import React from "react";
import {
    IoArrowRedo,
    IoBookmark,
    IoChatbubble,
    IoEllipsisHorizontal,
    IoHeart,
    IoCashOutline,
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
    gold: "#F3A526",
    goldSoft: "#D79A36",
    green: "#16A34A",
    white: "#FFFFFF",
};

function formatCount(n?: number) {
    const value = Number(n ?? 0);

    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(
            value % 1_000_000 ? 1 : 0,
        )}M`;
    }

    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(
            value % 1_000 ? 1 : 0,
        )}K`;
    }

    return String(value);
}

type ActionButtonProps = {
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
    active?: boolean;
    authordeeds?: boolean;
    title?: string;
    variant?: "overlay" | "desktop";
    special?: "uplift" | "mute";
    tone?: "default" | "like" | "comment" | "share" | "save" | "more";
};

function ActionButton({
    icon,
    label,
    onClick,
    active = false,
    authordeeds = false,
    title,
    variant = "overlay",
    special,
    tone = "default",
}: ActionButtonProps) {
    const isDesktop = variant === "desktop";

    const desktopBackground =
        special === "uplift"
            ? "rgba(243,165,38,0.18)"
            : tone === "like"
                ? active
                    ? "rgba(244,63,94,0.18)"
                    : "rgba(10,15,12,0.50)"
                : tone === "share"
                    ? "rgba(34,211,238,0.12)"
                    : tone === "comment"
                        ? "rgba(255,255,255,0.08)"
                        : tone === "save"
                            ? active
                                ? "rgba(243,165,38,0.16)"
                                : "rgba(255,255,255,0.08)"
                            : "rgba(10,15,12,0.50)";

    const desktopBorder =
        special === "uplift"
            ? "rgba(243,165,38,0.95)"
            : tone === "like"
                ? active
                    ? "rgba(244,63,94,0.95)"
                    : "rgba(255,255,255,0.22)"
                : tone === "share"
                    ? "rgba(34,211,238,0.72)"
                    : tone === "save"
                        ? active
                            ? "rgba(243,165,38,0.78)"
                            : "rgba(255,255,255,0.22)"
                        : "rgba(255,255,255,0.22)";

    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            title={title}
            className={[
                "group flex flex-col items-center gap-[3px]",
                "transition-transform duration-200 ease-out",
                "hover:-translate-y-[2px] active:translate-y-0",
            ].join(" ")}
        >
            <div
                className={[
                    "relative grid place-items-center rounded-full",
                    "transition-all duration-300 ease-out",
                    "active:scale-90",
                    isDesktop
                        ? [
                            "h-[48px] w-[48px]",
                            "group-hover:scale-[1.08]",
                            "group-hover:-translate-y-[1px]",
                            "group-hover:shadow-[0_12px_30px_rgba(0,0,0,0.35)]",
                        ].join(" ")
                        : "h-9 w-9 md:h-10 md:w-10 group-hover:scale-[1.06]",
                    !isDesktop || authordeeds
                        ? "ring-1 ring-white/10"
                        : "",
                ].join(" ")}
                style={
                    isDesktop && !authordeeds
                        ? {
                            background: desktopBackground,
                            border: `1px solid ${desktopBorder}`,
                            backdropFilter: "blur(12px)",
                            WebkitBackdropFilter: "blur(12px)",
                            boxShadow:
                                "0 10px 24px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.07)",
                        }
                        : undefined
                }
            >
                {special === "uplift" && (
                    <span
                        className={[
                            "pointer-events-none absolute inset-[-3px] rounded-full",
                            "border border-[#F3A526]/25 opacity-45",
                            "transition-all duration-500 ease-out",
                            "group-hover:inset-[-6px] group-hover:opacity-90",
                        ].join(" ")}
                    />
                )}

                <span
                    className={[
                        "relative z-10 grid place-items-center",
                        "transition-transform duration-300 ease-out",
                        tone === "like" && active
                            ? "scale-110 -rotate-6"
                            : "",
                        tone === "save" && active
                            ? "scale-110 -translate-y-[1px]"
                            : "",
                        tone === "comment"
                            ? "group-hover:scale-110 group-hover:-rotate-3"
                            : "",
                        tone === "share"
                            ? "group-hover:translate-x-[2px] group-hover:-translate-y-[2px]"
                            : "",
                        tone === "more"
                            ? "group-hover:rotate-90"
                            : "",
                    ].join(" ")}
                >
                    {icon}
                </span>
            </div>

            <span
                className={[
                    "select-none whitespace-nowrap font-extrabold tracking-[0.01em]",
                    isDesktop
                        ? "text-[10px] leading-[12px]"
                        : "text-[11px] leading-none md:text-[11px]",
                ].join(" ")}
                style={
                    isDesktop && !authordeeds
                        ? {
                            color:
                                special === "uplift"
                                    ? EKARI_THEME.gold
                                    : EKARI_THEME.white,
                            textShadow:
                                "0 2px 5px rgba(0,0,0,0.68)",
                        }
                        : {
                            color: EKARI_THEME.white,
                            textShadow:
                                "0 2px 4px rgba(0,0,0,0.60)",
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
    const isDesktop = variant === "desktop";

    const normalIconStyle: React.CSSProperties = isDesktop
        ? {
            color: "#FFFFFF",
            filter:
                "drop-shadow(0 2px 4px rgba(0,0,0,0.55))",
        }
        : {
            color: "#FF4D6D",
            filter:
                "drop-shadow(0 2px 4px rgba(0,0,0,0.60))",
        };

    const activeIconStyle: React.CSSProperties = isDesktop
        ? {
            color: EKARI_THEME.gold,
            filter:
                "drop-shadow(0 2px 4px rgba(0,0,0,0.55))",
        }
        : {
            color: EKARI_THEME.green,
            filter:
                "drop-shadow(0 2px 4px rgba(0,0,0,0.60))",
        };

    const muteIconStyle: React.CSSProperties = {
        color: "#FFFFFF",
        filter:
            "drop-shadow(0 2px 4px rgba(0,0,0,0.60))",
    };

    const shareIconStyle: React.CSSProperties = isDesktop
        ? {
            color: "#22D3EE",
            filter:
                "drop-shadow(0 2px 4px rgba(0,0,0,0.55))",
        }
        : normalIconStyle;

    return (
        <div
            className={[
                "pointer-events-auto flex flex-col items-center",
                isDesktop ? "gap-[12px]" : "gap-2",
            ].join(" ")}
        >
            {/* UPLIFT */}
            {canSupport ? (
                <ActionButton
                    active={false}
                    label="Uplift"
                    authordeeds={authordeeds}
                    onClick={onSupportClick}
                    title="Uplift this deed"
                    variant={variant}
                    special="uplift"
                    tone="default"
                    icon={
                        <IoCashOutline
                            size={20}
                            style={{
                                color: EKARI_THEME.gold,
                                filter:
                                    "drop-shadow(0 2px 4px rgba(0,0,0,0.55))",
                            }}
                        />
                    }
                />
            ) : null}

            {/* LIKE */}
            <ActionButton
                active={liked}
                authordeeds={authordeeds}
                label={formatCount(likeCount)}
                onClick={onToggleLike}
                title={liked ? "Unlike" : "Like"}
                variant={variant}
                tone="like"
                icon={
                    <IoHeart
                        size={21}
                        style={
                            liked
                                ? activeIconStyle
                                : normalIconStyle
                        }
                    />
                }
            />

            {/* COMMENTS */}
            <ActionButton
                active={commented}
                authordeeds={authordeeds}
                label={formatCount(commentCount)}
                onClick={onOpenComments}
                title="Comments"
                variant={variant}
                tone="comment"
                icon={
                    <IoChatbubble
                        size={20}
                        style={
                            commented
                                ? activeIconStyle
                                : normalIconStyle
                        }
                    />
                }
            />

            {/* SHARE */}
            <ActionButton
                active={false}
                authordeeds={authordeeds}
                label={formatCount(shareCount)}
                onClick={onShare}
                title="Share"
                variant={variant}
                tone="share"
                icon={
                    <IoArrowRedo
                        size={21}
                        style={shareIconStyle}
                    />
                }
            />

            {/* SAVE */}
            <ActionButton
                active={saved}
                authordeeds={authordeeds}
                label={formatCount(saveCount)}
                onClick={onToggleSave}
                title={saved ? "Unsave" : "Save"}
                variant={variant}
                tone="save"
                icon={
                    <IoBookmark
                        size={20}
                        style={
                            saved
                                ? activeIconStyle
                                : normalIconStyle
                        }
                    />
                }
            />

            {/* OPTIONAL MUTE */}
            {showMute && onToggleMute ? (
                <ActionButton
                    active={!muted}
                    authordeeds={authordeeds}
                    label={muted ? "Muted" : "Sound"}
                    onClick={onToggleMute}
                    title={muted ? "Unmute" : "Mute"}
                    variant={variant}
                    special="mute"
                    icon={
                        muted ? (
                            <IoVolumeMute
                                size={20}
                                style={muteIconStyle}
                            />
                        ) : (
                            <IoVolumeHigh
                                size={20}
                                style={muteIconStyle}
                            />
                        )
                    }
                />
            ) : null}

            {/* MORE */}
            <ActionButton
                active={false}
                authordeeds={authordeeds}
                label="More"
                onClick={onMoreClick}
                title="More options"
                variant={variant}
                tone="more"
                icon={
                    <IoEllipsisHorizontal
                        size={22}
                        style={normalIconStyle}
                    />
                }
            />
        </div>
    );
}