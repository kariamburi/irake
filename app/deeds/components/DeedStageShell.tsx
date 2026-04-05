"use client";

import React from "react";

type Props = {
    children: React.ReactNode;
    className?: string;
    innerClassName?: string;
};

export function DeedStageShell({
    children,
    className = "",
    innerClassName = "",
}: Props) {
    return (
        <div
            className={[
                "flex h-[100svh] w-full snap-start px-0 py-0 md:px-3 lg:px-4 md:py-2",
                className,
            ].join(" ")}
            style={{ scrollSnapStop: "always" }}
        >
            <div
                className={[
                    "relative flex h-full w-full items-center justify-center overflow-hidden rounded-none bg-black px-6 text-center md:rounded-2xl",
                    innerClassName,
                ].join(" ")}
            >
                {children}
            </div>
        </div>
    );
}