"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    IoMenuOutline,
    IoClose,
    IoHomeOutline,
    IoCloudUploadOutline,
    IoFilmOutline,
    IoBarChartOutline,
    IoChatbubblesOutline,
    IoChevronBack,
} from "react-icons/io5";

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    hair: "#E5E7EB",
    text: "#0F172A",
    dim: "#6B7280",
};

type ShellProps = {
    title?: string;
    children: React.ReactNode;
    ctaHref?: string;   // defaults to /studio/upload
    ctaLabel?: string;  // defaults to "+ Upload"
};

export default function StudioShell({
    title,
    children,
    ctaHref = "/studio/upload",
    ctaLabel = "+ Upload",
}: ShellProps) {
    const [navOpen, setNavOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    const tabs = [
        { href: "/studio/upload", label: "Upload", Icon: IoCloudUploadOutline },
        { href: "/studio/deeds", label: "Deeds", Icon: IoFilmOutline },
        // { href: "/studio/overview", label: "Overview", Icon: IoHomeOutline },
        { href: "/studio/analytics", label: "Analytics", Icon: IoBarChartOutline },
        // { href: "/studio/comments", label: "Comments", Icon: IoChatbubblesOutline },
    ];

    const isActive = (href: string) =>
        pathname === href || pathname.startsWith(href + "/");

    return (
        <div className="min-h-screen w-full bg-white">
            {/* Top bar (desktop & tablet) */}
            <header
                className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/75"
                style={{ borderColor: EKARI.hair }}
            >
                <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-3">
                    {/* Mobile menu button */}
                    <button
                        onClick={() => setNavOpen(true)}
                        aria-label="Open menu"
                        className="rounded-md p-2 lg:hidden"
                    >
                        <IoMenuOutline size={22} />
                    </button>

                    {/* Brand / Title 
                    <div className="flex items-center gap-3">
                        <div className="text-sm font-extrabold" style={{ color: EKARI.text }}>
                            {title ?? "Studio"}
                        </div>
                    </div>*/}

                    {/* Tabs (desktop) */}
                    <nav className="ml-2 hidden items-center gap-1 lg:flex">
                        {tabs.map(({ href, label, Icon }) => {
                            const active = isActive(href);
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    className={[
                                        "relative inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold",
                                        active ? "text-black" : "text-black/80 hover:bg-black/[0.03]",
                                    ].join(" ")}
                                >
                                    <Icon size={16} className={active ? "opacity-100" : "opacity-75"} />
                                    {label}
                                    {/* active underline */}
                                    {active && (
                                        <span
                                            className="absolute inset-x-3 -bottom-[7px] h-[2px] rounded-full"
                                            style={{ backgroundColor: EKARI.gold }}
                                        />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Spacer */}
                    <div className="flex-1" />


                </div>
            </header>

            {/* Mobile drawer */}
            {navOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
                    <div className="absolute left-0 top-0 h-full w-[78%] max-w-[320px] bg-white shadow-xl">
                        <div
                            className="flex items-center justify-between border-b px-4 py-3"
                            style={{ borderColor: EKARI.hair }}
                        >
                            <div className="font-extrabold" style={{ color: EKARI.text }}>
                                Studio
                            </div>
                            <button
                                onClick={() => setNavOpen(false)}
                                className="rounded-md p-1.5"
                                aria-label="Close menu"
                            >
                                <IoClose size={20} />
                            </button>
                        </div>

                        <div className="p-4">
                            <Link
                                href={ctaHref}
                                onClick={() => setNavOpen(false)}
                                className="block w-full rounded-xl px-4 py-3 text-center font-bold text-white"
                                style={{ backgroundColor: EKARI.gold }}
                            >
                                {ctaLabel}
                            </Link>

                            <div className="mt-6 flex flex-col gap-1">
                                {tabs.map(({ href, label, Icon }) => {
                                    const active = isActive(href);
                                    return (
                                        <Link
                                            key={href}
                                            href={href}
                                            onClick={() => setNavOpen(false)}
                                            className={[
                                                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold",
                                                active ? "bg-black/[0.03]" : "hover:bg-black/[0.03]",
                                            ].join(" ")}
                                            style={{ color: EKARI.text }}
                                        >
                                            <Icon size={18} className={active ? "opacity-100" : "opacity-75"} />
                                            {label}
                                        </Link>
                                    );
                                })}
                            </div>

                            <div className="mt-8">
                                <button
                                    onClick={() => {
                                        setNavOpen(false);
                                        router.push("/");
                                    }}
                                    className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-sm font-bold shadow hover:bg-white"
                                    style={{ borderColor: EKARI.hair, color: EKARI.forest }}
                                    aria-label="Back to Ekarihub"
                                >
                                    <IoChevronBack />
                                    Back to Ekarihub
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main content */}
            <main className="mx-auto max-w-7xl px-3 py-4 sm:py-6">{children}</main>
        </div>
    );
}
