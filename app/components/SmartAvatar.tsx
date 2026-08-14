"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { IoPerson } from "react-icons/io5";

type Props = {
    src?: string | null;
    alt?: string;
    size?: number;
    rounded?: "full" | "xl" | "lg" | "md" | "none";
    className?: string;
};

const ROUNDED = {
    full: "rounded-full",
    xl: "rounded-xl",
    lg: "rounded-lg",
    md: "rounded-md",
    none: "",
} as const;

function isUsableSrc(src?: string | null) {
    if (!src) return false;

    const value = src.trim();

    if (!value) return false;

    return (
        value.startsWith("http://") ||
        value.startsWith("https://") ||
        value.startsWith("/") ||
        value.startsWith("blob:") ||
        value.startsWith("data:")
    );
}

export default function SmartAvatar({
    src,
    alt = "User",
    size = 46,
    rounded = "full",
    className,
}: Props) {
    const validSrc = isUsableSrc(src);

    const [loading, setLoading] = useState(validSrc);
    const [imageError, setImageError] = useState(false);

    /*
     * Important:
     * A user may previously have had a broken photoURL and then receive
     * a new valid one. Reset the state whenever src changes.
     */
    useEffect(() => {
        setImageError(false);
        setLoading(isUsableSrc(src));
    }, [src]);

    const showImage =
        validSrc &&
        !imageError;

    const iconSize = Math.max(
        16,
        Math.round(size * 0.46)
    );

    return (
        <div
            className={clsx(
                "relative shrink-0 overflow-hidden bg-[#E8ECE8]",
                "border border-black/[0.06]",
                ROUNDED[rounded],
                className
            )}
            style={{
                width: size,
                height: size,
            }}
            aria-label={alt}
        >
            {/* DEFAULT AVATAR */}
            {!showImage && (
                <div
                    className={clsx(
                        "absolute inset-0 grid place-items-center",
                        "bg-[#E8ECE8] text-[#173C2E]",
                        ROUNDED[rounded]
                    )}
                >
                    <IoPerson
                        size={iconSize}
                        aria-hidden="true"
                    />
                </div>
            )}

            {/* LOADING STATE */}
            {showImage && loading && (
                <div
                    className={clsx(
                        "absolute inset-0 z-10 grid place-items-center",
                        "bg-[#E8ECE8]",
                        ROUNDED[rounded]
                    )}
                >
                    <div
                        className="
                            h-4 w-4
                            animate-spin
                            rounded-full
                            border-2
                            border-[#CBD5D1]
                            border-t-[#173C2E]
                        "
                    />
                </div>
            )}

            {/* ACTUAL PHOTO */}
            {showImage && (
                <Image
                    src={src!.trim()}
                    alt={alt}
                    fill
                    sizes={`${size}px`}
                    className={clsx(
                        "object-cover",
                        "transition-opacity duration-200",
                        ROUNDED[rounded],
                        loading
                            ? "opacity-0"
                            : "opacity-100"
                    )}
                    onLoad={() => {
                        setLoading(false);
                    }}
                    onError={() => {
                        /*
                         * photoURL exists in Firestore but the actual
                         * Firebase Storage / remote file no longer exists.
                         *
                         * Remove Image and reveal our permanent icon
                         * fallback instead.
                         */
                        setImageError(true);
                        setLoading(false);
                    }}
                />
            )}
        </div>
    );
}