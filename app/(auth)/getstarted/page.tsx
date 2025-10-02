"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

const COLORS = {
    bg: "#F7F7F5",
    text: "#1F2F2B",
    subtext: "#5C6B66",
    primary: "#C79257",
    border: "#E5E7EB",
    white: "#FFFFFF",
};

export default function OnboardingPage() {
    const router = useRouter();

    return (

        <main
            className="min-h-screen flex items-center justify-center px-5"
            style={{ backgroundColor: COLORS.bg }}
        >
            <div className="w-full max-w-xl flex flex-col items-center gap-4">

                {/* Logo + tagline */}
                <div className="flex w-full flex-col items-center gap-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 140, damping: 14, mass: 0.6, duration: 0.28 }}
                    >
                        <Image
                            src="/ekarihub-logo.png"
                            alt="ekarihub"
                            width={320}
                            height={86}
                            priority
                        />
                    </motion.div>

                    <motion.p
                        className="text-center text-sm leading-5"
                        style={{ color: COLORS.subtext, maxWidth: 340 }}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15, duration: 0.25 }}
                    >
                        Connecting Communities, Growing Agribusiness Opportunities
                    </motion.p>

                    {/* CTAs */}
                    <motion.div
                        className="w-full"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.26, ease: "easeOut" }}
                    >
                        {/* Sign Up */}
                        <button
                            onClick={() => router.push("/signup")}
                            className="w-full mt-2 rounded-xl py-3 font-bold text-white shadow-sm active:scale-[0.99] transition"
                            style={{ backgroundColor: COLORS.primary }}
                        >
                            Sign Up
                        </button>

                        {/* Log In */}
                        <Link
                            href="/login"
                            className="block w-full mt-3 rounded-xl py-3 text-center font-semibold active:scale-[0.99] transition border bg-white"
                            style={{ borderColor: COLORS.border, color: COLORS.text }}
                        >
                            Log In
                        </Link>

                        {/* Explore feed */}
                        <button
                            onClick={() => router.replace("/deeds")}
                            className="block mx-auto mt-2 underline text-sm"
                            style={{ color: COLORS.subtext }}
                        >
                            Explore feed first
                        </button>
                    </motion.div>
                </div>

                {/* Legal */}
                <div className="mt-6 flex flex-col items-center">
                    <p className="text-center text-[11px]" style={{ color: "#98A3A0" }}>
                        By continuing you agree to our{" "}
                        <Link href="/terms" className="underline font-semibold" style={{ color: "#6B776F" }}>
                            Terms
                        </Link>{" "}
                        &{" "}
                        <Link href="/privacy" className="underline font-semibold" style={{ color: "#6B776F" }}>
                            Privacy
                        </Link>
                        .
                    </p>
                </div>

                <div className="h-2" />
            </div>
        </main>
    );
}
