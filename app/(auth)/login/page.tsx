"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    IoChevronDown, IoChevronUp, IoMailOutline, IoLockClosedOutline,
    IoEyeOutline, IoEyeOffOutline,
} from "react-icons/io5";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth"; // <-- no GoogleAuthProvider here
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

    const isValid = useMemo(
        () => /\S+@\S+\.\S+/.test(email.trim()) && password.length >= 6,
        [email, password]
    );

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

    // Post-login routing based on Firestore user doc
    useEffect(() => {
        if (authLoading || !user) return;
        let alive = true;
        (async () => {
            try {
                const snap = await getDoc(doc(db, "users", user.uid));
                if (!alive) return;
                router.replace(snap.exists() ? "/" : "/onboarding");
            } catch {
                if (alive) router.replace("/onboarding");
            }
        })();
        return () => {
            alive = false;
        };
    }, [user, authLoading, router]);

    const handleLoginEmail = async () => {
        if (!isValid || loadingEmail || authLoading || !authBundle) return;
        const { auth } = authBundle;
        setErrorMsg("");
        setLoadingEmail(true);
        try {
            await signInWithEmailAndPassword(auth, email.trim(), password);
            // Redirect handled in useEffect above
        } catch (err: any) {
            setErrorMsg(mapAuthError(err));
        } finally {
            setLoadingEmail(false);
        }
    };

    const continueWithPhone = () => router.push("/phone-login");

    const continueWithGoogle = async () => {
        if (loadingGoogle || authLoading || !authBundle) return;
        const { auth, googleProvider } = authBundle;
        setErrorMsg("");
        setLoadingGoogle(true);
        try {
            await signInWithPopup(auth, googleProvider);
            // Redirect handled in useEffect via { user }
        } catch (err: any) {
            setErrorMsg(mapAuthError(err));
        } finally {
            setLoadingGoogle(false);
        }
    };

    const onForgotPassword = () => router.push("/forgot-password");

    const disableAll = authLoading || loadingEmail || loadingGoogle || !authBundle;

    return (
        <main className="min-h-screen w-full flex flex-col justify-center px-5 items-center" style={{ backgroundColor: EKARI.sand }}>
            <div className="w-full max-w-xl flex flex-col items-center gap-4">

                {/* Logo + tagline */}
                <div className="flex w-full flex-col items-center gap-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 140, damping: 14, mass: 0.6, duration: 0.28 }}
                    >
                        <Image src="/ekarihub-logo.png" alt="ekarihub" width={320} height={86} priority />
                    </motion.div>

                    <p className="text-center text-sm leading-5" style={{ color: EKARI.subtext, maxWidth: 340 }}>
                        {authLoading ? "Checking your session..." : "Log in to Ekarihub"}
                    </p>

                    {/* Card */}
                    <motion.div
                        className="w-full rounded-2xl bg-white px-4 py-4 mt-4"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15, duration: 0.26, ease: "easeOut" }}
                    >
                        {/* Phone */}
                        <button
                            onClick={continueWithPhone}
                            disabled={disableAll}
                            className="w-full rounded-xl py-3 font-extrabold text-white active:scale-[0.98] transition disabled:opacity-60"
                            style={{ backgroundColor: EKARI.gold }}
                        >
                            Continue with phone number
                        </button>

                        {/* Google */}
                        <div className="mt-3">
                            <button
                                onClick={continueWithGoogle}
                                disabled={disableAll}
                                className="w-full flex items-center justify-center gap-3 rounded-md border bg-white py-3 active:scale-[0.98] transition disabled:opacity-60"
                                style={{ borderColor: "#dadce0" }}
                            >
                                <Image src="/google-logo.png" width={18} height={18} alt="Google" />
                                <span className="text-[16px] text-[#3c4043] font-medium">
                                    {loadingGoogle ? "Signing in..." : "Sign in with Google"}
                                </span>
                            </button>
                        </div>

                        {/* Divider */}
                        <div className="flex items-center my-4">
                            <div className="flex-1 h-px" style={{ backgroundColor: EKARI.hair }} />
                            <span className="mx-3 text-xs font-bold" style={{ color: EKARI.dim }}>or</span>
                            <div className="flex-1 h-px" style={{ backgroundColor: EKARI.hair }} />
                        </div>

                        {/* Email toggle */}
                        <button
                            onClick={() => setEmailOpen(s => !s)}
                            disabled={disableAll}
                            className="mx-auto flex items-center gap-1 font-extrabold active:scale-[0.98] transition disabled:opacity-60"
                            style={{ color: EKARI.text }}
                        >
                            {emailOpen ? "Hide email login" : "Log in with email"}
                            {emailOpen ? <IoChevronUp size={18} /> : <IoChevronDown size={18} />}
                        </button>

                        {emailOpen && (
                            <div className="mt-2">
                                {/* Email */}
                                <div className="mt-2 flex items-center rounded-xl border px-3 h-12 bg-[#F6F7FB]" style={{ borderColor: EKARI.hair }}>
                                    <IoMailOutline className="mr-2" size={18} color={EKARI.dim} />
                                    <input
                                        type="email"
                                        inputMode="email"
                                        autoComplete="email"
                                        placeholder="Email"
                                        className="w-full bg-transparent outline-none text-base"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        aria-label="Email"
                                        disabled={disableAll}
                                    />
                                </div>

                                {/* Password */}
                                <div className="mt-3 flex items-center rounded-xl border px-3 h-12 bg-[#F6F7FB]" style={{ borderColor: EKARI.hair }}>
                                    <IoLockClosedOutline className="mr-2" size={18} color={EKARI.dim} />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="current-password"
                                        placeholder="Password"
                                        className="w-full bg-transparent outline-none text-base"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") handleLoginEmail(); }}
                                        aria-label="Password"
                                        disabled={disableAll}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(s => !s)}
                                        className="ml-2 p-1"
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                        disabled={disableAll}
                                    >
                                        {showPassword ? <IoEyeOffOutline size={20} color={EKARI.dim} /> : <IoEyeOutline size={20} color={EKARI.dim} />}
                                    </button>
                                </div>

                                {!!errorMsg && (
                                    <p className="mt-2 text-center font-semibold" style={{ color: EKARI.danger }}>
                                        {errorMsg}
                                    </p>
                                )}

                                <button
                                    onClick={handleLoginEmail}
                                    disabled={!isValid || disableAll}
                                    className="mt-3 w-full rounded-xl py-3 font-extrabold text-white active:scale-[0.98] transition"
                                    style={{ backgroundColor: EKARI.gold, opacity: !isValid || disableAll ? 0.6 : 1 }}
                                >
                                    {loadingEmail ? "Logging in..." : "Log in"}
                                </button>

                                <button
                                    onClick={onForgotPassword}
                                    className="block mx-auto mt-2 font-bold disabled:opacity-60"
                                    style={{ color: EKARI.dim }}
                                    disabled={disableAll}
                                >
                                    Password Blackout?
                                </button>
                            </div>
                        )}

                        {/* Signup */}
                        <div className="mt-3 flex justify-center items-center text-sm">
                            <span style={{ color: EKARI.dim }}>New here?&nbsp;</span>
                            <Link href="/signup" className="font-extrabold" style={{ color: EKARI.forest }}>
                                Craft Account
                            </Link>
                        </div>
                    </motion.div>
                </div>

                <div className="h-2" />
            </div>
        </main>
    );
}
