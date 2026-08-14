"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { IoPersonOutline } from "react-icons/io5";

type Props = {
    src?: string | null;
    alt?: string;
    size?: number; // square: px
    rounded?: "full" | "xl" | "lg" | "md" | "none";
    fallbackSrc?: string; // optional fallback image
    className?: string;
};

const ROUNDED = {
    full: "rounded-full",
    xl: "rounded-xl",
    lg: "rounded-lg",
    md: "rounded-md",
    none: "",
} as const;

export default function LargeAvatar({
    src,
    alt = "avatar",
    size = 46,
    rounded = "full",
    fallbackSrc,
    className,
}: Props) {
    const [loading, setLoading] = useState(Boolean(src?.trim()));
    const [srcFailed, setSrcFailed] = useState(false);
    const [fallbackFailed, setFallbackFailed] = useState(false);

    /*
     * If src changes, for example when another user's profile loads,
     * retry the new photo instead of keeping the previous error state.
     */
    useEffect(() => {
        setSrcFailed(false);
        setFallbackFailed(false);
        setLoading(Boolean(src?.trim()));
    }, [src, fallbackSrc]);

    const hasSource = Boolean(src?.trim());

    /*
     * Priority:
     *
     * 1. Real user's photo
     * 2. Optional fallbackSrc
     * 3. Person icon
     */
    const imageSrc =
        hasSource && !srcFailed
            ? src!
            : fallbackSrc && !fallbackFailed
                ? fallbackSrc
                : null;

    const showingRealPhoto =
        hasSource && !srcFailed;

    const showIcon = !imageSrc;

    return (
        <div
            className={clsx(
                "relative overflow-hidden bg-gray-100",
                ROUNDED[rounded],
                className
            )}
            style={{
                width: size,
                height: size,
            }}
            aria-label={alt}
        >
            {/* Loading spinner */}
            {loading && imageSrc && (
                <div
                    className={clsx(
                        "absolute inset-0 z-10 grid place-items-center bg-gray-100",
                        ROUNDED[rounded]
                    )}
                >
                    <div
                        className="h-5 w-5 animate-spin rounded-full border-2"
                        style={{
                            borderColor: "#D1D5DB",
                            borderTopColor: "#233F39",
                        }}
                    />
                </div>
            )}

            {/* Actual image / optional fallback image */}
            {imageSrc && (
                <Image
                    key={imageSrc}
                    src={imageSrc}
                    alt={alt}
                    fill
                    sizes={`${size}px`}
                    className={clsx(
                        "object-cover transition-opacity duration-200",
                        loading
                            ? "opacity-0"
                            : "opacity-100"
                    )}
                    onLoad={() => {
                        setLoading(false);
                    }}
                    onError={() => {
                        setLoading(false);

                        if (showingRealPhoto) {
                            /*
                             * photoURL exists in Firestore but the
                             * actual file/URL cannot be loaded.
                             */
                            setSrcFailed(true);

                            // If fallbackSrc exists, show its loader.
                            setLoading(Boolean(fallbackSrc));
                        } else {
                            /*
                             * Even fallbackSrc failed.
                             * Use our final person-icon fallback.
                             */
                            setFallbackFailed(true);
                        }
                    }}
                />
            )}

            {/* Final default avatar */}
            {showIcon && (
                <div
                    className={clsx(
                        "absolute inset-0 grid place-items-center",
                        "bg-[#E8ECE9] text-[#173C2E]",
                        ROUNDED[rounded]
                    )}
                >
                    <IoPersonOutline
                        style={{
                            width: size * 0.52,
                            height: size * 0.52,
                        }}
                        aria-hidden="true"
                    />
                </div>
            )}
        </div>
    );
}