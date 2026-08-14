"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    IoMenuOutline,
    IoClose,
    IoCloudUploadOutline,
    IoFilmOutline,
    IoBarChartOutline,
    IoChevronBack,
    IoAddOutline,
    IoSparklesOutline,
} from "react-icons/io5";
import { motion, AnimatePresence } from "framer-motion";

type ShellProps = {
    title?: string;
    children: React.ReactNode;
    ctaHref?: string;
    ctaLabel?: string;
};

const tabs = [
    {
        href: "/studio/upload",
        label: "Upload",
        Icon: IoCloudUploadOutline,
    },
    {
        href: "/studio/deeds",
        label: "Deeds",
        Icon: IoFilmOutline,
    },
    {
        href: "/studio/analytics",
        label: "Analytics",
        Icon: IoBarChartOutline,
    },
];

export default function StudioShell({
    title,
    children,
    ctaHref = "/studio/upload",
    ctaLabel = "+ Upload",
}: ShellProps) {
    const [navOpen, setNavOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    const isActive = (href: string) =>
        pathname === href ||
        pathname.startsWith(`${href}/`);

    return (
        <div className="w-full bg-[#F8F7F2]">
            {/* Studio navigation */}
            <header className="sticky top-0 z-40 border-b border-[#DDD8CC] bg-[#FBFAF6]/95 backdrop-blur-xl">
                <div className="mx-auto flex h-[58px] max-w-[1180px] items-center gap-3 px-3 sm:px-5 md:px-6">
                    <button
                        type="button"
                        onClick={() => setNavOpen(true)}
                        aria-label="Open Studio navigation"
                        className="grid h-9 w-9 place-items-center rounded-xl border border-[#D9D3C7] bg-white text-[#173C2E] lg:hidden"
                    >
                        <IoMenuOutline size={18} />
                    </button>

                    <div className="hidden min-w-[150px] items-center gap-2 lg:flex">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#E8ECE8] text-[#173C2E]">
                            <IoSparklesOutline size={17} />
                        </span>

                        <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.09em] text-[#F39A22]">
                                Studio
                            </div>
                            <div className="text-[11px] font-black text-slate-700">
                                {title ?? "Deed studio"}
                            </div>
                        </div>
                    </div>

                    <nav className="hidden h-full items-center gap-1 lg:flex">
                        {tabs.map(({ href, label, Icon }) => {
                            const active = isActive(href);

                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    className={[
                                        "relative inline-flex h-full items-center gap-2 px-3 text-[10px] font-black transition-colors",
                                        active
                                            ? "text-[#173C2E]"
                                            : "text-slate-400 hover:text-slate-700",
                                    ].join(" ")}
                                >
                                    <Icon size={14} />
                                    {label}

                                    {active ? (
                                        <motion.span
                                            layoutId="studio-tab-indicator"
                                            className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[#F39A22]"
                                            transition={{
                                                type: "spring",
                                                stiffness: 420,
                                                damping: 34,
                                            }}
                                        />
                                    ) : null}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="flex-1" />

                    <Link
                        href={ctaHref}
                        className="hidden h-9 items-center gap-1.5 rounded-xl bg-[#F39A22] px-3.5 text-[10px] font-black text-white transition hover:-translate-y-0.5 hover:bg-[#E98C12] sm:inline-flex"
                    >
                        <IoAddOutline size={14} />
                        {ctaLabel.replace(/^\+\s*/, "")}
                    </Link>
                </div>
            </header>

            <AnimatePresence>
                {navOpen ? (
                    <div className="fixed inset-0 z-[100] lg:hidden">
                        <motion.button
                            type="button"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
                            onClick={() => setNavOpen(false)}
                            aria-label="Close Studio navigation"
                        />

                        <motion.aside
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 30,
                            }}
                            className="absolute inset-y-0 left-0 w-[82%] max-w-[320px] bg-[#FBFAF6] shadow-2xl"
                        >
                            <div
                                className="flex items-center justify-between border-b border-[#DDD8CC] px-4 pb-3"
                                style={{
                                    paddingTop:
                                        "calc(14px + env(safe-area-inset-top))",
                                }}
                            >
                                <div>
                                    <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
                                        ekarihub
                                    </div>
                                    <div className="mt-0.5 text-[16px] font-black text-slate-900">
                                        Deed studio
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setNavOpen(false)}
                                    className="grid h-9 w-9 place-items-center rounded-xl border border-[#D9D3C7] bg-white text-slate-600"
                                >
                                    <IoClose size={17} />
                                </button>
                            </div>

                            <div className="p-4">
                                <Link
                                    href={ctaHref}
                                    onClick={() => setNavOpen(false)}
                                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#F39A22] text-[11px] font-black text-white"
                                >
                                    <IoAddOutline size={15} />
                                    {ctaLabel.replace(/^\+\s*/, "")}
                                </Link>

                                <nav className="mt-4 space-y-1">
                                    {tabs.map(({ href, label, Icon }) => {
                                        const active = isActive(href);

                                        return (
                                            <Link
                                                key={href}
                                                href={href}
                                                onClick={() => setNavOpen(false)}
                                                className={[
                                                    "flex h-11 items-center gap-3 rounded-xl px-3 text-[11px] font-black transition",
                                                    active
                                                        ? "bg-[#E8ECE8] text-[#173C2E]"
                                                        : "text-slate-500 hover:bg-[#F3F1EB]",
                                                ].join(" ")}
                                            >
                                                <Icon size={17} />
                                                {label}
                                            </Link>
                                        );
                                    })}
                                </nav>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setNavOpen(false);
                                        router.push("/");
                                    }}
                                    className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-3 text-[10px] font-black text-[#173C2E]"
                                >
                                    <IoChevronBack size={14} />
                                    Back to ekarihub
                                </button>
                            </div>
                        </motion.aside>
                    </div>
                ) : null}
            </AnimatePresence>

            <main className="mx-auto w-full max-w-[1180px] px-3 py-4 sm:px-5 md:px-6">
                {children}
            </main>
        </div>
    );
}