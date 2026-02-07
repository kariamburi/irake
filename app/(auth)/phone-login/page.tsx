// app/phone-login/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { IoCallOutline, IoChevronBack } from "react-icons/io5";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
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

    const [captchaReady, setCaptchaReady] = useState(false);
    const [postAuthChecking, setPostAuthChecking] = useState(false);

    // Optional: support ?next=
    const [safeNext, setSafeNext] = useState<string | null>(null);

    // OTP & phone
    const [phone, setPhone] = useState("");
    const [code, setCode] = useState("");
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [confirmation, setConfirmation] =
        useState<import("firebase/auth").ConfirmationResult | null>(null);

    const [countdown, setCountdown] = useState(0);

    const otpInputsRef = useRef<Array<HTMLInputElement | null>>([]);
    const redirectingRef = useRef(false); // ✅ prevents double redirects
    const autoSubmitLockRef = useRef(false); // ✅ prevents multiple auto submits

    useEffect(() => {
        if (typeof window === "undefined") return;
        const sp = new URLSearchParams(window.location.search);
        const nextParam = sp.get("next");
        if (nextParam && nextParam.startsWith("/")) setSafeNext(nextParam);
        else setSafeNext(null);
    }, []);

    // Prepare invisible reCAPTCHA once
    useEffect(() => {
        if (typeof window === "undefined") return;

        if (window._ekariRecaptcha) {
            setCaptchaReady(true);
            return;
        }

        (async () => {
            try {
                const { RecaptchaVerifier } = await import("firebase/auth");
                window._ekariRecaptcha = new RecaptchaVerifier(auth, "recaptcha-container", {
                    size: "invisible",
                    callback: () => { },
                    "expired-callback": () => { },
                });
                setCaptchaReady(true);
            } catch {
                setCaptchaReady(false);
            }
        })();
    }, []);

    const focusOtpIndex = (i = 0) => {
        requestAnimationFrame(() => otpInputsRef.current[i]?.focus());
    };

    const setOtpAt = (idx: number, val: string) => {
        const digit = (val || "").replace(/[^\d]/g, "").slice(0, 1);
        const arr = code.split("");
        while (arr.length < 6) arr.push("");
        arr[idx] = digit;
        const next = arr.join("").slice(0, 6);
        setCode(next);
        return next;
    };

    useEffect(() => {
        if (!confirmation) return;
        autoSubmitLockRef.current = false; // reset auto submit lock when entering OTP step
        focusOtpIndex(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [confirmation]);

    // Countdown for resend
    useEffect(() => {
        if (countdown <= 0) return;
        const id = setInterval(() => setCountdown((c) => c - 1), 1000);
        return () => clearInterval(id);
    }, [countdown]);

    const e164 = useMemo(() => {
        const p = phone.trim();
        if (!p) return "";
        return p.startsWith("+") ? p : `+${p}`;
    }, [phone]);

    const validPhone = useMemo(() => /^\+\d{8,15}$/.test(e164), [e164]);
    const validCode = useMemo(() => /^\d{6}$/.test(code), [code]);

    const disableAll = authLoading || !captchaReady || postAuthChecking;

    // ✅ Strict check: must exist in Firestore users/{uid}, else sign out
    const ensureUserDocOrSignOut = async (uid: string) => {
        try {
            const snap = await getDoc(doc(db, "users", uid));
            if (!snap.exists()) {
                await auth.signOut();
                setErrorMsg("User does not exist. Please sign up first.");
                return false;
            }
            return true;
        } catch {
            await auth.signOut();
            setErrorMsg("Could not verify account. Please try again.");
            return false;
        }
    };

    // ✅ Post-login route (ONLY when not on OTP step, and not already redirecting)
    useEffect(() => {
        if (confirmation) return; // don't redirect while entering OTP
        if (redirectingRef.current) return;
        if (authLoading || postAuthChecking || !user) return;

        let alive = true;

        (async () => {
            try {
                setPostAuthChecking(true);
                const ok = await ensureUserDocOrSignOut(user.uid);
                if (!alive) return;
                if (!ok) return;

                redirectingRef.current = true;
                router.replace(safeNext ?? "/getstarted");
            } finally {
                if (alive) setPostAuthChecking(false);
            }
        })();

        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, authLoading, postAuthChecking, router, safeNext, confirmation]);

    const sendCode = async () => {
        if (!captchaReady || !validPhone || sending || disableAll) return;

        setErrorMsg("");
        setSending(true);

        try {
            const { signInWithPhoneNumber } = await import("firebase/auth");
            const verifier = window._ekariRecaptcha!;
            const conf = await signInWithPhoneNumber(auth, e164, verifier);

            setConfirmation(conf);
            setCountdown(60);
            setCode("");
            autoSubmitLockRef.current = false;

            setTimeout(() => focusOtpIndex(0), 0);
        } catch (err: any) {
            setErrorMsg(
                err?.code === "auth/network-request-failed"
                    ? "Network error. Check your connection."
                    : err?.message || "Invalid phone number."
            );

            try {
                window._ekariRecaptcha?.clear();
            } catch { }
            window._ekariRecaptcha = undefined;
            setCaptchaReady(false);
        } finally {
            setSending(false);
        }
    };

    const verifyCode = async () => {
        if (!confirmation || !validCode || verifying || disableAll) return;

        setErrorMsg("");
        setVerifying(true);
        setPostAuthChecking(true);

        try {
            const result = await confirmation.confirm(code);
            const uid = result?.user?.uid;

            if (!uid) {
                setErrorMsg("Something went wrong. Please try again.");
                return;
            }

            const ok = await ensureUserDocOrSignOut(uid);
            if (!ok) return;

            // ✅ clean up recaptcha
            try {
                window._ekariRecaptcha?.clear();
            } catch { }
            window._ekariRecaptcha = undefined;

            // ✅ prevent double redirect + flicker
            redirectingRef.current = true;

            router.replace(safeNext ?? "/getstarted");
            return; // ✅ IMPORTANT: stop further state flips
        } catch (err: any) {
            setErrorMsg(
                err?.code === "auth/invalid-verification-code"
                    ? "Invalid code. Try again."
                    : err?.message || "Something went wrong."
            );
            const idx = Math.min(code.length, 5);
            focusOtpIndex(idx);
        } finally {
            // ✅ don't flicker states if redirect already started
            if (!redirectingRef.current) {
                setPostAuthChecking(false);
                setVerifying(false);
            }
        }
    };

    // ✅ Auto-submit when last digit is entered (only on OTP step)
    useEffect(() => {
        if (!confirmation) return;
        if (!validCode) return;
        if (verifying || disableAll) return;
        if (autoSubmitLockRef.current) return;

        autoSubmitLockRef.current = true;
        verifyCode();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code, validCode, confirmation]);

    const backToNumber = () => {
        setConfirmation(null);
        setCode("");
        setErrorMsg("");
        setCountdown(0);
        autoSubmitLockRef.current = false;

        // You may want to recreate recaptcha when going back
        // but only if you cleared it earlier and captchaReady became false
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
                className="w-full max-w-md mx-auto"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
            >
                {/* Invisible reCAPTCHA anchor */}
                <div id="recaptcha-container" />

                {/* Top: logo + switch to email login */}
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Image src="/ekarihub-logo.png" alt="ekarihub" width={180} height={54} priority />
                    </div>
                    <Link
                        href="/login"
                        className="text-[11px] font-semibold underline-offset-4 hover:underline"
                        style={{ color: EKARI.dim }}
                    >
                        Use email instead
                    </Link>
                </div>

                {/* Card */}
                <motion.div
                    className="rounded-3xl bg-white/90 backdrop-blur-xl border border-white/70 shadow-[0_18px_60px_rgba(15,23,42,0.25)] px-6 py-7 md:px-7 md:py-8 relative"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                >
                    {/* Heading */}
                    <div className="mb-4">
                        <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-1 text-[11px] font-medium mb-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Secure phone sign-in
                        </p>
                        <h1
                            className="text-xl md:text-2xl font-semibold tracking-tight"
                            style={{ color: EKARI.text }}
                        >
                            {confirmation ? "Confirm your number" : "Verify your phone"}
                        </h1>
                        <p className="mt-1 text-xs md:text-sm leading-5" style={{ color: EKARI.dim }}>
                            {confirmation
                                ? "Enter the 6-digit code we’ve sent via SMS."
                                : "Use your mobile number to access ekarihub."}
                        </p>
                    </div>

                    {/* STEP 1: Enter phone */}
                    {!confirmation ? (
                        <>
                            <label className="block text-xs font-semibold mb-1.5">
                                <span style={{ color: EKARI.text }}>Phone number</span>
                            </label>
                            <div
                                className="flex items-center rounded-xl border px-3 h-11 bg-[#F6F7FB] focus-within:border-[rgba(35,63,57,0.7)] focus-within:ring-1 focus-within:ring-[rgba(35,63,57,0.6)] transition"
                                style={{ borderColor: EKARI.hair }}
                            >
                                <IoCallOutline className="mr-2 flex-shrink-0" size={18} color={EKARI.dim} />
                                <input
                                    type="tel"
                                    inputMode="tel"
                                    autoComplete="tel"
                                    placeholder="+2547XXXXXXXX"
                                    className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && sendCode()}
                                    aria-label="Phone number"
                                    disabled={disableAll || sending}
                                />
                            </div>

                            <p className="mt-1 text-[11px]" style={{ color: EKARI.dim }}>
                                Include your country code, e.g. <span className="font-semibold">+2547…</span>
                            </p>

                            {!!errorMsg && (
                                <div className="mt-3 flex justify-center">
                                    <p className="inline-flex items-center gap-2 rounded-full bg-[#FEF2F2] text-[12px] font-semibold px-3 py-1.5 text-[#B91C1C] border border-[#FECACA]">
                                        {errorMsg}
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={sendCode}
                                disabled={!validPhone || sending || disableAll}
                                className="mt-4 w-full rounded-xl overflow-hidden active:scale-[0.98] transition disabled:opacity-60"
                            >
                                <div
                                    className="py-3 text-center text-sm font-semibold text-white bg-gradient-to-br from-[#C79257] to-[#fbbf77]"
                                    style={{ opacity: !validPhone || sending || disableAll ? 0.7 : 1 }}
                                >
                                    {sending ? (
                                        <span className="inline-flex items-center gap-2">
                                            <span
                                                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent align-[-2px]"
                                                aria-hidden
                                            />
                                            Sending code...
                                        </span>
                                    ) : (
                                        "Send code"
                                    )}
                                </div>
                            </button>

                            <button
                                onClick={() => router.back()}
                                className="mx-auto mt-3 flex items-center gap-1 text-xs font-semibold hover:underline underline-offset-4"
                                style={{ color: EKARI.dim }}
                            >
                                <IoChevronBack size={16} />
                                Back
                            </button>
                        </>
                    ) : (
                        /* STEP 2: Enter code */
                        <>
                            <label className="block text-xs font-semibold mb-1.5">
                                <span style={{ color: EKARI.text }}>Verification code</span>
                            </label>

                            <div
                                className="relative mt-1"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    const idx = Math.min(code.length, 5);
                                    focusOtpIndex(idx);
                                }}
                                onTouchStart={() => {
                                    const idx = Math.min(code.length, 5);
                                    focusOtpIndex(idx);
                                }}
                            >
                                <div className="flex justify-between gap-2">
                                    {Array.from({ length: 6 }).map((_, i) => {
                                        const char = code[i] ?? "";
                                        const active = i === code.length || (code.length === 6 && i === 5);

                                        return (
                                            <input
                                                key={i}
                                                ref={(el) => {
                                                    otpInputsRef.current[i] = el;
                                                }}
                                                value={char}
                                                inputMode="numeric"
                                                pattern="\d*"
                                                maxLength={1}
                                                autoComplete={i === 0 ? "one-time-code" : "off"}
                                                aria-label={`OTP digit ${i + 1}`}
                                                className="w-10 h-12 rounded-xl border bg-[#F6F7FB] text-center text-[20px] font-extrabold outline-none"
                                                style={{
                                                    borderColor: char ? "#D1D5DB" : EKARI.hair,
                                                    backgroundColor: char ? "#FFFFFF" : "#F6F7FB",
                                                    boxShadow: active ? `0 0 0 1px ${EKARI.leaf} inset` : "none",
                                                    color: EKARI.text,
                                                }}
                                                onChange={(e) => {
                                                    const vRaw = e.target.value ?? "";
                                                    const v = vRaw.replace(/[^\d]/g, "");

                                                    if (!v) {
                                                        autoSubmitLockRef.current = false; // allow re-submit after edits
                                                        setOtpAt(i, "");
                                                        return;
                                                    }

                                                    const digits = v.slice(0, 6 - i).split("");
                                                    const arr = code.split("");
                                                    while (arr.length < 6) arr.push("");

                                                    digits.forEach((d, k) => {
                                                        arr[i + k] = d;
                                                    });

                                                    const nextCode = arr.join("").slice(0, 6);
                                                    setCode(nextCode);

                                                    // If user edits again, allow auto-submit again
                                                    if (nextCode.length < 6) autoSubmitLockRef.current = false;

                                                    const nextIndex = Math.min(i + digits.length, 5);
                                                    requestAnimationFrame(() => otpInputsRef.current[nextIndex]?.focus());
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Backspace") {
                                                        e.preventDefault();
                                                        if (char) {
                                                            autoSubmitLockRef.current = false;
                                                            setOtpAt(i, "");
                                                            return;
                                                        }
                                                        const prev = Math.max(i - 1, 0);
                                                        autoSubmitLockRef.current = false;
                                                        setOtpAt(prev, "");
                                                        requestAnimationFrame(() => otpInputsRef.current[prev]?.focus());
                                                    }

                                                    if (e.key === "ArrowLeft") {
                                                        e.preventDefault();
                                                        const prev = Math.max(i - 1, 0);
                                                        requestAnimationFrame(() => otpInputsRef.current[prev]?.focus());
                                                    }
                                                    if (e.key === "ArrowRight") {
                                                        e.preventDefault();
                                                        const next = Math.min(i + 1, 5);
                                                        requestAnimationFrame(() => otpInputsRef.current[next]?.focus());
                                                    }

                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        verifyCode();
                                                    }
                                                }}
                                                onPaste={(e) => {
                                                    e.preventDefault();
                                                    const text = e.clipboardData.getData("text");
                                                    const digits = text.replace(/[^\d]/g, "").slice(0, 6);
                                                    if (!digits) return;

                                                    autoSubmitLockRef.current = false;

                                                    const arr = digits.split("");
                                                    while (arr.length < 6) arr.push("");
                                                    setCode(arr.join("").slice(0, 6));

                                                    requestAnimationFrame(() =>
                                                        otpInputsRef.current[Math.min(digits.length - 1, 5)]?.focus()
                                                    );
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                            </div>

                            {!!errorMsg && (
                                <div className="mt-3 flex justify-center">
                                    <p className="inline-flex items-center gap-2 rounded-full bg-[#FEF2F2] text-[12px] font-semibold px-3 py-1.5 text-[#B91C1C] border border-[#FECACA]">
                                        {errorMsg}
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={verifyCode}
                                disabled={!validCode || verifying || disableAll}
                                className="mt-4 w-full rounded-xl overflow-hidden active:scale-[0.98] transition disabled:opacity-60"
                            >
                                <div
                                    className="py-3 text-center text-sm font-semibold text-white bg-gradient-to-br from-[#C79257] to-[#fbbf77]"
                                    style={{ opacity: !validCode || verifying || disableAll ? 0.7 : 1 }}
                                >
                                    {verifying ? (
                                        <span className="inline-flex items-center gap-2">
                                            <span
                                                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent align-[-2px]"
                                                aria-hidden
                                            />
                                            Verifying...
                                        </span>
                                    ) : (
                                        "Verify"
                                    )}
                                </div>
                            </button>

                            <div className="mt-3 flex items-center justify-between text-xs">
                                <button
                                    disabled={countdown > 0 || disableAll}
                                    onClick={sendCode}
                                    className="font-semibold underline-offset-4 hover:underline disabled:no-underline"
                                    style={{
                                        color: EKARI.text,
                                        opacity: countdown > 0 || disableAll ? 0.5 : 1,
                                    }}
                                >
                                    Resend code{countdown > 0 ? ` (${countdown}s)` : ""}
                                </button>

                                <button
                                    onClick={backToNumber}
                                    className="font-semibold underline-offset-4 hover:underline"
                                    style={{ color: EKARI.dim }}
                                >
                                    Change number
                                </button>
                            </div>
                        </>
                    )}

                    <p className="mt-5 text-[11px] leading-5" style={{ color: EKARI.dim }}>
                        By continuing, you agree to our{" "}
                        <Link href="/terms" className="underline font-semibold" style={{ color: EKARI.forest }}>
                            Terms
                        </Link>{" "}
                        and{" "}
                        <Link href="/privacy" className="underline font-semibold" style={{ color: EKARI.forest }}>
                            Privacy Policy
                        </Link>
                        .
                    </p>
                </motion.div>
            </motion.div>
        </main>
    );
}
