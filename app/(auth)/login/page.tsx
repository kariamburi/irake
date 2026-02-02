// app/login/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    IoChevronDown,
    IoChevronUp,
    IoMailOutline,
    IoLockClosedOutline,
    IoEyeOutline,
    IoEyeOffOutline,
} from "react-icons/io5";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db, getAuthSafe } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";

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

export default function LoginPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const [safeNext, setSafeNext] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const sp = new URLSearchParams(window.location.search);
        const nextParam = sp.get("next");

        if (nextParam && nextParam.startsWith("/")) {
            setSafeNext(nextParam);
        } else {
            setSafeNext(null);
        }
    }, []);

    // Load Firebase auth safely (client-only)
    const [authBundle, setAuthBundle] = useState<{ auth: any; googleProvider: any } | null>(null);
    useEffect(() => {
        (async () => {
            const bundle = await getAuthSafe();
            setAuthBundle(bundle);
        })();
    }, []);

    // UI state
    const [emailOpen, setEmailOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loadingEmail, setLoadingEmail] = useState(false);
    const [loadingGoogle, setLoadingGoogle] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [postAuthChecking, setPostAuthChecking] = useState(false);
    const disableAll =
        authLoading || loadingEmail || loadingGoogle || postAuthChecking || !authBundle;
    const isValid = useMemo(
        () => /\S+@\S+\.\S+/.test(email.trim()) && password.length >= 6,
        [email, password]
    );
    const ensureUserDocOrSignOut = async (uid: string) => {
        if (!authBundle) return false;
        const { auth } = authBundle;

        try {
            const snap = await getDoc(doc(db, "users", uid));

            if (!snap.exists()) {
                await auth.signOut();
                setErrorMsg("User does not exist. Please sign up first.");
                return false;
            }

            return true;
        } catch {
            // safer to sign out if we can't verify existence
            await auth.signOut();
            setErrorMsg("Could not verify account. Please try again.");
            return false;
        }
    };
    const mapAuthError = (err: any) => {
        switch (err?.code) {
            case "auth/invalid-credential":
            case "auth/wrong-password":
            case "auth/user-not-found":
                return "Invalid email or password.";
            case "auth/network-request-failed":
                return "Network error. Please check your connection.";
            case "auth/too-many-requests":
                return "Too many attempts. Try again later.";
            case "auth/popup-closed-by-user":
                return "Popup closed before completing sign in.";
            default:
                return err?.message || "Something went wrong.";
        }
    };

    // Post-login routing based on Firestore user doc + ?next=
    useEffect(() => {
        if (authLoading || postAuthChecking || !user) return;
        let alive = true;

        (async () => {
            try {
                const snap = await getDoc(doc(db, "users", user.uid));
                if (!alive) return;

                if (!snap.exists()) {
                    // New user → getstarted
                    if (user) {

                        router.replace("/onboarding");
                    } else {
                        router.replace("/login");
                    }
                    // 
                    return;
                }

                // Existing user: respect ?next= if present, else go home
                if (safeNext) {
                    router.replace(safeNext);
                } else {
                    router.replace("/");
                }
            } catch {
                if (!alive) return;
                router.replace("/getstarted");
            }
        })();

        return () => {
            alive = false;
        };
    }, [user, authLoading, postAuthChecking, router, safeNext]);

    const handleLoginEmail = async () => {
        if (!isValid || loadingEmail || authLoading || !authBundle) return;
        const { auth } = authBundle;

        setErrorMsg("");
        setLoadingEmail(true);
        setPostAuthChecking(true);

        try {
            const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
            const uid = cred.user?.uid;

            if (!uid) {
                setErrorMsg("Something went wrong. Please try again.");
                return;
            }

            const ok = await ensureUserDocOrSignOut(uid);
            if (!ok) return;

            // ✅ user doc exists → allow redirect useEffect to run
        } catch (err: any) {
            setErrorMsg(mapAuthError(err));
        } finally {
            setPostAuthChecking(false);
            setLoadingEmail(false);
        }
    };

    const continueWithPhone = () => router.push("/phone-login");

    const continueWithGoogle = async () => {
        if (loadingGoogle || authLoading || !authBundle) return;
        const { auth, googleProvider } = authBundle;

        setErrorMsg("");
        setLoadingGoogle(true);
        setPostAuthChecking(true);

        try {
            const cred = await signInWithPopup(auth, googleProvider);
            const uid = cred.user?.uid;

            if (!uid) {
                setErrorMsg("Something went wrong. Please try again.");
                return;
            }

            const ok = await ensureUserDocOrSignOut(uid);
            if (!ok) return;

            // ✅ user doc exists → allow redirect useEffect to run
        } catch (err: any) {
            setErrorMsg(mapAuthError(err));
        } finally {
            setPostAuthChecking(false);
            setLoadingGoogle(false);
        }
    };
    const onForgotPassword = () => router.push("/forgot-password");


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
                {/* Top logo + small link back to get started */}
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

                {/* Card: login form */}
                <motion.div
                    className="rounded-3xl bg-white/85 backdrop-blur-xl border border-white/70 shadow-[0_18px_60px_rgba(15,23,42,0.25)] px-6 py-7 md:px-8 md:py-8"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                >
                    {/* Heading */}
                    <div className="mb-5 text-center md:text-left">
                        <h1 className="text-xl md:text-2xl font-semibold tracking-tight" style={{ color: EKARI.text }}>
                            Log in to ekarihub
                        </h1>
                        <p className="mt-1.5 text-xs md:text-sm leading-5" style={{ color: EKARI.subtext }}>
                            {authLoading
                                ? "Checking your session..."
                                : "Welcome back. Choose how you’d like to sign in."}
                        </p>
                    </div>

                    {/* Phone login */}
                    <button
                        onClick={continueWithPhone}
                        disabled={disableAll}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white shadow-sm active:scale-[0.98] transition disabled:opacity-60"
                        style={{
                            background: "linear-gradient(135deg, #C79257, #fbbf77)",
                        }}
                    >

                        <span>Continue with phone number</span>
                    </button>

                    {/* Google login */}
                    <div className="mt-3">
                        <button
                            onClick={continueWithGoogle}
                            disabled={disableAll}
                            className="w-full flex items-center justify-center gap-3 rounded-xl border bg-white py-3.5 active:scale-[0.98] transition disabled:opacity-60 shadow-sm"
                            style={{ borderColor: "#dadce0" }}
                        >
                            <Image
                                src="/google-logo.png"
                                width={18}
                                height={18}
                                alt="Google"
                            />
                            <span className="text-[14px] text-[#3c4043] font-medium">
                                {loadingGoogle ? "Signing in..." : "Sign in with Google"}
                            </span>
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center my-4">
                        <div className="flex-1 h-px" style={{ backgroundColor: EKARI.hair }} />
                        <span
                            className="mx-3 text-[11px] font-semibold uppercase tracking-[0.16em]"
                            style={{ color: EKARI.dim }}
                        >
                            Or use email
                        </span>
                        <div className="flex-1 h-px" style={{ backgroundColor: EKARI.hair }} />
                    </div>

                    {/* Email toggle */}
                    <button
                        onClick={() => setEmailOpen((s) => !s)}
                        disabled={disableAll}
                        className="mx-auto flex items-center gap-1 text-sm font-semibold active:scale-[0.98] transition disabled:opacity-60"
                        style={{ color: EKARI.text }}
                    >
                        {emailOpen ? "Hide email login" : "Log in with email"}
                        {emailOpen ? <IoChevronUp size={18} /> : <IoChevronDown size={18} />}
                    </button>

                    {emailOpen && (
                        <div className="mt-3">
                            {/* Email */}
                            <div
                                className="mt-2 flex items-center rounded-xl border px-3 h-11 bg-[#F6F7FB] focus-within:border-[rgba(35,63,57,0.7)] focus-within:ring-1 focus-within:ring-[rgba(35,63,57,0.6)] transition"
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

                            {/* Password */}
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
                                    autoComplete="current-password"
                                    placeholder="Password"
                                    className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleLoginEmail();
                                    }}
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

                            {!!errorMsg && (
                                <div className="mt-3 flex justify-center">
                                    <p className="inline-flex items-center gap-2 rounded-full bg-[#FEF2F2] text-[12px] font-semibold px-3 py-1.5 text-[#B91C1C] border border-[#FECACA]">
                                        {errorMsg}
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={handleLoginEmail}
                                disabled={!isValid || disableAll}
                                className="mt-4 w-full rounded-xl py-3.5 text-sm font-semibold text-white active:scale-[0.98] transition shadow-sm disabled:opacity-60"
                                style={{
                                    background: "linear-gradient(135deg, #233F39, #3f6a5f)",
                                }}
                            >
                                {loadingEmail ? "Logging in..." : "Log in"}
                            </button>

                            <button
                                onClick={onForgotPassword}
                                className="block mx-auto mt-2 text-xs font-semibold disabled:opacity-60"
                                style={{ color: EKARI.dim }}
                                disabled={disableAll}
                            >
                                Forgot your password?
                            </button>
                        </div>
                    )}

                    {/* Signup hint */}
                    <div className="mt-6 flex justify-center items-center text-sm">
                        <span style={{ color: EKARI.dim }}>New here?&nbsp;</span>
                        <Link
                            href="/signup"
                            className="font-semibold underline-offset-4 hover:underline"
                            style={{ color: EKARI.forest }}
                        >
                            Craft an account
                        </Link>
                    </div>

                    <div className="mt-4 text-[11px] text-center text-slate-400">
                        By continuing, you agree to ekarihub&apos;s{" "}
                        <span className="underline underline-offset-2 cursor-pointer">
                            terms
                        </span>{" "}
                        and{" "}
                        <span className="underline underline-offset-2 cursor-pointer">
                            privacy policy
                        </span>
                        .
                    </div>
                </motion.div>
            </motion.div>
        </main>
    );
}
