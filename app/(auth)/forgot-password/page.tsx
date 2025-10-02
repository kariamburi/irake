"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { IoMailOutline, IoChevronBack, IoCheckmarkCircle } from "react-icons/io5";
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

    const isValidEmail = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);
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
        <main className="min-h-screen w-full flex flex-col justify-center px-5 items-center" style={{ backgroundColor: EKARI.sand }}>
            <div className="w-full max-w-xl flex flex-col items-center gap-4">

                <div className="flex flex-col items-center gap-4">
                    {/* Brand header */}
                    <Image src="/ekarihub-logo.png" alt="ekarihub" width={320} height={86} priority />

                    <p className="text-center text-sm leading-5" style={{ color: EKARI.subtext, maxWidth: 340 }}>
                        Reset your Ekarihub password
                    </p>

                    {/* Card */}
                    <motion.div
                        className="w-full rounded-2xl bg-white px-4 py-4 mt-2"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                    >
                        <h1 className="font-black text-lg mb-2" style={{ color: EKARI.text }}>
                            Reset your password
                        </h1>

                        {/* Email input */}
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
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSend();
                                }}
                                aria-label="Email"
                                disabled={disableAll}
                            />
                        </div>

                        {!!errorMsg && (
                            <p className="mt-3 text-center font-semibold" style={{ color: EKARI.danger }}>
                                {errorMsg}
                            </p>
                        )}

                        {sent && (
                            <motion.div
                                className="mt-3 rounded-xl border px-3 py-2 flex items-center gap-2"
                                style={{ backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                            >
                                <IoCheckmarkCircle size={18} color="#10B981" />
                                <span className="font-bold" style={{ color: "#065F46" }}>
                                    If that email exists, we&apos;ve sent a reset link.
                                </span>
                            </motion.div>
                        )}

                        {/* Primary CTA */}
                        <button
                            onClick={handleSend}
                            disabled={!isValidEmail || disableAll}
                            className="mt-4 w-full rounded-xl py-3 font-extrabold text-white active:scale-[0.98] transition"
                            style={{ backgroundColor: EKARI.gold, opacity: !isValidEmail || disableAll ? 0.6 : 1 }}
                        >
                            {loading ? "Sending..." : "Send reset link"}
                        </button>

                        {/* Back to login */}
                        <button
                            onClick={() => router.back()}
                            className="mx-auto mt-3 flex items-center gap-1 font-bold"
                            style={{ color: EKARI.dim }}
                        >
                            <IoChevronBack size={18} />
                            Back to login
                        </button>

                        {/* Terms / Privacy */}
                        <div className="mt-4">
                            <p className="text-sm leading-5" style={{ color: EKARI.text }}>
                                By continuing, you agree to our{" "}
                                <Link href="/terms" className="underline font-semibold" style={{ color: EKARI.forest }}>
                                    Terms and Conditions
                                </Link>{" "}
                                and{" "}
                                <Link href="/privacy" className="underline font-semibold" style={{ color: EKARI.forest }}>
                                    Privacy Policy
                                </Link>
                                .
                            </p>
                        </div>
                    </motion.div>
                </div>

                <div className="h-2" />
            </div>
        </main>
    );
}
