"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    IoMenuOutline, IoClose, IoHomeOutline, IoCloudUploadOutline,
    IoFilmOutline, IoBarChartOutline, IoChatbubblesOutline,
    IoChevronBack
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
    ctaHref?: string;              // defaults to /studio/upload
    ctaLabel?: string;             // defaults to "+ Upload"
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
    const NavLink = ({
        href, label, Icon,
    }: { href: string; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
            <Link
                href={href}
                className={[
                    "flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium",
                    active ? "bg-black/[0.03]" : "hover:bg-black/[0.03]",
                ].join(" ")}
                style={{ color: active ? EKARI.text : EKARI.text }}
                onClick={() => setNavOpen(false)}
            >
                <Icon size={18} className={active ? "opacity-100" : "opacity-75"} />
                <span>{label}</span>
            </Link>
        );
    };

    return (
        <div className="min-h-screen" style={{ backgroundColor: "#FFFFFF" }}>
            {/* Mobile top bar */}
            <div
                className="sticky top-0 z-40 flex items-center justify-between border-b bg-white px-3 py-3 lg:hidden"
                style={{ borderColor: EKARI.hair }}
            >
                <button onClick={() => setNavOpen(true)} aria-label="Open menu" className="rounded-md p-2">
                    <IoMenuOutline size={22} />
                </button>
                <div className="text-sm font-extrabold" style={{ color: EKARI.text }}>
                    {title ?? "Studio"}
                </div>
                <Link
                    href={ctaHref}
                    className="rounded-lg px-3 py-2 text-xs font-bold text-white"
                    style={{ backgroundColor: EKARI.gold }}
                >
                    {ctaLabel}
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[260px,1fr]">
                {/* Sidebar (desktop) */}
                <aside className="hidden border-r px-4 py-4 lg:block" style={{ borderColor: EKARI.hair }}>
                    <Link
                        href={ctaHref}
                        className="block w-full rounded-xl px-4 py-3 text-center font-bold text-white"
                        style={{ backgroundColor: EKARI.gold }}
                    >
                        {ctaLabel}
                    </Link>

                    <nav className="mt-6 text-sm">
                        <div className="px-2 text-[11px] font-bold tracking-wider" style={{ color: EKARI.dim }}>
                            MANAGE
                        </div>
                        <div className="mt-2 flex flex-col">
                            <NavLink href="/studio" label="Home" Icon={IoHomeOutline} />
                            <NavLink href="/studio/deeds" label="Deeds" Icon={IoFilmOutline} />
                            <NavLink href="/studio/analytics" label="Analytics" Icon={IoBarChartOutline} />
                            <NavLink href="/studio/comments" label="Comments" Icon={IoChatbubblesOutline} />
                        </div>
                        <div className="px-2 pt-6 text-[11px] font-bold tracking-wider" style={{ color: EKARI.dim }}>
                            CREATE
                        </div>
                        <div className="mt-2 flex flex-col">
                            <NavLink href="/studio/upload" label="Upload" Icon={IoCloudUploadOutline} />
                        </div>
                        {/* Back to Home */}
                        <div
                            className="mt-10 flex flex-col"

                        >
                            <button
                                onClick={() => router.push("/")}
                                className="inline-flex items-center gap-2 rounded-full border bg-white/90 px-3 py-1.5 text-sm font-bold shadow hover:bg-white"
                                style={{ borderColor: EKARI.hair, color: EKARI.forest }}
                                aria-label="Back to Home"
                            >
                                <IoChevronBack />
                                <span className="hidden sm:inline">Back to Ekarihub</span>
                            </button>
                        </div>
                    </nav>
                </aside>

                {/* Mobile drawer */}
                {navOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden">
                        <div className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
                        <div className="absolute left-0 top-0 h-full w-[78%] max-w-[320px] bg-white shadow-xl">
                            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: EKARI.hair }}>
                                <div className="font-extrabold" style={{ color: EKARI.text }}>Menu</div>
                                <button onClick={() => setNavOpen(false)} className="rounded-md p-1.5" aria-label="Close menu">
                                    <IoClose size={20} />
                                </button>
                            </div>
                            <div className="p-4">
                                <Link
                                    href={ctaHref}
                                    className="block w-full rounded-xl px-4 py-3 text-center font-bold text-white"
                                    style={{ backgroundColor: EKARI.gold }}
                                >
                                    {ctaLabel}
                                </Link>
                                <div className="mt-6 flex flex-col gap-1">
                                    <NavLink href="/studio" label="Home" Icon={IoHomeOutline} />
                                    <NavLink href="/studio/posts" label="Posts" Icon={IoFilmOutline} />
                                    <NavLink href="/studio/analytics" label="Analytics" Icon={IoBarChartOutline} />
                                    <NavLink href="/studio/comments" label="Comments" Icon={IoChatbubblesOutline} />
                                    <NavLink href="/studio/upload" label="Upload" Icon={IoCloudUploadOutline} />
                                </div>
                            </div>
                            {/* Back to Home */}
                            <div
                                className="mt-10 flex flex-col"

                            >
                                <button
                                    onClick={() => router.push("/")}
                                    className="inline-flex items-center gap-2 rounded-full border bg-white/90 px-3 py-1.5 text-sm font-bold shadow hover:bg-white"
                                    style={{ borderColor: EKARI.hair, color: EKARI.forest }}
                                    aria-label="Back to Home"
                                >
                                    <IoChevronBack />
                                    <span className="hidden sm:inline">Back to Ekarihub</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main content */}
                <main className="p-4 sm:p-6">{children}</main>
            </div>
        </div>
    );
}
