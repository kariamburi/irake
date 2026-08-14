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
                "flex h-[100svh] w-full snap-start px-0 py-0 md:px-3 md:py-2 lg:px-4",
                className,
            ].join(" ")}
            style={{
                scrollSnapStop: "always",
            }}
        >
            <div
                className={[
                    "relative bg-[#102718] flex h-full w-full items-center justify-center",
                    "overflow-hidden rounded-none px-6 text-center md:rounded-2xl",
                    innerClassName,
                ].join(" ")}
            // style={{
            //    background:
            //        "linear-gradient(115deg, #020B06 0%, #04140B 30%, #082312 58%, #0D321B 82%, #103B20 100%)",
            //}}
            >
                {/* =====================================================
                    SOFT FOREST GREEN GLOW
                ===================================================== */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background:
                            "radial-gradient(ellipse at 78% 42%, rgba(48, 126, 61, 0.24) 0%, rgba(23, 76, 40, 0.12) 38%, transparent 68%)",
                    }}
                />

                {/* =====================================================
                    SUBTLE CENTER GREEN LIGHT
                ===================================================== */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background:
                            "radial-gradient(ellipse at 50% 45%, rgba(65, 135, 53, 0.09) 0%, transparent 55%)",
                    }}
                />

                {/* =====================================================
                    BLACK GRADIENT FROM BOTTOM

                    Starts softly around the lower half and becomes
                    completely black at the bottom.
                ===================================================== */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background: `
                            linear-gradient(
                                to bottom,
                                rgba(0, 0, 0, 0) 0%,
                                rgba(0, 0, 0, 0) 38%,
                                rgba(0, 0, 0, 0.05) 48%,
                                rgba(0, 0, 0, 0.14) 58%,
                                rgba(0, 0, 0, 0.30) 68%,
                                rgba(0, 0, 0, 0.52) 78%,
                                rgba(0, 0, 0, 0.76) 88%,
                                rgba(0, 0, 0, 0.94) 96%,
                                #000000 100%
                            )
                        `,
                    }}
                />

                {/* =====================================================
                    CENTRAL AGRICULTURE WATERMARK
                ===================================================== */}
                <div
                    aria-hidden="true"
                    className="
                        pointer-events-none
                        absolute
                        left-1/2
                        top-[45%]
                        -translate-x-1/2
                        -translate-y-1/2
                    "
                >
                    <EkariLeafMark />
                </div>

                {/* =====================================================
                    DEED CONTENT
                ===================================================== */}
                <div className="relative z-10 flex h-full w-full items-center justify-center">
                    {children}
                </div>
            </div>
        </div>
    );
}

/* =========================================================
   EKARI LEAF WATERMARK
========================================================= */
function EkariLeafMark() {
    return (
        <svg
            viewBox="0 0 240 190"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="
                h-auto
                w-[170px]
                sm:w-[190px]
                md:w-[210px]
                lg:w-[230px]
                xl:w-[250px]
            "
        >
            {/* Centre leaf */}
            <path
                d="
                    M120 144
                    C91 116 91 76 120 39
                    C149 76 149 116 120 144
                    Z
                "
                stroke="rgba(113, 181, 105, 0.075)"
                strokeWidth="12"
                strokeLinejoin="round"
            />

            {/* Left leaf */}
            <path
                d="
                    M116 148
                    C75 150 42 126 25 91
                    C68 86 101 105 116 148
                    Z
                "
                stroke="rgba(113, 181, 105, 0.075)"
                strokeWidth="12"
                strokeLinejoin="round"
            />

            {/* Right leaf */}
            <path
                d="
                    M124 148
                    C165 150 198 126 215 91
                    C172 86 139 105 124 148
                    Z
                "
                stroke="rgba(113, 181, 105, 0.075)"
                strokeWidth="12"
                strokeLinejoin="round"
            />

            {/* Ground curve */}
            <path
                d="M47 155C91 175 149 175 193 155"
                stroke="rgba(113, 181, 105, 0.055)"
                strokeWidth="10"
                strokeLinecap="round"
            />
        </svg>
    );
}