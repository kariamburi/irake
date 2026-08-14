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
                "flex h-[100svh] w-full snap-start",
                className,
            ].join(" ")}
            style={{ scrollSnapStop: "always" }}
        >
            <div
                className={[
                    "relative flex h-full w-full items-center justify-center overflow-hidden bg-[#102718] px-6 text-center",
                    innerClassName,
                ].join(" ")}
            >
                {children}
            </div>
        </div>
    );
}
