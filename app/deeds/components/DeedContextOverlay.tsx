"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    IoCartOutline,
    IoSparklesOutline,
} from "react-icons/io5";

import type { Deed } from "@/app/deeds/data/deedsFeedWeb";

import {
    buildDeedAiPrompt,
    getDeedMarketSuggestion,
    getPrimaryDeedAiSuggestion,
} from "@/app/deeds/utils/deedContextActions";

type Props = {
    deed: Deed;
    isActive: boolean;
    className?: string;
};

export default function DeedContextOverlay({
    deed,
    isActive,
    className = "",
}: Props) {
    const router = useRouter();

    const primaryAiSuggestion = useMemo(
        () => getPrimaryDeedAiSuggestion(deed),
        [deed]
    );

    const marketSuggestion = useMemo(
        () => getDeedMarketSuggestion(deed),
        [deed]
    );

    /*
     * Only show contextual actions on the
     * deed currently visible to the user.
     */
    if (!isActive) {
        return null;
    }

    const openAi = (
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        event.preventDefault();
        event.stopPropagation();

        const prompt = buildDeedAiPrompt(
            deed,
            primaryAiSuggestion
        );

        router.push(
            `/ai?prompt=${encodeURIComponent(prompt)}`
        );
    };

    const openMarket = (
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        event.preventDefault();
        event.stopPropagation();

        if (!marketSuggestion) {
            return;
        }

        router.push(
            `/market?search=${encodeURIComponent(
                marketSuggestion.query
            )}`
        );
    };
    const showAiButton =
        primaryAiSuggestion.trim().toLowerCase() !== "explain this deed";
    return (
        <div
            className={[
                /*
                 * Position
                 */
                "pointer-events-none",
                "absolute",
                "left-3",
                "top-[70px]",
                "z-[35]",

                /*
                 * Layout
                 */
                "flex",
                "max-w-[72%]",
                "flex-wrap",
                "items-center",
                "gap-1.5",

                /*
                 * Entrance feel
                 */
                "transition-all",
                "duration-500",
                "ease-out",

                /*
                 * Responsive
                 */
                "sm:left-4",
                "sm:top-[76px]",
                "sm:max-w-[78%]",
                "sm:gap-2",

                "lg:left-5",
                "lg:top-[78px]",

                className,
            ].join(" ")}
        >
            {/* ===================================================== */}
            {/* ekari AI                                              */}
            {/* ===================================================== */}

            {showAiButton && (
                <button
                    type="button"
                    onClick={openAi}
                    aria-label={`Ask ekari AI: ${primaryAiSuggestion}`}
                    title={`Ask ekari AI: ${primaryAiSuggestion}`}
                    className={[
                        "pointer-events-auto",
                        "group",
                        "inline-flex",
                        "min-w-0",
                        "items-center",
                        "gap-1.5",
                        "rounded-full",
                        "border",
                        "border-emerald-300/35",
                        "bg-black/60",
                        "px-2.5",
                        "py-1.5",
                        "text-[9px]",
                        "font-extrabold",
                        "text-white",
                        "shadow-lg",
                        "backdrop-blur-md",
                        "transition-all",
                        "duration-300",
                        "ease-out",
                        "hover:-translate-y-0.5",
                        "hover:scale-[1.03]",
                        "hover:border-emerald-300/70",
                        "hover:bg-emerald-500/25",
                        "hover:shadow-xl",
                        "active:translate-y-0",
                        "active:scale-[0.97]",
                        "sm:gap-2",
                        "sm:px-3",
                        "sm:py-2",
                        "sm:text-[10px]",
                        "lg:text-[11px]",
                    ].join(" ")}
                >
                    <span
                        className="
                relative
                grid
                h-[18px]
                w-[18px]
                shrink-0
                place-items-center
            "
                    >
                        <span
                            className="
                    absolute
                    inset-0
                    animate-pulse
                    rounded-full
                    bg-emerald-300/25
                    blur-[4px]
                "
                        />

                        <IoSparklesOutline
                            size={15}
                            className="
                    relative
                    z-10
                    text-emerald-300
                    transition-all
                    duration-300
                    group-hover:scale-125
                    group-hover:rotate-12
                "
                        />
                    </span>

                    <span className="max-w-[150px] truncate sm:max-w-[210px]">
                        {primaryAiSuggestion}
                    </span>

                    <span
                        className="
                ml-0.5
                h-1.5
                w-1.5
                shrink-0
                animate-pulse
                rounded-full
                bg-emerald-300
            "
                    />
                </button>
            )}

            {/* ===================================================== */}
            {/* ekariMarket                                           */}
            {/* ===================================================== */}

            {marketSuggestion && (
                <button
                    type="button"
                    onClick={openMarket}
                    aria-label={marketSuggestion.label}
                    title={marketSuggestion.label}
                    className={[
                        "pointer-events-auto",

                        /*
                         * Group allows child icon animations.
                         */
                        "group",

                        /*
                         * Layout
                         */
                        "relative",
                        "inline-flex",
                        "min-w-0",
                        "items-center",
                        "gap-1.5",

                        /*
                         * Shape
                         */
                        "overflow-hidden",
                        "rounded-full",

                        /*
                         * Market styling
                         */
                        "border",
                        "border-[#c69258]/70",
                        "bg-[#E99A18]",

                        /*
                         * Spacing
                         */
                        "px-2.5",
                        "py-1.5",

                        /*
                         * Text
                         */
                        "text-[9px]",
                        "font-black",
                        "text-white",

                        /*
                         * Depth
                         */
                        "shadow-lg",
                        "backdrop-blur-md",

                        /*
                         * Safe animations
                         */
                        "transition-all",
                        "duration-300",
                        "ease-out",

                        /*
                         * Hover
                         */
                        "hover:-translate-y-0.5",
                        "hover:scale-[1.03]",
                        "hover:bg-[#c69258]",
                        "hover:shadow-xl",

                        /*
                         * Click
                         */
                        "active:translate-y-0",
                        "active:scale-[0.97]",

                        /*
                         * Responsive
                         */
                        "sm:gap-2",
                        "sm:px-3",
                        "sm:py-2",
                        "sm:text-[10px]",

                        "lg:text-[11px]",
                    ].join(" ")}
                >
                    {/* soft background glow */}
                    <span
                        className="
              pointer-events-none
              absolute
              -left-4
              top-1/2
              h-10
              w-10
              -translate-y-1/2
              rounded-full
              bg-white/15
              blur-lg
              transition-all
              duration-500
              group-hover:left-[70%]
            "
                    />

                    {/* cart */}
                    <span
                        className="
              relative
              z-10
              grid
              shrink-0
              place-items-center
            "
                    >
                        <IoCartOutline
                            size={15}
                            className="
                transition-all
                duration-300
                group-hover:-translate-y-[1px]
                group-hover:scale-110
              "
                        />
                    </span>

                    {/* label */}
                    <span
                        className="
              relative
              z-10
              max-w-[145px]
              truncate
              sm:max-w-[190px]
            "
                    >
                        {marketSuggestion.shortLabel}

                        <span className="hidden sm:inline">
                            {" "}
                            in ekariMarket
                        </span>
                    </span>

                    {/* live indicator */}
                    <span
                        className="
              relative
              z-10
              ml-0.5
              h-1.5
              w-1.5
              shrink-0
              rounded-full
              bg-white
              animate-pulse
            "
                    />
                </button>
            )}
        </div>
    );
}