// app/signup/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    IoMailOutline,
    IoLockClosedOutline,
    IoEyeOutline,
    IoEyeOffOutline,
    IoShieldCheckmarkOutline,
} from "react-icons/io5";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db, getAuthSafe } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";

const EKARI = {
    forest: "#233F39",
    leaf: "#1F3A34",
    gold: "#C79257",
    sand: "#FFFFFF",
    hair: "#E5E7EB",
    text: "#0F172A",
    dim: "#6B7280",
    subtext: "#5C6B66",
    danger: "#B42318",
};

export default function SignupPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    // Load Firebase auth safely (client-only)
    const [authBundle, setAuthBundle] = useState<{ auth: any } | null>(null);
    useEffect(() => {
        (async () => {
            const bundle = await getAuthSafe();
            // getAuthSafe returns null on server; on client we expect { auth, googleProvider? }
            if (bundle) setAuthBundle({ auth: bundle.auth });
        })();
    }, []);

    const [consent, setConsent] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const isValidEmail = useMemo(
        () => /\S+@\S+\.\S+/.test(email.trim()),
        [email]
    );
    const isValid = useMemo(
        () =>
            isValidEmail &&
            password.length >= 6 &&
            confirm === password &&
            consent,
        [isValidEmail, password, confirm, consent]
    );

    const mapAuthError = (err: any) => {
        switch (err?.code) {
            case "auth/email-already-in-use":
                return "Email already in use.";
            case "auth/invalid-email":
                return "Invalid email address.";
            case "auth/weak-password":
                return "Password is too weak.";
            case "auth/network-request-failed":
                return "Network error. Please check your connection.";
            default:
                return err?.message || "Something went wrong.";
        }
    };

    // After auth state resolves:
    // if user doc exists → home, else → getstarted (just like login new user)
    useEffect(() => {
        // Wait until auth is done and we actually have a signed-in user
        if (authLoading || !user) return;

        let alive = true;

        (async () => {
            try {
                const snap = await getDoc(doc(db, "users", user.uid));
                if (!alive) return;

                // If user exists in "users" collection → go to /getstarted
                // If user does NOT exist → go to onboarding
                if (snap.exists()) {
                    router.replace("/getstarted");
                } else {
                    router.replace("/onboarding");
                }
            } catch {
                // On error, treat as not-onboarded and send to onboarding
                if (alive) router.replace("/getstarted");
            }
        })();

        return () => {
            alive = false;
        };
    }, [user, authLoading, router]);


    const handleSignup = async () => {
        if (!isValid || loading || !authBundle) return;
        const { auth } = authBundle;
        setLoading(true);
        setErrorMsg("");
        try {
            await createUserWithEmailAndPassword(auth, email.trim(), password);
            // Redirect handled by the useEffect above when { user } becomes non-null
        } catch (err: any) {
            setErrorMsg(mapAuthError(err));
        } finally {
            setLoading(false);
        }
    };

    const disableAll = loading || authLoading || !authBundle;

    return (
        <main
            className="min-h-screen w-full flex items-center justify-center px-4 py-8"
            style={{
                background:
                    "radial-gradient(circle at top left, rgba(35,63,57,0.14), transparent 50%), radial-gradient(circle at bottom right, rgba(199,146,87,0.18), #F3F4F6)",
            }}
        >
            <motion.div
                className="w-full max-w-lg mx-auto"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
            >
                {/* Top: logo + link back */}
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Image
                            src="/ekarihub-logo.png"
                            alt="ekarihub"
                            width={180}
                            height={54}
                            priority
                        />
                    </div>
                    <Link
                        href="/getstarted"
                        className="text-[11px] font-semibold underline-offset-4 hover:underline"
                        style={{ color: EKARI.dim }}
                    >
                        Back to get started
                    </Link>
                </div>

                {/* Card */}
                <motion.div
                    className="rounded-3xl bg-white/90 backdrop-blur-xl border border-white/70 shadow-[0_18px_60px_rgba(15,23,42,0.25)] px-6 py-7 md:px-8 md:py-8"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                >
                    {/* Heading */}
                    <div className="mb-5 text-center md:text-left">
                        <h1
                            className="text-xl md:text-2xl font-semibold tracking-tight"
                            style={{ color: EKARI.text }}
                        >
                            Craft your ekarihub account
                        </h1>
                        <p
                            className="mt-1.5 text-xs md:text-sm leading-5"
                            style={{ color: EKARI.subtext }}
                        >
                            One account for deeds, marketplace, Nexus, and more.
                        </p>
                    </div>

                    {/* Email */}
                    <label className="block">
                        <div
                            className="mt-1 flex items-center rounded-xl border px-3 h-11 bg-[#F6F7FB] focus-within:border-[rgba(35,63,57,0.7)] focus-within:ring-1 focus-within:ring-[rgba(35,63,57,0.6)] transition"
                            style={{ borderColor: EKARI.hair }}
                        >
                            <IoMailOutline
                                className="mr-2 flex-shrink-0"
                                size={18}
                                color={EKARI.dim}
                            />
                            <input
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                placeholder="Email"
                                className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                aria-label="Email"
                                disabled={disableAll}
                            />
                        </div>
                    </label>

                    {/* Password */}
                    <label className="block">
                        <div
                            className="mt-3 flex items-center rounded-xl border px-3 h-11 bg-[#F6F7FB] focus-within:border-[rgba(35,63,57,0.7)] focus-within:ring-1 focus-within:ring-[rgba(35,63,57,0.6)] transition"
                            style={{ borderColor: EKARI.hair }}
                        >
                            <IoLockClosedOutline
                                className="mr-2 flex-shrink-0"
                                size={18}
                                color={EKARI.dim}
                            />
                            <input
                                type={showPassword ? "text" : "password"}
                                autoComplete="new-password"
                                placeholder="Password"
                                className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                aria-label="Password"
                                disabled={disableAll}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((s) => !s)}
                                className="ml-2 p-1 rounded-full hover:bg-black/5 transition"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                disabled={disableAll}
                            >
                                {showPassword ? (
                                    <IoEyeOffOutline size={20} color={EKARI.dim} />
                                ) : (
                                    <IoEyeOutline size={20} color={EKARI.dim} />
                                )}
                            </button>
                        </div>
                    </label>

                    {/* Confirm Password */}
                    <label className="block">
                        <div
                            className="mt-3 flex items-center rounded-xl border px-3 h-11 bg-[#F6F7FB] focus-within:border-[rgba(35,63,57,0.7)] focus-within:ring-1 focus-within:ring-[rgba(35,63,57,0.6)] transition"
                            style={{ borderColor: EKARI.hair }}
                        >
                            <IoShieldCheckmarkOutline
                                className="mr-2 flex-shrink-0"
                                size={18}
                                color={EKARI.dim}
                            />
                            <input
                                type={showPassword ? "text" : "password"}
                                autoComplete="new-password"
                                placeholder="Confirm password"
                                className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSignup();
                                }}
                                aria-label="Confirm password"
                                disabled={disableAll}
                            />
                        </div>
                    </label>

                    {/* Inline validation helper */}
                    <div className="mt-2 space-y-1 text-[11px]">
                        {!isValidEmail && email.length > 0 && (
                            <p style={{ color: EKARI.dim }}>Enter a valid email address.</p>
                        )}
                        {password.length > 0 && password.length < 6 && (
                            <p style={{ color: EKARI.dim }}>
                                Password must be at least 6 characters.
                            </p>
                        )}
                        {confirm.length > 0 && confirm !== password && (
                            <p style={{ color: EKARI.dim }}>Passwords must match.</p>
                        )}
                    </div>

                    {!!errorMsg && (
                        <div className="mt-3 flex justify-center">
                            <p className="inline-flex items-center gap-2 rounded-full bg-[#FEF2F2] text-[12px] font-semibold px-3 py-1.5 text-[#B91C1C] border border-[#FECACA]">
                                {errorMsg}
                            </p>
                        </div>
                    )}

                    {/* Consent */}
                    <div className="mt-4 mb-2 flex items-start gap-2 px-1">
                        <input
                            id="consent"
                            type="checkbox"
                            checked={consent}
                            onChange={(e) => setConsent(e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border"
                            style={{ accentColor: EKARI.gold }}
                            disabled={disableAll}
                        />
                        <label
                            htmlFor="consent"
                            className="text-xs md:text-sm leading-5"
                            style={{ color: EKARI.text }}
                        >
                            By crafting an account, you agree to our{" "}
                            <Link
                                href="/terms"
                                className="underline font-semibold"
                                style={{ color: EKARI.forest }}
                            >
                                Terms
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
                        </label>
                    </div>

                    {/* CTA */}
                    <button
                        onClick={handleSignup}
                        disabled={!isValid || disableAll}
                        className="mt-3 w-full rounded-xl overflow-hidden active:scale-[0.98] transition disabled:opacity-60"
                    >
                        <div
                            className="py-3.5 text-center text-sm font-semibold text-white bg-gradient-to-br from-[#C79257] to-[#fbbf77]"
                            style={{ opacity: !isValid || disableAll ? 0.7 : 1 }}
                        >
                            {loading ? (
                                <span className="inline-flex items-center gap-2">
                                    <span
                                        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent align-[-2px]"
                                        aria-hidden
                                    />
                                    Crafting account...
                                </span>
                            ) : (
                                "Craft account"
                            )}
                        </div>
                    </button>

                    {/* Login link */}
                    <div className="mt-5 flex justify-center items-center text-sm">
                        <span style={{ color: EKARI.dim }}>Already a member?&nbsp;</span>
                        <Link
                            href="/login"
                            className="font-semibold underline-offset-4 hover:underline"
                            style={{ color: EKARI.forest }}
                        >
                            Log in
                        </Link>
                    </div>
                </motion.div>

                {/* Footer mini-links (optional, kept but softer) */}
                <div className="mt-5 flex flex-wrap justify-center gap-3 text-[11px] text-gray-500">
                    <Link href="/about">About</Link>
                    <Link href="/terms">T&amp;Cs</Link>
                    <Link href="/privacy">Privacy</Link>
                    <Link href="/craft-ad">Craft Ad</Link>
                    <Link href="/craft-page">Craft Page</Link>
                    <Link href="/viip">ViIP</Link>
                    <Link href="/celebrity">Celebrity</Link>
                </div>
            </motion.div>
        </main>
    );
}
