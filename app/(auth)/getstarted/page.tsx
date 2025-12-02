// app/getstarted/page.tsx
"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

const EKARI = {
    forest: "#233F39",
    leaf: "#1F3A34",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#1F2F2B",
    subtext: "#5C6B66",
    border: "#E5E7EB",
};

export default function OnboardingPage() {
    const router = useRouter();

    return (
        <main
            className="min-h-screen w-full flex items-center justify-center px-4 py-8"
            style={{
                background:
                    "radial-gradient(circle at top left, rgba(35,63,57,0.14), transparent 50%), radial-gradient(circle at bottom right, rgba(199,146,87,0.18), #F3F4F6)",
            }}
        >
            <motion.div
                className="w-full max-w-4xl mx-auto"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
            >
                {/* Top logo */}
                <div className="mb-6 text-center md:text-left">
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05, duration: 0.3, ease: "easeOut" }}
                        className="inline-flex items-center gap-3"
                    >
                        <Image
                            src="/ekarihub-logo.png"
                            alt="ekarihub"
                            width={220}
                            height={66}
                            priority
                        />
                    </motion.div>
                </div>

                {/* Card: brand side + CTA side */}
                <motion.div
                    className="grid md:grid-cols-2 rounded-3xl bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_24px_80px_rgba(15,23,42,0.25)] overflow-hidden"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                >
                    {/* Brand / Story side (moved from login) */}
                    <div
                        className="relative hidden md:flex flex-col justify-between px-8 py-8"
                        style={{
                            background:
                                "radial-gradient(circle at top, rgba(253,230,138,0.12), transparent 60%), linear-gradient(160deg, #233F39, #111827)",
                            color: "white",
                        }}
                    >
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-3 py-1 text-[11px] font-medium tracking-wide">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                A home for good deeds
                            </div>

                            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
                                Welcome to ekarihub
                            </h1>
                            <p className="mt-2 text-sm text-emerald-100 leading-relaxed">
                                Collaborate with farmers, creators and communities. Share
                                deeds, uplift others, and cultivate new opportunities together.
                            </p>
                        </div>

                        <div className="mt-8 space-y-3 text-[13px] text-emerald-100">
                            <div className="flex items-start gap-3">
                                <span className="mt-1 h-6 w-6 inline-flex items-center justify-center rounded-full bg-white/10 border border-white/20 text-[12px]">
                                    1
                                </span>
                                <div>
                                    <div className="font-semibold">Share your deeds</div>
                                    <div className="text-emerald-100/80">
                                        Post, track and celebrate meaningful actions on the land
                                        and in your community.
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="mt-1 h-6 w-6 inline-flex items-center justify-center rounded-full bg-white/10 border border-white/20 text-[12px]">
                                    2
                                </span>
                                <div>
                                    <div className="font-semibold">Support and uplift</div>
                                    <div className="text-emerald-100/80">
                                        Discover causes to support, and build long-term value
                                        with people you trust.
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="mt-1 h-6 w-6 inline-flex items-center justify-center rounded-full bg-white/10 border border-white/20 text-[12px]">
                                    3
                                </span>
                                <div>
                                    <div className="font-semibold">Stay rooted</div>
                                    <div className="text-emerald-100/80">
                                        Tailored for agribusinesses, farmers, cooperatives and processors - with your data protected.
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 text-[12px] text-emerald-100/80">
                            Join in, explore, and make your impact visible.
                        </div>
                    </div>

                    {/* CTA / Entry side */}
                    <div className="px-6 py-6 md:px-8 md:py-8 flex flex-col">
                        {/* Mobile brand header */}
                        <div className="md:hidden mb-4 text-center">
                            <h1 className="text-xl font-semibold text-slate-900">
                                Get started with ekarihub
                            </h1>
                            <p className="mt-1 text-xs text-slate-500">
                                Collaborate • Innovate • Cultivate
                            </p>
                        </div>

                        <div className="space-y-4">
                            <p
                                className="text-sm leading-5"
                                style={{ color: EKARI.subtext }}
                            >
                                Choose how you&apos;d like to begin. You can create an account,
                                log in, or just explore the deeds feed first.
                            </p>

                            {/* Sign Up */}
                            <button
                                onClick={() => router.push("/signup")}
                                className="w-full rounded-xl py-3.5 text-sm font-semibold text-white shadow-sm active:scale-[0.98] transition"
                                style={{
                                    background:
                                        "linear-gradient(135deg, #C79257, #fbbf77)",
                                }}
                            >
                                Create a new account
                            </button>

                            {/* Log In */}
                            <Link
                                href="/login"
                                className="block w-full rounded-xl py-3.5 text-center text-sm font-semibold border bg-white active:scale-[0.98] transition shadow-sm"
                                style={{
                                    borderColor: EKARI.border,
                                    color: EKARI.text,
                                }}
                            >
                                I already have an account
                            </Link>

                            {/* Explore feed */}
                            <button
                                onClick={() => router.replace("/")}
                                className="inline-flex items-center justify-center w-full mt-1 text-xs font-semibold underline underline-offset-4"
                                style={{ color: EKARI.subtext }}
                            >
                                Explore deeds first (no account yet)
                            </button>
                        </div>

                        {/* Little reassurance / copy */}
                        <div className="mt-6 rounded-2xl border bg-slate-50/70 px-4 py-3 text-[11px] leading-relaxed text-slate-500">
                            <span className="font-semibold" style={{ color: EKARI.text }}>
                                Built for trust:
                            </span>{" "}
                            Your profile helps people know who they&apos;re supporting -
                            whether you&apos;re a farmer, a creator, or part of a SACCO.
                        </div>

                        {/* Legal */}
                        <div className="mt-5 flex flex-col items-center text-center">
                            <p className="text-[11px] text-slate-400">
                                By continuing you agree to our{" "}
                                <Link
                                    href="/terms"
                                    className="underline font-semibold"
                                    style={{ color: "#6B776F" }}
                                >
                                    Terms
                                </Link>{" "}
                                &amp;{" "}
                                <Link
                                    href="/privacy"
                                    className="underline font-semibold"
                                    style={{ color: "#6B776F" }}
                                >
                                    Privacy
                                </Link>
                                .
                            </p>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </main>
    );
}
