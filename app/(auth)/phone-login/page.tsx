"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { IoCallOutline, IoChevronBack } from "react-icons/io5";
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
    danger: "#B42318",
};

declare global {
    interface Window {
        _ekariRecaptcha?: any; // RecaptchaVerifier instance
    }
}

export default function PhoneLoginPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    // Load Firebase auth safely (client-only)
    const [authBundle, setAuthBundle] = useState<{ auth: any } | null>(null);
    const [captchaReady, setCaptchaReady] = useState(false);

    useEffect(() => {
        (async () => {
            const bundle = await getAuthSafe();
            if (!bundle) return; // SSR no-op
            setAuthBundle({ auth: bundle.auth });
        })();
    }, []);

    // Prepare invisible reCAPTCHA once auth is ready
    useEffect(() => {
        if (!authBundle) return;
        if (typeof window === "undefined") return;
        if (window._ekariRecaptcha) {
            setCaptchaReady(true);
            return;
        }

        (async () => {
            try {
                const { RecaptchaVerifier } = await import("firebase/auth");
                window._ekariRecaptcha = new RecaptchaVerifier(authBundle.auth, "recaptcha-container", {
                    size: "invisible",
                    callback: () => { },
                    "expired-callback": () => { },
                });
                setCaptchaReady(true);
            } catch {
                setCaptchaReady(false);
            }
        })();

        // We keep the verifier for the session to avoid double-init issues
    }, [authBundle]);

    // Form state
    const [phone, setPhone] = useState(""); // E.164 e.g. +2547...
    const [code, setCode] = useState("");   // 6-digit OTP
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [confirmation, setConfirmation] = useState<import("firebase/auth").ConfirmationResult | null>(null);

    // Resend timer
    const [countdown, setCountdown] = useState(0);

    const e164 = useMemo(() => {
        const p = phone.trim();
        if (!p) return "";
        return p.startsWith("+") ? p : `+${p}`;
    }, [phone]);

    const validPhone = useMemo(() => /^\+\d{8,15}$/.test(e164), [e164]);
    const validCode = useMemo(() => /^\d{6}$/.test(code), [code]);

    // Post-login route (mirror login/signup pages)
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

    const sendCode = async () => {
        if (!authBundle || !captchaReady || !validPhone || sending) return;
        setErrorMsg("");
        setSending(true);
        try {
            const { signInWithPhoneNumber } = await import("firebase/auth");
            const verifier = window._ekariRecaptcha!;
            const conf = await signInWithPhoneNumber(authBundle.auth, e164, verifier);
            setConfirmation(conf);
            setCountdown(60);
        } catch (err: any) {
            setErrorMsg(
                err?.code === "auth/network-request-failed"
                    ? "Network error. Check your connection."
                    : err?.message || "Invalid phone number."
            );
            try { window._ekariRecaptcha?.clear(); } catch { }
            window._ekariRecaptcha = undefined;
            setCaptchaReady(false);
            // Try to re-init captcha on next render
        } finally {
            setSending(false);
        }
    };

    const verifyCode = async () => {
        if (!confirmation || !validCode || verifying) return;
        setErrorMsg("");
        setVerifying(true);
        try {
            await confirmation.confirm(code); // signs the user in -> redirect happens in effect
        } catch (err: any) {
            setErrorMsg(
                err?.code === "auth/invalid-verification-code"
                    ? "Invalid code. Try again."
                    : err?.message || "Something went wrong."
            );
        } finally {
            setVerifying(false);
        }
    };

    // Countdown for resend
    useEffect(() => {
        if (countdown <= 0) return;
        const id = setInterval(() => setCountdown((c) => c - 1), 1000);
        return () => clearInterval(id);
    }, [countdown]);

    const backToNumber = () => {
        setConfirmation(null);
        setCode("");
        setErrorMsg("");
        setCountdown(0);
    };

    const disableAll = authLoading || !authBundle || !captchaReady;

    return (
        <main className="min-h-screen w-full flex flex-col justify-center px-5 items-center" style={{ backgroundColor: EKARI.sand }}>
            <div className="w-full max-w-xl flex flex-col items-center gap-4">
                {/* Invisible reCAPTCHA anchor */}
                <div id="recaptcha-container" />

                <div className="flex flex-col items-center gap-4">
                    {/* Logo */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 140, damping: 14, mass: 0.6, duration: 0.28 }}
                    >
                        <Image src="/ekarihub-logo.png" alt="ekarihub" width={320} height={86} priority />
                    </motion.div>

                    {/* Tagline */}
                    <motion.p
                        className="text-center text-sm leading-5"
                        style={{ color: "#5C6B66", maxWidth: 340 }}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15, duration: 0.25 }}
                    >
                        {confirmation ? "Enter the 6-digit code we sent you" : "Verify your phone to continue"}
                    </motion.p>

                    {/* Card */}
                    <motion.div
                        className="w-full rounded-2xl bg-white/95 px-4 py-4 mt-2"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.26, ease: "easeOut" }}
                    >
                        {!confirmation ? (
                            <>
                                <label className="block font-extrabold mb-1" style={{ color: EKARI.text }}>
                                    Your phone number
                                </label>
                                <div
                                    className="flex items-center rounded-xl border px-3 h-12 bg-[#F6F7FB]"
                                    style={{ borderColor: EKARI.hair }}
                                >
                                    <IoCallOutline className="mr-2" size={18} color={EKARI.dim} />
                                    <input
                                        type="tel"
                                        inputMode="tel"
                                        autoComplete="tel"
                                        placeholder="+2547XXXXXXXX"
                                        className="w-full bg-transparent outline-none text-base"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && sendCode()}
                                        aria-label="Phone number"
                                        disabled={disableAll || sending}
                                    />
                                </div>

                                {!!errorMsg && (
                                    <p className="mt-3 text-center font-semibold" style={{ color: EKARI.danger }}>
                                        {errorMsg}
                                    </p>
                                )}

                                <button
                                    onClick={sendCode}
                                    disabled={!validPhone || sending || disableAll}
                                    className="mt-4 w-full rounded-xl overflow-hidden active:scale-[0.98] transition"
                                >
                                    <div
                                        className="py-3 text-center font-extrabold text-white bg-gradient-to-br from-[#C79257] to-[#C79257]"
                                        style={{ opacity: !validPhone || sending || disableAll ? 0.6 : 1 }}
                                    >
                                        {sending ? (
                                            <span className="inline-flex items-center gap-2">
                                                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent align-[-2px]" />
                                                Sending...
                                            </span>
                                        ) : (
                                            "Send code"
                                        )}
                                    </div>
                                </button>

                                <button
                                    onClick={() => router.back()}
                                    className="mx-auto mt-3 flex items-center gap-1 font-bold"
                                    style={{ color: EKARI.dim }}
                                >
                                    <IoChevronBack size={18} />
                                    Back
                                </button>
                            </>
                        ) : (
                            <>
                                <label className="block font-extrabold mb-1" style={{ color: EKARI.text }}>
                                    Enter verification code
                                </label>

                                {/* OTP boxes (display only) */}
                                <div className="mt-1 flex justify-between">
                                    {Array.from({ length: 6 }).map((_, i) => {
                                        const char = code[i] ?? "";
                                        const active = i === code.length;
                                        const base = "w-11 h-13 rounded-xl border flex items-center justify-center select-none";
                                        return (
                                            <div
                                                key={i}
                                                className={base}
                                                style={{
                                                    borderColor: char ? "#D1D5DB" : EKARI.hair,
                                                    backgroundColor: char ? "#FFFFFF" : "#F6F7FB",
                                                    boxShadow: active ? `0 0 0 1px ${EKARI.leaf} inset` : "none",
                                                }}
                                            >
                                                <span className="text-[20px] font-extrabold" style={{ color: EKARI.text }}>
                                                    {char}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Hidden input that actually captures the OTP */}
                                <input
                                    autoFocus
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                                    inputMode="numeric"
                                    pattern="\d*"
                                    maxLength={6}
                                    aria-label="One-time code"
                                    className="absolute opacity-0 pointer-events-none h-0 w-0"
                                />

                                {!!errorMsg && (
                                    <p className="mt-3 text-center font-semibold" style={{ color: EKARI.danger }}>
                                        {errorMsg}
                                    </p>
                                )}

                                <button
                                    onClick={verifyCode}
                                    disabled={!validCode || verifying || disableAll}
                                    className="mt-4 w-full rounded-xl overflow-hidden active:scale-[0.98] transition"
                                >
                                    <div
                                        className="py-3 text-center font-extrabold text-white bg-gradient-to-br from-[#C79257] to-[#C79257]"
                                        style={{ opacity: !validCode || verifying || disableAll ? 0.6 : 1 }}
                                    >
                                        {verifying ? (
                                            <span className="inline-flex items-center gap-2">
                                                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent align-[-2px]" />
                                                Verifying...
                                            </span>
                                        ) : (
                                            "Verify"
                                        )}
                                    </div>
                                </button>

                                {/* Resend + change number */}
                                <div className="mt-3 flex items-center justify-between">
                                    <button
                                        disabled={countdown > 0 || disableAll}
                                        onClick={sendCode}
                                        className="font-extrabold"
                                        style={{ color: EKARI.text, opacity: countdown > 0 || disableAll ? 0.5 : 1 }}
                                    >
                                        Resend code{countdown > 0 ? ` (${countdown}s)` : ""}
                                    </button>

                                    <button onClick={backToNumber} className="font-bold" style={{ color: EKARI.dim }}>
                                        Change number
                                    </button>
                                </div>
                            </>
                        )}

                        <label className="mt-4 text-sm leading-5" style={{ color: EKARI.text }}>
                            By continuing, you agree to our{" "}
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
                    </motion.div>
                </div>

                <div className="h-2" />
            </div>
        </main>
    );
}
