"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    IoArrowBackOutline,
    IoArrowForwardOutline,
    IoCallOutline,
    IoCheckmarkCircleOutline,
    IoChevronDownOutline,
    IoLockClosedOutline,
    IoPhonePortraitOutline,
    IoShieldCheckmarkOutline,
    IoSparklesOutline,
} from "react-icons/io5";
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
    forest: "#173C2E",
    leaf: "#214C3A",
    gold: "#c69258",
    sand: "#F8F7F2",
    hair: "#DDD8CC",
    text: "#0F172A",
    dim: "#64748B",
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
    const [open, setOpen] =
        React.useState(false);

    const [q, setQ] =
        React.useState("");

    const filtered =
        React.useMemo(() => {
            const s =
                q.trim().toLowerCase();

            if (!s) {
                return COUNTRIES;
            }

            return COUNTRIES.filter(
                (c) =>
                    c.name
                        .toLowerCase()
                        .includes(s) ||
                    c.code
                        .toLowerCase()
                        .includes(s) ||
                    c.dial.includes(s)
            );
        }, [q]);

    React.useEffect(() => {
        if (!open) return;

        const onDown = (
            e: MouseEvent
        ) => {
            const t =
                e.target as HTMLElement;

            if (
                !t.closest?.(
                    "[data-country-picker-root]"
                )
            ) {
                setOpen(false);
            }
        };

        document.addEventListener(
            "mousedown",
            onDown
        );

        return () =>
            document.removeEventListener(
                "mousedown",
                onDown
            );
    }, [open]);

    return (
        <div
            className="relative shrink-0"
            data-country-picker-root
        >
            <button
                type="button"
                disabled={disabled}
                onClick={() =>
                    setOpen(
                        (value) =>
                            !value
                    )
                }
                className={[
                    "inline-flex h-10 items-center gap-2",
                    "rounded-xl px-2.5",
                    "text-[10px] font-black text-slate-700",
                    "transition hover:bg-[#F3F1EB]",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                ].join(" ")}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={flagUrl(
                        value.code
                    )}
                    alt={`${value.name} flag`}
                    width={20}
                    height={15}
                    className="rounded-[3px] border border-black/10"
                />

                <span>
                    {value.dial}
                </span>

                <span className="hidden text-slate-400 sm:inline">
                    {value.code}
                </span>

                <IoChevronDownOutline
                    size={13}
                    className={[
                        "text-slate-400",
                        "transition-transform duration-200",
                        open
                            ? "rotate-180"
                            : "",
                    ].join(" ")}
                />
            </button>

            {open ? (
                <div
                    className={[
                        "absolute left-0 top-[calc(100%+8px)] z-[100]",
                        "w-[290px] overflow-hidden rounded-[16px]",
                        "border border-[#DDD8CC] bg-[#FBFAF6]",
                        "shadow-[0_18px_48px_rgba(15,23,42,0.16)]",
                    ].join(" ")}
                    role="listbox"
                >
                    <div className="border-b border-[#E8E3D8] p-2.5">
                        <input
                            value={q}
                            onChange={(e) =>
                                setQ(
                                    e.target.value
                                )
                            }
                            placeholder="Search country or dial code..."
                            className="h-10 w-full rounded-xl border border-[#D9D3C7] bg-white px-3 text-[10px] font-semibold text-slate-700 outline-none focus:border-[#173C2E]/50 focus:ring-4 focus:ring-[#173C2E]/5"
                            autoFocus
                        />
                    </div>

                    <div className="max-h-64 overflow-y-auto overscroll-contain p-1.5">
                        {filtered.map(
                            (c) => {
                                const active =
                                    c.code ===
                                    value.code;

                                return (
                                    <button
                                        key={
                                            c.code
                                        }
                                        type="button"
                                        onClick={() => {
                                            onChange(
                                                c
                                            );
                                            setOpen(
                                                false
                                            );
                                            setQ(
                                                ""
                                            );
                                        }}
                                        className={[
                                            "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left",
                                            "transition",
                                            active
                                                ? "bg-[#E8ECE8]"
                                                : "hover:bg-[#F3F1EB]",
                                        ].join(
                                            " "
                                        )}
                                        role="option"
                                        aria-selected={
                                            active
                                        }
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={flagUrl(
                                                c.code
                                            )}
                                            alt=""
                                            width={
                                                20
                                            }
                                            height={
                                                15
                                            }
                                            className="rounded-[3px] border border-black/10"
                                        />

                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-[10px] font-black text-slate-700">
                                                {
                                                    c.name
                                                }
                                            </div>

                                            <div className="mt-0.5 text-[8px] font-semibold text-slate-400">
                                                {
                                                    c.dial
                                                }{" "}
                                                ·{" "}
                                                {
                                                    c.code
                                                }
                                            </div>
                                        </div>

                                        {active ? (
                                            <IoCheckmarkCircleOutline
                                                size={
                                                    15
                                                }
                                                className="shrink-0 text-[#173C2E]"
                                            />
                                        ) : null}
                                    </button>
                                );
                            }
                        )}
                    </div>
                </div>
            ) : null}
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
            className="h-[100svh] w-full overflow-hidden bg-[#F8F7F2]"
        >
            <div id="recaptcha-container" />


            <div className="grid h-full w-full lg:grid-cols-[0.92fr_1.08fr]">
                {/* LEFT */}
                <section className="relative hidden overflow-hidden bg-[#173C2E] px-5 py-6 text-white lg:block lg:h-full lg:px-10 lg:py-10 xl:px-14">
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.045]"
                        style={{
                            backgroundImage:
                                "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.75) 18px 19px)",
                        }}
                    />

                    <div className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full bg-white/[0.035]" />
                    <div className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-[#c69258]/[0.08]" />

                    <motion.div
                        initial={{
                            opacity: 0,
                            y: 8,
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                        }}
                        transition={{
                            duration: 0.24,
                            ease: "easeOut",
                        }}
                        className="relative mx-auto flex h-full w-full min-w-0 max-w-[560px] flex-col"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <Link
                                href="/"
                                aria-label="Go to ekarihub"
                                className="inline-flex items-center"
                            >
                                <Image
                                    src="/ekarihub-logo-green.png"
                                    alt="ekarihub"
                                    width={156}
                                    height={44}
                                    priority
                                    className="h-auto w-[132px] object-contain"
                                />
                            </Link>

                            <Link
                                href="/login"
                                className="inline-flex h-9 items-center rounded-xl border border-white/12 bg-white/[0.06] px-3 text-[9px] font-black text-white/70 transition hover:bg-white/[0.11]"
                            >
                                Other login options
                            </Link>
                        </div>

                        <div className="flex flex-1 flex-col justify-center py-8 lg:py-10">
                            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/65">
                                <IoSparklesOutline
                                    size={12}
                                    className="text-[#c69258]"
                                />
                                Secure phone access
                            </div>

                            <h1 className="mt-5 max-w-[470px] text-[30px] font-black leading-[1.06] tracking-[-0.045em] sm:text-[36px] xl:text-[42px]">
                                Sign in with the number connected to your account.
                            </h1>

                            <p className="mt-4 max-w-[470px] text-[11px] font-medium leading-5 text-white/55 sm:text-[12px]">
                                We&apos;ll send a one-time verification code to your mobile number so you can securely return to ekarihub.
                            </p>

                            <div className="mt-7 space-y-5">
                                <FeatureRow
                                    icon={<IoPhonePortraitOutline size={18} />}
                                    title="Fast access"
                                    description="Use your mobile number without needing to remember an email password."
                                />

                                <FeatureRow
                                    icon={<IoShieldCheckmarkOutline size={18} />}
                                    title="One-time verification"
                                    description="A unique SMS code confirms that you control the phone number."
                                />

                                <FeatureRow
                                    icon={<IoLockClosedOutline size={18} />}
                                    title="Existing accounts only"
                                    description="Phone sign-in checks that your ekarihub profile already exists before allowing access."
                                />
                            </div>


                        </div>

                        <div className="pb-1 text-[9px] font-semibold text-white/30">
                            Collaborate · Innovate · Cultivate
                        </div>
                    </motion.div>
                </section>

                {/* =====================================================
                    RIGHT / PHONE AUTH
                ===================================================== */}
                <section className="relative flex h-full  overflow-y-auto overflow-x-hidden flex-col bg-[#F8F7F2] px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10 xl:px-14">
                    <div className="pointer-events-none absolute -right-32 -top-28 h-80 w-80 rounded-full bg-[#173C2E]/[0.025]" />
                    <div className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-[#c69258]/[0.035]" />

                    <motion.div
                        initial={{
                            opacity: 0,
                            y: 8,
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                        }}
                        transition={{
                            duration: 0.24,
                            ease: "easeOut",
                        }}
                        className="relative mx-auto flex h-full w-full min-w-0 max-w-[560px] flex-1 flex-col"
                    >
                        {/* Mobile header */}
                        <div className="mb-6 flex items-center justify-between lg:hidden">
                            <Link
                                href="/"
                                aria-label="Go to ekarihub"
                                className="inline-flex items-center"
                            >
                                <Image
                                    src="/ekarihub-logo.png"
                                    alt="ekarihub"
                                    width={152}
                                    height={44}
                                    priority
                                    className="h-auto w-[128px]"
                                />
                            </Link>

                            <Link
                                href="/login"
                                className="inline-flex h-9 items-center rounded-xl border border-[#DDD8CC] bg-[#FBFAF6] px-3 text-[9px] font-black text-[#173C2E]"
                            >
                                Other options
                            </Link>
                        </div>

                        <div className="flex flex-1 flex-col justify-center py-3 lg:py-8">
                            <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                                Phone verification
                            </div>

                            <h2 className="mt-1 text-[25px] font-black tracking-[-0.035em] text-slate-900 sm:text-[29px]">
                                {confirmation
                                    ? "Enter your verification code."
                                    : "Verify your phone number."}
                            </h2>

                            <p className="mt-2 max-w-[480px] text-[10px] font-medium leading-5 text-slate-500">
                                {confirmation
                                    ? `We sent a 6-digit code to ${e164}.`
                                    : "Choose your country and enter the phone number linked to your ekarihub account."}
                            </p>

                            {!firebaseReady ? (
                                <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-[10px] font-semibold text-rose-700">
                                    Firebase is not configured yet.
                                </div>
                            ) : null}

                            {!confirmation ? (
                                <>
                                    <div className="mt-6">
                                        <label className="mb-1.5 block text-[10px] font-black text-slate-700">
                                            Phone number
                                        </label>

                                        <div className="flex min-w-0 items-center gap-2 rounded-[15px] border border-[#D9D3C7] bg-white p-1.5 transition focus-within:border-[#173C2E]/50 focus-within:ring-4 focus-within:ring-[#173C2E]/5">
                                            <CountryPicker
                                                value={country}
                                                onChange={setCountry}
                                                disabled={disableAll || sending}
                                            />

                                            <div className="h-7 w-px shrink-0 bg-[#E5E0D6]" />

                                            <IoCallOutline
                                                size={16}
                                                className="shrink-0 text-slate-400"
                                            />

                                            <input
                                                type="tel"
                                                inputMode="numeric"
                                                autoComplete="tel-national"
                                                placeholder="712345678"
                                                maxLength={12}
                                                className="h-10 min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                                                value={localPhone}
                                                onChange={(e) =>
                                                    setLocalPhone(
                                                        e.target.value.replace(
                                                            /[^\d]/g,
                                                            ""
                                                        )
                                                    )
                                                }
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        void sendCode();
                                                    }
                                                }}
                                                aria-label="Phone number"
                                                disabled={disableAll || sending}
                                            />
                                        </div>

                                        <div className="mt-2 flex items-center justify-between gap-3">
                                            <div className="text-[9px] font-medium text-slate-400">
                                                Sending to{" "}
                                                <span className="font-black text-slate-600">
                                                    {e164 || `${country.dial}…`}
                                                </span>
                                            </div>

                                            {validPhone ? (
                                                <span className="inline-flex items-center gap-1 text-[8px] font-black text-emerald-600">
                                                    <IoCheckmarkCircleOutline size={12} />
                                                    Valid format
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>

                                    {!!errorMsg ? (
                                        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[10px] font-semibold leading-4 text-rose-700">
                                            {errorMsg}

                                            {showSignupLink ? (
                                                <div className="mt-2">
                                                    <Link
                                                        href="/signup"
                                                        className="font-black text-[#173C2E] underline underline-offset-2"
                                                    >
                                                        Create an account
                                                    </Link>
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    <button
                                        type="button"
                                        onClick={() => void sendCode()}
                                        disabled={!validPhone || sending || disableAll}
                                        className="group mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#173C2E] px-4 text-[10px] font-black text-white shadow-[0_10px_24px_rgba(23,60,46,0.14)] transition hover:bg-[#214C3A] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {sending ? (
                                            <>
                                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                                                Sending code...
                                            </>
                                        ) : (
                                            <>
                                                Send verification code
                                                <IoArrowForwardOutline
                                                    size={14}
                                                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                                                />
                                            </>
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => router.back()}
                                        className="mx-auto mt-3 inline-flex h-9 items-center gap-1.5 px-3 text-[9px] font-black text-slate-400 transition hover:text-[#173C2E]"
                                    >
                                        <IoArrowBackOutline size={13} />
                                        Back
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="mt-6">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black text-slate-700">
                                                Verification code
                                            </label>

                                            <button
                                                type="button"
                                                onClick={backToNumber}
                                                className="text-[9px] font-black text-[#173C2E] transition hover:text-[#c69258]"
                                            >
                                                Change number
                                            </button>
                                        </div>

                                        <div
                                            className="relative mt-3"
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
                                            <div className="grid grid-cols-6 gap-2">
                                                {Array.from({
                                                    length: 6,
                                                }).map((_, i) => {
                                                    const char =
                                                        code[i] ?? "";

                                                    const active =
                                                        i === code.length ||
                                                        (code.length === 6 &&
                                                            i === 5);

                                                    return (
                                                        <input
                                                            key={i}
                                                            ref={(el) => {
                                                                otpInputsRef.current[i] =
                                                                    el;
                                                            }}
                                                            value={char}
                                                            inputMode="numeric"
                                                            pattern="\d*"
                                                            maxLength={1}
                                                            autoComplete={
                                                                i === 0
                                                                    ? "one-time-code"
                                                                    : "off"
                                                            }
                                                            aria-label={`OTP digit ${i + 1}`}
                                                            className={[
                                                                "h-12 min-w-0 w-full rounded-[13px] border bg-white",
                                                                "text-center text-[18px] font-black text-slate-800",
                                                                "outline-none transition",
                                                                active
                                                                    ? "border-[#173C2E]/50 ring-4 ring-[#173C2E]/5"
                                                                    : "border-[#D9D3C7]",
                                                            ].join(" ")}
                                                            onChange={(e) => {
                                                                const vRaw =
                                                                    e.target.value ??
                                                                    "";

                                                                const v =
                                                                    vRaw.replace(
                                                                        /[^\d]/g,
                                                                        ""
                                                                    );

                                                                if (!v) {
                                                                    setOtpAt(
                                                                        i,
                                                                        ""
                                                                    );
                                                                    return;
                                                                }

                                                                const digits =
                                                                    v
                                                                        .slice(
                                                                            0,
                                                                            6 - i
                                                                        )
                                                                        .split(
                                                                            ""
                                                                        );

                                                                const arr =
                                                                    code.split(
                                                                        ""
                                                                    );

                                                                while (
                                                                    arr.length <
                                                                    6
                                                                ) {
                                                                    arr.push(
                                                                        ""
                                                                    );
                                                                }

                                                                digits.forEach(
                                                                    (d, k) => {
                                                                        arr[
                                                                            i +
                                                                            k
                                                                        ] = d;
                                                                    }
                                                                );

                                                                const nextCode =
                                                                    arr
                                                                        .join(
                                                                            ""
                                                                        )
                                                                        .slice(
                                                                            0,
                                                                            6
                                                                        );

                                                                setCode(
                                                                    nextCode
                                                                );

                                                                const nextIndex =
                                                                    Math.min(
                                                                        i +
                                                                        digits.length,
                                                                        5
                                                                    );

                                                                requestAnimationFrame(
                                                                    () =>
                                                                        otpInputsRef.current[
                                                                            nextIndex
                                                                        ]?.focus()
                                                                );
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (
                                                                    e.key ===
                                                                    "Backspace"
                                                                ) {
                                                                    e.preventDefault();

                                                                    if (char) {
                                                                        setOtpAt(
                                                                            i,
                                                                            ""
                                                                        );
                                                                        return;
                                                                    }

                                                                    const prev =
                                                                        Math.max(
                                                                            i -
                                                                            1,
                                                                            0
                                                                        );

                                                                    setOtpAt(
                                                                        prev,
                                                                        ""
                                                                    );

                                                                    requestAnimationFrame(
                                                                        () =>
                                                                            otpInputsRef.current[
                                                                                prev
                                                                            ]?.focus()
                                                                    );
                                                                }

                                                                if (
                                                                    e.key ===
                                                                    "ArrowLeft"
                                                                ) {
                                                                    e.preventDefault();

                                                                    const prev =
                                                                        Math.max(
                                                                            i -
                                                                            1,
                                                                            0
                                                                        );

                                                                    requestAnimationFrame(
                                                                        () =>
                                                                            otpInputsRef.current[
                                                                                prev
                                                                            ]?.focus()
                                                                    );
                                                                }

                                                                if (
                                                                    e.key ===
                                                                    "ArrowRight"
                                                                ) {
                                                                    e.preventDefault();

                                                                    const next =
                                                                        Math.min(
                                                                            i +
                                                                            1,
                                                                            5
                                                                        );

                                                                    requestAnimationFrame(
                                                                        () =>
                                                                            otpInputsRef.current[
                                                                                next
                                                                            ]?.focus()
                                                                    );
                                                                }

                                                                if (
                                                                    e.key ===
                                                                    "Enter"
                                                                ) {
                                                                    e.preventDefault();
                                                                    void verifyCode();
                                                                }
                                                            }}
                                                            onPaste={(e) => {
                                                                e.preventDefault();

                                                                const pasted =
                                                                    e.clipboardData.getData(
                                                                        "text"
                                                                    );

                                                                const digits =
                                                                    pasted
                                                                        .replace(
                                                                            /[^\d]/g,
                                                                            ""
                                                                        )
                                                                        .slice(
                                                                            0,
                                                                            6
                                                                        );

                                                                if (!digits) {
                                                                    return;
                                                                }

                                                                const arr =
                                                                    digits.split(
                                                                        ""
                                                                    );

                                                                while (
                                                                    arr.length <
                                                                    6
                                                                ) {
                                                                    arr.push(
                                                                        ""
                                                                    );
                                                                }

                                                                setCode(
                                                                    arr
                                                                        .join(
                                                                            ""
                                                                        )
                                                                        .slice(
                                                                            0,
                                                                            6
                                                                        )
                                                                );

                                                                requestAnimationFrame(
                                                                    () =>
                                                                        otpInputsRef.current[
                                                                            Math.min(
                                                                                digits.length -
                                                                                1,
                                                                                5
                                                                            )
                                                                        ]?.focus()
                                                                );
                                                            }}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="mt-3 flex items-center justify-between gap-3 text-[9px]">
                                            <button
                                                type="button"
                                                disabled={
                                                    countdown > 0 ||
                                                    disableAll
                                                }
                                                onClick={() => void sendCode()}
                                                className="font-black text-[#173C2E] transition hover:text-[#c69258] disabled:cursor-not-allowed disabled:text-slate-300"
                                            >
                                                Resend code
                                                {countdown > 0
                                                    ? ` (${countdown}s)`
                                                    : ""}
                                            </button>

                                            <span className="font-semibold text-slate-400">
                                                SMS verification
                                            </span>
                                        </div>
                                    </div>

                                    {!!errorMsg ? (
                                        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[10px] font-semibold leading-4 text-rose-700">
                                            {errorMsg}

                                            {showSignupLink ? (
                                                <div className="mt-2">
                                                    <Link
                                                        href="/signup"
                                                        className="font-black text-[#173C2E] underline underline-offset-2"
                                                    >
                                                        Create an account
                                                    </Link>
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    <button
                                        type="button"
                                        onClick={() => void verifyCode()}
                                        disabled={!validCode || verifying || disableAll}
                                        className="group mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#173C2E] px-4 text-[10px] font-black text-white shadow-[0_10px_24px_rgba(23,60,46,0.14)] transition hover:bg-[#214C3A] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {verifying ? (
                                            <>
                                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                                                Verifying...
                                            </>
                                        ) : (
                                            <>
                                                Verify and continue
                                                <IoArrowForwardOutline
                                                    size={14}
                                                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                                                />
                                            </>
                                        )}
                                    </button>
                                </>
                            )}

                            <div className="mt-5 rounded-[16px] border border-[#E5E0D6] bg-[#FBFAF6] px-4 py-3">
                                <div className="flex items-start gap-2.5">
                                    <IoLockClosedOutline
                                        size={14}
                                        className="mt-0.5 shrink-0 text-[#173C2E]"
                                    />

                                    <div>
                                        <div className="text-[9px] font-black text-slate-600">
                                            Secure account verification
                                        </div>

                                        <div className="mt-1 text-[8px] font-medium leading-4 text-slate-400">
                                            Never share your one-time verification code with another person.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-5">
                            <p className="text-center text-[9px] font-medium leading-4 text-slate-400">
                                By continuing, you agree to our{" "}
                                <Link
                                    href="/terms"
                                    className="font-black text-[#173C2E] transition hover:text-[#c69258]"
                                >
                                    Terms
                                </Link>{" "}
                                and{" "}
                                <Link
                                    href="/privacy"
                                    className="font-black text-[#173C2E] transition hover:text-[#c69258]"
                                >
                                    Privacy Policy
                                </Link>
                                .
                            </p>

                            <div
                                style={{
                                    height: "env(safe-area-inset-bottom)",
                                }}
                            />
                        </div>
                    </motion.div>
                </section>
            </div>
        </main>
    );
}

function FeatureRow({
    icon,
    title,
    description,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border border-white/10 bg-white/[0.07] text-[#c69258]">
                {icon}
            </div>

            <div className="min-w-0">
                <div className="text-[12px] font-black text-white">
                    {title}
                </div>

                <p className="mt-1 max-w-[390px] text-[10px] font-medium leading-[18px] text-white/50">
                    {description}
                </p>
            </div>
        </div>
    );
}