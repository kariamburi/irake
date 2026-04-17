"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";

type Props = {
    src?: string | null;
    alt?: string;
    handle?: string | null;
    size?: number;
    className?: string;
    imageClassName?: string;
    fallbackClassName?: string;
    priority?: boolean;
};

export default function EkariAvatar({
    src,
    alt = "Author",
    handle,
    size = 56,
    className,
    imageClassName,
    fallbackClassName,
    priority = false,
}: Props) {
    const [loading, setLoading] = useState(!!src);
    const [err, setErr] = useState(false);

    useEffect(() => {
        setErr(false);
        setLoading(!!src);
    }, [src]);

    const displaySrc = !err && src ? src : null;

    const fallbackLetter = useMemo(() => {
        const cleaned = (handle || alt || "?").replace("@", "").trim();
        return cleaned.slice(0, 1).toUpperCase() || "?";
    }, [handle, alt]);

    return (
        <div
            className={clsx(
                "relative overflow-hidden rounded-full border-2 border-white bg-white shadow-md ring-1 ring-black/5",
                className
            )}
            style={{ width: size, height: size }}
            aria-label={alt}
        >
            {displaySrc ? (
                <>
                    {loading && (
                        <div className="absolute inset-0 z-10 grid place-items-center bg-white">
                            <div
                                className="h-5 w-5 animate-spin rounded-full border-2"
                                style={{
                                    borderColor: "#E5E7EB",
                                    borderTopColor: "#233F39",
                                }}
                            />
                        </div>
                    )}

                    <Image
                        key={displaySrc}
                        src={displaySrc}
                        alt={alt}
                        fill
                        sizes={`${size}px`}
                        priority={priority}
                        className={clsx(
                            "object-cover transition-opacity duration-200",
                            loading ? "opacity-0" : "opacity-100",
                            imageClassName
                        )}
                        onLoad={() => setLoading(false)}
                        onError={() => {
                            setErr(true);
                            setLoading(false);
                        }}
                    />
                </>
            ) : (
                <div
                    className={clsx(
                        "grid h-full w-full place-items-center text-sm font-bold text-[#233F39]",
                        fallbackClassName
                    )}
                >
                    {fallbackLetter}
                </div>
            )}
        </div>
    );
}