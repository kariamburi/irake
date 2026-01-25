"use client";

import React, { useState } from "react";
import Image from "next/image";
import clsx from "clsx";

type Props = {
    src?: string | null;
    alt?: string;
    size?: number;           // square: px
    rounded?: "full" | "xl" | "lg" | "md" | "none";
    fallbackSrc?: string;    // optional custom fallback
    className?: string;      // extra class on wrapper
};

const ROUNDED = {
    full: "rounded-full",
    xl: "rounded-xl",
    lg: "rounded-lg",
    md: "rounded-md",
    none: "",
} as const;

export default function SmartAvatar({
    src,
    alt = "avatar",
    size = 46,
    rounded = "full",
    fallbackSrc = "/avatar-placeholder.png",
    className,
}: Props) {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(false);
    const displayed = !err && (src || fallbackSrc) ? (src || fallbackSrc) : fallbackSrc;

    return (
        <div
            className={clsx("relative overflow-hidden bg-gray-100", className)}
            style={{ width: size, height: size }}
            aria-label={alt}
        >
            {loading && (
                <div className="absolute inset-0 grid place-items-center bg-gray-100">
                    <div
                        className="h-5 w-5 rounded-full border-2 animate-spin"
                        style={{ borderColor: "#D1D5DB", borderTopColor: "#233F39" /* EKARI.forest */ }}
                    />
                </div>
            )}
            <Image
                src={displayed}
                alt={alt}
                fill
                sizes={`${size}px`}
                className={clsx("object-cover transition-opacity", loading ? "opacity-0" : "opacity-100")}
                onLoadingComplete={() => setLoading(false)}
                onError={() => {
                    setErr(true);
                    setLoading(false);
                }}
            />
        </div>
    );
}
