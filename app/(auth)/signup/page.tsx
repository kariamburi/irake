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

    const isValidEmail = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);
    const isValid = useMemo(
        () => isValidEmail && password.length >= 6 && confirm === password && consent,
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

    // After auth state resolves: new users go to onboarding,
    // existing users go to deeds (if user doc exists)
    useEffect(() => {
        if (authLoading || !user) return;
        let alive = true;
        (async () => {
            try {
                const snap = await getDoc(doc(db, "users", user.uid));
                if (!alive) return;
                router.replace(snap.exists() ? "/deeds" : "/onboarding");
            } catch {
                if (alive) router.replace("/onboarding");
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
        <main className="min-h-screen w-full flex flex-col justify-center px-5 items-center" style={{ backgroundColor: EKARI.sand }}>
            <div className="w-full max-w-xl flex flex-col items-center gap-4">
                {/* Logo + tag */}
                <motion.div
                    className="flex flex-col items-center text-center"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 140, damping: 14, mass: 0.6, duration: 0.28 }}

                >
                    <Image src="/ekarihub-logo.png" alt="ekarihub" width={320} height={86} priority />
                    <p className="text-sm md:text-base tracking-wide">
                        Collaborate • Innovate • Cultivate
                    </p>
                </motion.div>

                <motion.p
                    className="text-center text-sm leading-5 mt-1 mb-1"
                    style={{ color: EKARI.subtext, maxWidth: 340 }}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.25 }}
                >
                    Craft an Account
                </motion.p>

                {/* Card */}
                <motion.div
                    className="w-full rounded-2xl bg-white/95 shadow-sm border border-gray-100 px-4 py-4 mt-4"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.26, ease: "easeOut" }}
                >
                    {/* Email */}
                    <label className="block">
                        <div
                            className="mt-2 flex items-center rounded-xl border px-3 h-12 bg-[#F6F7FB]"
                            style={{ borderColor: EKARI.hair }}
                        >
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
                    </label>

                    {/* Password */}
                    <label className="block">
                        <div
                            className="mt-3 flex items-center rounded-xl border px-3 h-12 bg-[#F6F7FB]"
                            style={{ borderColor: EKARI.hair }}
                        >
                            <IoLockClosedOutline className="mr-2" size={18} color={EKARI.dim} />
                            <input
                                type={showPassword ? "text" : "password"}
                                autoComplete="new-password"
                                placeholder="Password"
                                className="w-full bg-transparent outline-none text-base"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                aria-label="Password"
                                disabled={disableAll}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((s) => !s)}
                                className="ml-2 p-1"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                disabled={disableAll}
                            >
                                {showPassword ? <IoEyeOffOutline size={20} color={EKARI.dim} /> : <IoEyeOutline size={20} color={EKARI.dim} />}
                            </button>
                        </div>
                    </label>

                    {/* Confirm Password */}
                    <label className="block">
                        <div
                            className="mt-3 flex items-center rounded-xl border px-3 h-12 bg-[#F6F7FB]"
                            style={{ borderColor: EKARI.hair }}
                        >
                            <IoShieldCheckmarkOutline className="mr-2" size={18} color={EKARI.dim} />
                            <input
                                type={showPassword ? "text" : "password"}
                                autoComplete="new-password"
                                placeholder="Confirm password"
                                className="w-full bg-transparent outline-none text-base"
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
                    {!isValidEmail && email.length > 0 && (
                        <p className="mt-2 text-xs" style={{ color: EKARI.dim }}>
                            Enter a valid email address.
                        </p>
                    )}
                    {password.length > 0 && password.length < 6 && (
                        <p className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                            Password must be at least 6 characters.
                        </p>
                    )}
                    {confirm.length > 0 && confirm !== password && (
                        <p className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                            Passwords must match.
                        </p>
                    )}

                    {!!errorMsg && (
                        <p className="mt-3 text-center font-semibold" style={{ color: EKARI.danger }}>
                            {errorMsg}
                        </p>
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
                        <label htmlFor="consent" className="text-sm leading-5" style={{ color: EKARI.text }}>
                            By crafting account, you agree to our{" "}
                            <a
                                href="https://ekarihub.com/terms"
                                target="_blank"
                                rel="noreferrer"
                                className="underline font-semibold"
                                style={{ color: EKARI.forest }}
                            >
                                Terms and Conditions
                            </a>{" "}
                            and{" "}
                            <a
                                href="https://ekarihub.com/privacy"
                                target="_blank"
                                rel="noreferrer"
                                className="underline font-semibold"
                                style={{ color: EKARI.forest }}
                            >
                                Privacy Policy
                            </a>
                            .
                        </label>
                    </div>

                    {/* CTA */}
                    <button
                        onClick={handleSignup}
                        disabled={!isValid || disableAll}
                        className="mt-3 w-full rounded-xl overflow-hidden active:scale-[0.98] transition"
                    >
                        <div
                            className="py-3 text-center font-extrabold text-white bg-gradient-to-br from-[#C79257] to-[#C79257]"
                            style={{ opacity: !isValid || disableAll ? 0.6 : 1 }}
                        >
                            {loading ? (
                                <span className="inline-flex items-center gap-2">
                                    <span
                                        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent align-[-2px]"
                                        aria-hidden
                                    />
                                    Creating...
                                </span>
                            ) : (
                                "Craft account"
                            )}
                        </div>
                    </button>

                    {/* Login link */}
                    <div className="mt-3 flex justify-center items-center text-sm">
                        <span style={{ color: EKARI.dim }}>Already a member?&nbsp;</span>
                        <Link href="/login" className="font-extrabold" style={{ color: EKARI.text }}>
                            Log in
                        </Link>
                    </div>
                </motion.div>

                {/* Footer links */}
                <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs text-gray-500">
                    <Link href="/about">About</Link>
                    <Link href="/terms">T&amp;Cs</Link>
                    <Link href="/privacy">Privacy</Link>
                    <Link href="/craft-ad">Craft Ad</Link>
                    <Link href="/craft-page">Craft Page</Link>
                    <Link href="/viip">ViIP</Link>
                    <Link href="/celebrity">Celebrity</Link>
                </div>
            </div>
        </main>
    );
}
