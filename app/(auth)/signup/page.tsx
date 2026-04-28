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
import { createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
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
const splitName = (name?: string | null) => {
    const clean = String(name || "").trim();
    if (!clean) return { firstName: "", surname: "" };

    const parts = clean.split(/\s+/);
    return {
        firstName: parts[0] || "",
        surname: parts.slice(1).join(" ") || "",
    };
};

async function saveAuthProviderProfile({
    uid,
    email,
    displayName,
    photoURL,
    provider,
}: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
    provider: "google" | "email";
}) {
    const { firstName, surname } = splitName(displayName);

    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? (snap.data() as any) : {};

    await setDoc(
        ref,
        {
            email: email || existing.email || null,
            authProvider: provider,
            providerDisplayName: displayName || existing.providerDisplayName || null,
            providerPhotoURL: photoURL || existing.providerPhotoURL || null,

            ...(firstName && !existing.firstName ? { firstName } : {}),
            ...(surname && !existing.surname ? { surname } : {}),
            ...(photoURL && !existing.photoURL ? { photoURL } : {}),

            createdFromAuth: true,
            onboarded: existing.onboarded === true,
            isSuspended: existing.isSuspended === true,
            isDeactivated: existing.isDeactivated === true,
            updatedAt: serverTimestamp(),
            ...(!snap.exists() ? { createdAt: serverTimestamp() } : {}),
        },
        { merge: true }
    );
}
export default function SignupPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const [authBundle, setAuthBundle] = useState<{ auth: any; googleProvider: any } | null>(null);

    useEffect(() => {
        (async () => {
            const bundle = await getAuthSafe();
            if (bundle) {
                setAuthBundle({
                    auth: bundle.auth,
                    googleProvider: bundle.googleProvider,
                });
            }
        })();
    }, []);

    const [consent, setConsent] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [loadingGoogle, setLoadingGoogle] = useState(false);
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

    const disableAll = loading || loadingGoogle || authLoading || !authBundle;

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
            case "auth/popup-closed-by-user":
                return "Popup closed before completing sign up.";
            case "auth/account-exists-with-different-credential":
                return "An account already exists with a different sign-in method.";
            default:
                return err?.message || "Something went wrong.";
        }
    };

    const resolveDestination = async (uid: string) => {
        try {
            const snap = await getDoc(doc(db, "users", uid));

            if (!snap.exists()) {
                return "/onboarding";
            }

            return "/";
        } catch {
            return "/onboarding";
        }
    };

    useEffect(() => {
        if (authLoading || !user) return;

        let alive = true;

        (async () => {
            const dest = await resolveDestination(user.uid);
            if (!alive) return;
            router.replace(dest);
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
            const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
            const uid = cred.user?.uid;

            if (!uid) {
                setErrorMsg("Could not create account. Please try again.");
                return;
            }

            const dest = await resolveDestination(uid);
            router.replace(dest);
        } catch (err: any) {
            setErrorMsg(mapAuthError(err));
        } finally {
            setLoading(false);
        }
    };

    const continueWithGoogle = async () => {
        if (!consent || loadingGoogle || authLoading || !authBundle) return;
        const { auth, googleProvider } = authBundle;

        setLoadingGoogle(true);
        setErrorMsg("");

        try {
            const cred = await signInWithPopup(auth, googleProvider);

            const u = cred.user;
            if (!u) {
                setErrorMsg("Something went wrong. Please try again.");
                return;
            }
            await saveAuthProviderProfile({
                uid: u.uid,
                email: u.email,
                displayName: u.displayName,
                photoURL: u.photoURL,
                provider: "google",
            });
            const dest = await resolveDestination(u.uid);
            router.replace(dest);
        } catch (err: any) {
            setErrorMsg(mapAuthError(err));
        } finally {
            setLoadingGoogle(false);
        }
    };

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

                <motion.div
                    className="rounded-3xl bg-white/90 backdrop-blur-xl border border-white/70 shadow-[0_18px_60px_rgba(15,23,42,0.25)] px-6 py-7 md:px-8 md:py-8"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                >
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

                    <div className="mt-1 mb-3 flex items-start gap-2 px-1">
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

                    <button
                        onClick={continueWithGoogle}
                        disabled={!consent || disableAll}
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
                            {loadingGoogle ? "Continuing..." : "Continue with Google"}
                        </span>
                    </button>

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
                        {!consent && (
                            <p style={{ color: EKARI.dim }}>Please accept the terms to continue.</p>
                        )}
                    </div>

                    {!!errorMsg && (
                        <div className="mt-3 flex justify-center">
                            <p className="inline-flex items-center gap-2 rounded-full bg-[#FEF2F2] text-[12px] font-semibold px-3 py-1.5 text-[#B91C1C] border border-[#FECACA]">
                                {errorMsg}
                            </p>
                        </div>
                    )}

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

                <div className="mt-5 flex flex-wrap justify-center gap-3 text-[11px] text-gray-500">
                    <Link href="/about">About</Link>
                    <Link href="/terms">T&amp;Cs</Link>
                    <Link href="/privacy">Privacy Policy</Link>
                </div>
            </motion.div>
        </main>
    );
}