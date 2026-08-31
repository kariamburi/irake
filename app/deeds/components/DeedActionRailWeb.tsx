"use client";

import React from "react";
import {
    IoArrowRedo,
    IoBookmark,
    IoBookmarkOutline,
    IoChatbubble,
    IoChatbubbleOutline,
    IoEllipsisHorizontal,
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
    onMoreClick?: () => void;

    canSupport?: boolean;
    onSupportClick?: () => void;

    authordeeds?: boolean;

    /**
     * Kept for compatibility with existing callers.
     * Both variants now intentionally use the same
     * mobile-inspired visual language.
     */
    variant?: "overlay" | "desktop";
};

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    lightGold: "#fab15d",
    green: "#16A34A",

    heart: "#FF647C",
    share: "#49D6F6",
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

/* -------------------------------------------------------------------------- */
/*                              ACTION BUTTON                                 */
/* -------------------------------------------------------------------------- */

type ActionButtonProps = {
    icon: React.ReactNode;

    label?: string;

    onClick?: () => void;

    title?: string;

    disabled?: boolean;

    /**
     * Kept for compatibility.
     * We don't use this to create a different desktop design anymore.
     */
    variant?: "overlay" | "desktop";
};

function ActionButton({
    icon,
    label,
    onClick,
    title,
    disabled = false,
}: ActionButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            disabled={disabled}
            className={[
                "group",
                "flex w-[58px] flex-col items-center justify-center",
                "mt-2",
                "outline-none",
                "select-none",

                "transition-all duration-150 ease-out",

                disabled
                    ? "cursor-default opacity-55"
                    : "cursor-pointer",
            ].join(" ")}
        >
            {/* -------------------------------------------------------------- */}
            {/*                         ICON CIRCLE                            */}
            {/* -------------------------------------------------------------- */}

            <div
                className={[
                    "relative",

                    "flex h-[42px] w-[42px]",
                    "items-center justify-center",

                    "rounded-full",

                    "border border-white/[0.28]",

                    "bg-white/[0.10]",

                    "transition-all duration-150 ease-out",

                    !disabled
                        ? [
                            "group-hover:bg-white/[0.15]",
                            "group-active:scale-[0.95]",
                            "group-active:opacity-75",
                        ].join(" ")
                        : "",
                ].join(" ")}
            >
                {icon}
            </div>

            {/* -------------------------------------------------------------- */}
            {/*                         COUNT / LABEL                          */}
            {/* -------------------------------------------------------------- */}

            {label ? (
                <span
                    className={[
                        "mt-[3px]",

                        "whitespace-nowrap",

                        "text-center",
                        "text-[12px]",
                        "leading-[15px]",
                        "font-semibold",

                        "text-white/[0.92]",
                    ].join(" ")}
                    style={{
                        textShadow:
                            "0 1px 3px rgba(0,0,0,0.72)",
                    }}
                >
                    {label}
                </span>
            ) : null}
        </button>
    );
}

/* -------------------------------------------------------------------------- */
/*                           MOBILE STYLE ICON                                */
/* -------------------------------------------------------------------------- */

function RailIcon({
    children,
    color = "#FFFFFF",
}: {
    children: React.ReactNode;
    color?: string;
}) {
    return (
        <span
            className="flex items-center justify-center"
            style={{
                color,
                filter:
                    "drop-shadow(0 1px 3px rgba(0,0,0,0.55))",
            }}
        >
            {children}
        </span>
    );
}

/* -------------------------------------------------------------------------- */
/*                           DEED ACTION RAIL                                 */
/* -------------------------------------------------------------------------- */

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

    authordeeds = false,

    variant = "overlay",
}: Props) {
    return (
        <div
            className={[
                "pointer-events-auto",

                "flex w-[58px]",
                "flex-col",

                "items-center",
                "justify-end",
            ].join(" ")}
            data-variant={variant}
        >
            {/* -------------------------------------------------------------- */}
            {/*                            UPLIFT                              */}
            {/* -------------------------------------------------------------- */}

            {canSupport ? (
                <ActionButton
                    label="Uplift"
                    onClick={onSupportClick}
                    title="Uplift this deed"
                    icon={
                        <span
                            className="flex items-center justify-center"
                            style={{
                                fontSize: 22,
                                lineHeight: 1,
                                filter:
                                    "drop-shadow(0 1px 3px rgba(0,0,0,0.55))",
                            }}
                        >
                            💰
                        </span>
                    }
                />
            ) : null}

            {/* -------------------------------------------------------------- */}
            {/*                              LIKE                              */}
            {/* -------------------------------------------------------------- */}

            <ActionButton
                label={formatCount(likeCount)}
                onClick={onToggleLike}
                title={liked ? "Unlike" : "Like"}
                icon={
                    <RailIcon color={EKARI.heart}>
                        {liked ? (
                            <IoHeart size={23} />
                        ) : (
                            <IoHeartOutline size={23} />
                        )}
                    </RailIcon>
                }
            />

            {/* -------------------------------------------------------------- */}
            {/*                           COMMENTS                             */}
            {/* -------------------------------------------------------------- */}

            <ActionButton
                label={formatCount(commentCount)}
                onClick={onOpenComments}
                title="Comments"
                icon={
                    <RailIcon
                        color={
                            commented
                                ? EKARI.lightGold
                                : "#FFFFFF"
                        }
                    >
                        {commented ? (
                            <IoChatbubble size={22} />
                        ) : (
                            <IoChatbubbleOutline size={22} />
                        )}
                    </RailIcon>
                }
            />

            {/* -------------------------------------------------------------- */}
            {/*                              SAVE                              */}
            {/* -------------------------------------------------------------- */}

            <ActionButton
                label={formatCount(saveCount)}
                onClick={onToggleSave}
                title={saved ? "Unsave" : "Save"}
                icon={
                    <RailIcon color="#FFFFFF">
                        {saved ? (
                            <IoBookmark size={22} />
                        ) : (
                            <IoBookmarkOutline size={22} />
                        )}
                    </RailIcon>
                }
            />

            {/* -------------------------------------------------------------- */}
            {/*                             SHARE                              */}
            {/* -------------------------------------------------------------- */}

            <ActionButton
                label="Share"
                onClick={onShare}
                title="Share"
                icon={
                    <RailIcon color={EKARI.share}>
                        <IoArrowRedo size={22} />
                    </RailIcon>
                }
            />

            {/* -------------------------------------------------------------- */}
            {/*                     OPTIONAL MUTE / SOUND                      */}
            {/* -------------------------------------------------------------- */}

            {showMute && onToggleMute ? (
                <ActionButton
                    label={muted ? "Muted" : "Sound"}
                    onClick={onToggleMute}
                    title={muted ? "Unmute" : "Mute"}
                    icon={
                        <RailIcon color="#FFFFFF">
                            {muted ? (
                                <IoVolumeMute size={22} />
                            ) : (
                                <IoVolumeHigh size={22} />
                            )}
                        </RailIcon>
                    }
                />
            ) : null}

            {/* -------------------------------------------------------------- */}
            {/*                              MORE                              */}
            {/* -------------------------------------------------------------- */}

            {!authordeeds && onMoreClick ? (
                <ActionButton
                    label="More"
                    onClick={onMoreClick}
                    title="More options"
                    icon={
                        <RailIcon color="#FFFFFF">
                            <IoEllipsisHorizontal size={22} />
                        </RailIcon>
                    }
                />
            ) : null}
        </div>
    );
}