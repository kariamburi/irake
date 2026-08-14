"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { IoCallOutline, IoChevronBack } from "react-icons/io5";
import { doc, getDoc } from "firebase/firestore";
import { db, getAuthSafe } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";

/** ✅ Country list (flags + dial codes) */
const COUNTRIES = [
    { code: "KE", dial: "+254", flag: "🇰🇪", name: "Kenya" },
    { code: "UG", dial: "+256", flag: "🇺🇬", name: "Uganda" },
    { code: "TZ", dial: "+255", flag: "🇹🇿", name: "Tanzania" },
    { code: "RW", dial: "+250", flag: "🇷🇼", name: "Rwanda" },
    { code: "BI", dial: "+257", flag: "🇧🇮", name: "Burundi" },
    { code: "ET", dial: "+251", flag: "🇪🇹", name: "Ethiopia" },
    { code: "SO", dial: "+252", flag: "🇸🇴", name: "Somalia" },
    { code: "SS", dial: "+211", flag: "🇸🇸", name: "South Sudan" },
    { code: "SD", dial: "+249", flag: "🇸🇩", name: "Sudan" },
    { code: "NG", dial: "+234", flag: "🇳🇬", name: "Nigeria" },
    { code: "GH", dial: "+233", flag: "🇬🇭", name: "Ghana" },
    { code: "ZA", dial: "+27", flag: "🇿🇦", name: "South Africa" },
    { code: "EG", dial: "+20", flag: "🇪🇬", name: "Egypt" },
    { code: "DZ", dial: "+213", flag: "🇩🇿", name: "Algeria" },
    { code: "MA", dial: "+212", flag: "🇲🇦", name: "Morocco" },
    { code: "TN", dial: "+216", flag: "🇹🇳", name: "Tunisia" },
    { code: "LY", dial: "+218", flag: "🇱🇾", name: "Libya" },
    { code: "SN", dial: "+221", flag: "🇸🇳", name: "Senegal" },
    { code: "CI", dial: "+225", flag: "🇨🇮", name: "Côte d’Ivoire" },
    { code: "CM", dial: "+237", flag: "🇨🇲", name: "Cameroon" },
    { code: "ZW", dial: "+263", flag: "🇿🇼", name: "Zimbabwe" },
    { code: "ZM", dial: "+260", flag: "🇿🇲", name: "Zambia" },
    { code: "MW", dial: "+265", flag: "🇲🇼", name: "Malawi" },
    { code: "MZ", dial: "+258", flag: "🇲🇿", name: "Mozambique" },

    { code: "US", dial: "+1", flag: "🇺🇸", name: "United States" },
    { code: "CA", dial: "+1", flag: "🇨🇦", name: "Canada" },
    { code: "MX", dial: "+52", flag: "🇲🇽", name: "Mexico" },
    { code: "BR", dial: "+55", flag: "🇧🇷", name: "Brazil" },
    { code: "AR", dial: "+54", flag: "🇦🇷", name: "Argentina" },
    { code: "CL", dial: "+56", flag: "🇨🇱", name: "Chile" },
    { code: "CO", dial: "+57", flag: "🇨🇴", name: "Colombia" },

    { code: "GB", dial: "+44", flag: "🇬🇧", name: "United Kingdom" },
    { code: "DE", dial: "+49", flag: "🇩🇪", name: "Germany" },
    { code: "FR", dial: "+33", flag: "🇫🇷", name: "France" },
    { code: "IT", dial: "+39", flag: "🇮🇹", name: "Italy" },
    { code: "ES", dial: "+34", flag: "🇪🇸", name: "Spain" },
    { code: "NL", dial: "+31", flag: "🇳🇱", name: "Netherlands" },
    { code: "SE", dial: "+46", flag: "🇸🇪", name: "Sweden" },
    { code: "NO", dial: "+47", flag: "🇳🇴", name: "Norway" },

    { code: "IN", dial: "+91", flag: "🇮🇳", name: "India" },
    { code: "PK", dial: "+92", flag: "🇵🇰", name: "Pakistan" },
    { code: "BD", dial: "+880", flag: "🇧🇩", name: "Bangladesh" },
    { code: "CN", dial: "+86", flag: "🇨🇳", name: "China" },
    { code: "JP", dial: "+81", flag: "🇯🇵", name: "Japan" },
    { code: "KR", dial: "+82", flag: "🇰🇷", name: "South Korea" },
    { code: "SG", dial: "+65", flag: "🇸🇬", name: "Singapore" },
    { code: "AE", dial: "+971", flag: "🇦🇪", name: "United Arab Emirates" },
    { code: "SA", dial: "+966", flag: "🇸🇦", name: "Saudi Arabia" },

    { code: "AU", dial: "+61", flag: "🇦🇺", name: "Australia" },
    { code: "NZ", dial: "+64", flag: "🇳🇿", name: "New Zealand" },
] as const;

type Country = typeof COUNTRIES[number];

const flagUrl = (code: string) =>
    `https://flagcdn.com/24x18/${code.toLowerCase()}.png`;

const POPULAR = ["KE", "UG", "TZ", "RW", "US", "GB"] as const;

const SORTED_COUNTRIES = [
    ...COUNTRIES.filter((c) => (POPULAR as readonly string[]).includes(c.code)),
    ...COUNTRIES
        .filter((c) => !(POPULAR as readonly string[]).includes(c.code))
        .sort((a, b) => a.name.localeCompare(b.name)),
];

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
        _ekariRecaptcha?: any;
    }
}

function CountryPicker({
    value,
    onChange,
    disabled,
}: {
    value: Country;
    onChange: (c: Country) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = React.useState(false);
    const [q, setQ] = React.useState("");

    const filtered = React.useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return COUNTRIES;
        return COUNTRIES.filter(
            (c) =>
                c.name.toLowerCase().includes(s) ||
                c.code.toLowerCase().includes(s) ||
                c.dial.includes(s)
        );
    }, [q]);

    React.useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            const t = e.target as HTMLElement;
            if (!t.closest?.("[data-country-picker-root]")) setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [open]);

    return (
        <div className="relative" data-country-picker-root>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((s) => !s)}
                className="h-9 px-2 rounded-lg hover:bg-black/5 disabled:opacity-60 inline-flex items-center gap-2 text-sm font-semibold"
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <img
                    src={flagUrl(value.code)}
                    alt={`${value.name} flag`}
                    width={18}
                    height={14}
                    className="rounded-[2px] border border-black/10"
                />
                <span className="text-slate-900">{value.dial}</span>
                <span className="text-slate-500 hidden sm:inline">• {value.code}</span>
                <svg width="14" height="14" viewBox="0 0 20 20" className="ml-1 opacity-70">
                    <path d="M5 7l5 6 5-6" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
            </button>

            {open && (
                <div
                    className="absolute z-50 mt-2 w-[260px] rounded-xl border border-black/10 bg-white shadow-xl overflow-hidden"
                    role="listbox"
                >
                    <div className="p-2 border-b border-black/5">
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search country…"
                            className="h-9 w-full rounded-lg border border-black/10 bg-[#F6F7FB] px-3 text-sm outline-none"
                            autoFocus
                        />
                    </div>

                    <div className="max-h-64 overflow-auto">
                        {filtered.map((c) => {
                            const active = c.code === value.code;
                            return (
                                <button
                                    key={c.code}
                                    type="button"
                                    onClick={() => {
                                        onChange(c);
                                        setOpen(false);
                                        setQ("");
                                    }}
                                    className={`w-full px-3 py-2 flex items-center gap-2 text-left text-sm hover:bg-black/5 ${active ? "bg-black/5" : ""}`}
                                    role="option"
                                    aria-selected={active}
                                >
                                    <img
                                        src={flagUrl(c.code)}
                                        alt=""
                                        width={18}
                                        height={14}
                                        className="rounded-[2px] border border-black/10"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="font-semibold text-slate-900 truncate">{c.name}</div>
                                        <div className="text-xs text-slate-500">{c.dial} • {c.code}</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function PhoneLoginPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const [authBundle, setAuthBundle] = useState<{ auth: any } | null>(null);
    const [firebaseReady, setFirebaseReady] = useState(true);

    const [captchaReady, setCaptchaReady] = useState(false);
    const [postAuthChecking, setPostAuthChecking] = useState(false);
    const [safeNext, setSafeNext] = useState<string>("/");

    const [country, setCountry] = useState(() => {
        const def = SORTED_COUNTRIES.find((c) => c.code === "KE") ?? SORTED_COUNTRIES[0];
        return def;
    });
    const [localPhone, setLocalPhone] = useState("");

    const [code, setCode] = useState("");
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [confirmation, setConfirmation] =
        useState<import("firebase/auth").ConfirmationResult | null>(null);

    const [countdown, setCountdown] = useState(0);

    const otpInputsRef = useRef<Array<HTMLInputElement | null>>([]);
    const verifyingOnceRef = useRef(false);

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
    };

    useEffect(() => {
        (async () => {
            const bundle = await getAuthSafe();
            if (bundle) {
                setAuthBundle({ auth: bundle.auth });
            } else {
                setFirebaseReady(false);
            }
        })();
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const sp = new URLSearchParams(window.location.search);
        const nextParam = sp.get("next");

        if (nextParam && nextParam.startsWith("/")) setSafeNext(nextParam);
        else setSafeNext("/");
    }, []);

    useEffect(() => {
        if (!authBundle?.auth) return;
        if (window._ekariRecaptcha) {
            setCaptchaReady(true);
            return;
        }

        (async () => {
            try {
                const { RecaptchaVerifier } = await import("firebase/auth");
                window._ekariRecaptcha = new RecaptchaVerifier(
                    authBundle.auth,
                    "recaptcha-container",
                    {
                        size: "invisible",
                        callback: () => { },
                        "expired-callback": () => { },
                    }
                );
                setCaptchaReady(true);
            } catch {
                setCaptchaReady(false);
            }
        })();
    }, [authBundle]);

    useEffect(() => {
        if (!confirmation) return;
        verifyingOnceRef.current = false;
        focusOtpIndex(0);
    }, [confirmation]);

    useEffect(() => {
        if (countdown <= 0) return;
        const id = setInterval(() => setCountdown((c) => c - 1), 1000);
        return () => clearInterval(id);
    }, [countdown]);

    const e164 = useMemo(() => {
        if (!localPhone) return "";
        return `${country.dial}${localPhone.replace(/\D/g, "")}`;
    }, [country, localPhone]);

    const validPhone = useMemo(() => /^\+\d{8,15}$/.test(e164), [e164]);
    const validCode = useMemo(() => /^\d{6}$/.test(code), [code]);

    const disableAll =
        authLoading || !authBundle?.auth || !captchaReady || postAuthChecking || !firebaseReady;

    const firebaseAuthErrorMessage = (err: any) => {
        const code = String(err?.code || "");

        const map: Record<string, string> = {
            "auth/network-request-failed": "Network error. Check your connection and try again.",
            "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
            "auth/invalid-phone-number": "That phone number looks invalid. Check the country code and number.",
            "auth/missing-phone-number": "Please enter your phone number.",
            "auth/quota-exceeded": "SMS quota exceeded. Please try again later.",
            "auth/captcha-check-failed": "reCAPTCHA failed. Refresh the page and try again.",
            "auth/app-not-authorized": "This app/domain is not authorized for phone sign-in.",
            "auth/operation-not-allowed": "Phone sign-in is disabled. Enable it in Firebase Auth settings.",
            "auth/user-disabled": "This account has been disabled. Contact support.",
            "auth/invalid-verification-code": "Invalid code. Try again.",
            "auth/code-expired": "That code expired. Please request a new one.",
            "auth/session-expired": "Session expired. Please request a new code.",
            "auth/missing-verification-code": "Enter the 6-digit code.",
            "auth/credential-already-in-use":
                "That phone number is already linked to another account. Try email sign-in or use a different number.",
        };

        if (map[code]) return map[code];

        const raw = String(err?.message || "");
        if (raw.includes("Firebase: Error")) return "Something went wrong. Please try again.";

        return raw || "Something went wrong. Please try again.";
    };

    const ensureUserDocOrSignOut = async (uid: string) => {
        try {
            const snap = await getDoc(doc(db, "users", uid));

            if (!snap.exists()) {
                if (authBundle?.auth) {
                    await authBundle.auth.signOut();
                }
                setErrorMsg("User does not exist. Please sign up first.");
                return false;
            }

            return true;
        } catch {
            if (authBundle?.auth) {
                await authBundle.auth.signOut();
            }
            setErrorMsg("Could not verify account. Please try again.");
            return false;
        }
    };

    useEffect(() => {
        if (authLoading || !user) return;

        let alive = true;

        (async () => {
            try {
                setPostAuthChecking(true);
                const ok = await ensureUserDocOrSignOut(user.uid);
                if (!alive) return;
                if (!ok) return;
                router.replace(safeNext);
            } finally {
                if (alive) setPostAuthChecking(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [user, authLoading, router, safeNext, authBundle]);

    const sendCode = async () => {
        if (!authBundle?.auth || !captchaReady || !validPhone || sending || disableAll) return;

        setErrorMsg("");
        setSending(true);

        try {
            const { signInWithPhoneNumber } = await import("firebase/auth");
            const verifier = window._ekariRecaptcha!;
            const conf = await signInWithPhoneNumber(authBundle.auth, e164, verifier);

            setConfirmation(conf);
            setCountdown(60);

            setTimeout(() => focusOtpIndex(0), 0);
        } catch (err: any) {
            setErrorMsg(firebaseAuthErrorMessage(err));

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
        if (verifyingOnceRef.current) return;
        verifyingOnceRef.current = true;

        setErrorMsg("");
        setVerifying(true);
        setPostAuthChecking(true);

        try {
            const result = await confirmation.confirm(code);
            const uid = result?.user?.uid;

            if (!uid) {
                setErrorMsg("Something went wrong. Please try again.");
                verifyingOnceRef.current = false;
                return;
            }

            const ok = await ensureUserDocOrSignOut(uid);
            if (!ok) {
                verifyingOnceRef.current = false;
                return;
            }

            try {
                window._ekariRecaptcha?.clear();
            } catch { }

            window._ekariRecaptcha = undefined;
            router.replace(safeNext);
        } catch (err: any) {
            verifyingOnceRef.current = false;
            setErrorMsg(
                err?.code === "auth/invalid-verification-code"
                    ? "Invalid code. Try again."
                    : err?.message || "Something went wrong."
            );

            const idx = Math.min(code.length, 5);
            focusOtpIndex(idx);
        } finally {
            setPostAuthChecking(false);
            setVerifying(false);
        }
    };

    useEffect(() => {
        if (!confirmation) return;
        if (!validCode) return;
        if (disableAll) return;
        if (verifying) return;
        verifyCode();
    }, [code, confirmation, validCode]);

    const backToNumber = () => {
        setConfirmation(null);
        setCode("");
        setErrorMsg("");
        setCountdown(0);
        verifyingOnceRef.current = false;
    };

    const showSignupLink = useMemo(
        () => errorMsg.toLowerCase().includes("sign up"),
        [errorMsg]
    );

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
                <div id="recaptcha-container" />

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

                <motion.div
                    className="rounded-3xl bg-white/90 backdrop-blur-xl border border-white/70 shadow-[0_18px_60px_rgba(15,23,42,0.25)] px-6 py-7 md:px-7 md:py-8 relative"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                >
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

                    {!firebaseReady && (
                        <p className="mb-3 text-sm font-semibold" style={{ color: EKARI.danger }}>
                            Firebase is not configured yet.
                        </p>
                    )}

                    {!confirmation ? (
                        <>
                            <label className="block text-xs font-semibold mb-1.5">
                                <span style={{ color: EKARI.text }}>Phone number</span>
                            </label>

                            <div
                                className="flex items-center h-11 rounded-xl border bg-[#F6F7FB] px-2 gap-2
                                focus-within:border-[rgba(35,63,57,0.7)]
                                focus-within:ring-1 focus-within:ring-[rgba(35,63,57,0.6)]"
                                style={{ borderColor: EKARI.hair }}
                            >
                                <IoCallOutline className="ml-1 flex-shrink-0" size={18} color={EKARI.dim} />

                                <CountryPicker
                                    value={country}
                                    onChange={setCountry}
                                    disabled={disableAll || sending}
                                />

                                <div className="h-6 w-px bg-gray-300" />

                                <input
                                    type="tel"
                                    inputMode="numeric"
                                    autoComplete="tel-national"
                                    placeholder="712345678"
                                    maxLength={12}
                                    className="flex-1 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
                                    value={localPhone}
                                    onChange={(e) => setLocalPhone(e.target.value.replace(/[^\d]/g, ""))}
                                    onKeyDown={(e) => e.key === "Enter" && sendCode()}
                                    aria-label="Phone number"
                                    disabled={disableAll || sending}
                                />
                            </div>

                            <div className="mt-1 text-[11px]" style={{ color: EKARI.dim }}>
                                Sending to: <span className="font-semibold">{e164 || `${country.dial}…`}</span>
                            </div>

                            {!!errorMsg && (
                                <div className="mt-3 flex flex-col items-center gap-2">
                                    <p className="inline-flex items-center gap-2 rounded-full bg-[#FEF2F2] text-[12px] font-semibold px-3 py-1.5 text-[#B91C1C] border border-[#FECACA]">
                                        {errorMsg}
                                    </p>

                                    {showSignupLink && (
                                        <a
                                            href="https://www.ekarihub.com/signup"
                                            className="text-[12px] font-semibold underline underline-offset-4"
                                            style={{ color: EKARI.forest }}
                                        >
                                            Create an account (Sign up)
                                        </a>
                                    )}
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

                                                    const nextIndex = Math.min(i + digits.length, 5);
                                                    requestAnimationFrame(() => otpInputsRef.current[nextIndex]?.focus());
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Backspace") {
                                                        e.preventDefault();
                                                        if (char) {
                                                            setOtpAt(i, "");
                                                            return;
                                                        }
                                                        const prev = Math.max(i - 1, 0);
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
                                <div className="mt-3 flex flex-col items-center gap-2">
                                    <p className="inline-flex items-center gap-2 rounded-full bg-[#FEF2F2] text-[12px] font-semibold px-3 py-1.5 text-[#B91C1C] border border-[#FECACA]">
                                        {errorMsg}
                                    </p>

                                    {showSignupLink && (
                                        <a
                                            href="https://www.ekarihub.com/signup"
                                            className="text-[12px] font-semibold underline underline-offset-4"
                                            style={{ color: EKARI.forest }}
                                        >
                                            Create an account
                                        </a>
                                    )}
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