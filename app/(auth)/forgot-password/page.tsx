// app/forgot-password/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    IoMailOutline,
    IoChevronBack,
    IoCheckmarkCircle,
} from "react-icons/io5";
import { sendPasswordResetEmail } from "firebase/auth";
import { getAuthSafe } from "@/lib/firebase";

const EKARI = {
    forest: "#233F39",
    leaf: "#1F3A34",
    gold: "#C79257",
    sand: "#FFFFFF",
    card: "#FFFFFF",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
    subtext: "#5C6B66",
    danger: "#B42318",
};

export default function ForgotPasswordPage() {
    const router = useRouter();

    // Load Firebase auth safely (client-only)
    const [authBundle, setAuthBundle] = useState<{ auth: any } | null>(null);
    useEffect(() => {
        (async () => {
            const bundle = await getAuthSafe();
            if (bundle) setAuthBundle({ auth: bundle.auth });
        })();
    }, []);

    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [sent, setSent] = useState(false);

    const isValidEmail = useMemo(
        () => /\S+@\S+\.\S+/.test(email.trim()),
        [email]
    );
    const disableAll = loading || !authBundle;

    const mapAuthError = (err: any) => {
        switch (err?.code) {
            case "auth/invalid-email":
                return "Invalid email.";
            case "auth/user-not-found":
                // Keep it vague to avoid user enumeration
                return "If this email exists, we'll send a reset link.";
            case "auth/network-request-failed":
                return "Network error. Check your connection.";
            default:
                return err?.message || "Check your email.";
        }
    };

    const handleSend = async () => {
        if (!isValidEmail || disableAll) return;
        setLoading(true);
        setErrorMsg("");
        try {
            await sendPasswordResetEmail(authBundle!.auth, email.trim());
            setSent(true);
        } catch (err: any) {
            setErrorMsg(mapAuthError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <main
            className="min-h-screen w-full flex flex-col justify-center px-5 items-center"
            style={{
                background:
                    "radial-gradient(circle at top left, rgba(35,63,57,0.12), transparent 55%), radial-gradient(circle at bottom right, rgba(199,146,87,0.16), #F3F4F6)",
            }}
        >
            <div className="w-full max-w-xl flex flex-col items-center gap-4">
                {/* Brand header */}
                <motion.div
                    className="flex flex-col items-center gap-2 text-center"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                        type: "spring",
                        stiffness: 140,
                        damping: 14,
                        mass: 0.6,
                        duration: 0.28,
                    }}
                >
                    <Image
                        src="/ekarihub-logo.png"
                        alt="ekarihub"
                        width={320}
                        height={86}
                        priority
                    />
                    <p
                        className="text-xs md:text-sm tracking-wide"
                        style={{ color: EKARI.subtext }}
                    >
                        Reset your ekarihub password
                    </p>
                </motion.div>

                {/* Card */}
                <motion.div
                    className="w-full rounded-3xl bg-white/90 backdrop-blur-xl shadow-[0_18px_60px_rgba(15,23,42,0.26)] border border-white/70 px-4 py-5 md:px-6 md:py-6 mt-2"
                    initial={{ opacity: 0, y: 12, scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                >
                    {/* Title + helper text */}
                    <div className="flex flex-col gap-1 mb-3">
                        <h1
                            className="font-black text-lg md:text-xl"
                            style={{ color: EKARI.text }}
                        >
                            Forgot your password?
                        </h1>
                        <p
                            className="text-xs md:text-sm leading-5"
                            style={{ color: EKARI.subtext }}
                        >
                            Enter the email linked to your ekarihub account and we&apos;ll
                            send you a secure reset link.
                        </p>
                    </div>

                    {/* Email input */}
                    <label className="block text-xs font-semibold mb-1.5">
                        <span style={{ color: EKARI.dim }}>Email address</span>
                    </label>
                    <div
                        className="flex items-center rounded-xl border px-3 h-12 bg-[#F6F7FB]"
                        style={{ borderColor: EKARI.hair }}
                    >
                        <IoMailOutline className="mr-2" size={18} color={EKARI.dim} />
                        <input
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            placeholder="you@domain.com"
                            className="w-full bg-transparent outline-none text-base"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (sent) setSent(false);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSend();
                            }}
                            aria-label="Email"
                            disabled={disableAll}
                        />
                    </div>

                    {/* Small inline validation helper */}
                    {!isValidEmail && email.length > 0 && (
                        <p
                            className="mt-2 text-xs"
                            style={{ color: EKARI.dim }}
                        >
                            Enter a valid email like <span className="font-semibold">you@example.com</span>.
                        </p>
                    )}

                    {!!errorMsg && (
                        <p
                            className="mt-3 text-center text-sm font-semibold"
                            style={{ color: EKARI.danger }}
                        >
                            {errorMsg}
                        </p>
                    )}

                    {sent && !errorMsg && (
                        <motion.div
                            className="mt-3 rounded-xl border px-3 py-2.5 flex items-start gap-2"
                            style={{ backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <IoCheckmarkCircle size={18} color="#10B981" />
                            <div className="text-xs md:text-sm">
                                <p
                                    className="font-semibold"
                                    style={{ color: "#065F46" }}
                                >
                                    Check your inbox.
                                </p>
                                <p className="mt-0.5" style={{ color: "#047857" }}>
                                    If that email exists, we&apos;ve sent a link to reset your
                                    password. Remember to check spam/promotions.
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* Primary CTA */}
                    <button
                        onClick={handleSend}
                        disabled={!isValidEmail || disableAll}
                        className="mt-4 w-full rounded-xl py-3 font-extrabold text-white active:scale-[0.98] transition"
                        style={{
                            background:
                                "linear-gradient(135deg, #C79257, #fbbf77)",
                            opacity: !isValidEmail || disableAll ? 0.6 : 1,
                        }}
                    >
                        {loading ? "Sending..." : sent ? "Send again" : "Send reset link"}
                    </button>

                    {/* Back to login */}
                    <button
                        onClick={() => router.back()}
                        className="mx-auto mt-4 flex items-center gap-1 text-sm font-bold"
                        style={{ color: EKARI.dim }}
                    >
                        <IoChevronBack size={18} />
                        Back to login
                    </button>

                    {/* Terms / Privacy */}
                    <div className="mt-5 border-t pt-3 border-dashed" style={{ borderColor: EKARI.hair }}>
                        <p
                            className="text-[11px] md:text-xs leading-5 text-center"
                            style={{ color: EKARI.text }}
                        >
                            By continuing, you agree to our{" "}
                            <Link
                                href="/terms"
                                className="underline font-semibold"
                                style={{ color: EKARI.forest }}
                            >
                                Terms and Conditions
                            </Link>{" "}
                            and{" "}
                            <Link
                                href="/privacy"
                                className="underline font-semibold"
                                style={{ color: EKARI.forest }}
                            >
                                Privacy Policy
                            </Link>
                            .
                        </p>
                    </div>
                </motion.div>

                <div className="h-2" />
            </div>
        </main>
    );
}
