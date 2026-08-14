"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    IoArrowBackOutline,
    IoArrowForwardOutline,
    IoCheckmarkCircle,
    IoLeafOutline,
    IoLockClosedOutline,
    IoMailOutline,
    IoShieldCheckmarkOutline,
    IoSparklesOutline,
} from "react-icons/io5";
import { sendPasswordResetEmail } from "firebase/auth";
import { getAuthSafe } from "@/lib/firebase";

const EKARI = {
    forest: "#173C2E",
    leaf: "#214C3A",
    gold: "#F39A22",
    sand: "#F8F7F2",
    card: "#FBFAF6",
    text: "#0F172A",
    dim: "#64748B",
    hair: "#DDD8CC",
    subtext: "#64748B",
    danger: "#B42318",
};

export default function ForgotPasswordPage() {
    const router = useRouter();

    const [authBundle, setAuthBundle] = useState<{ auth: any } | null>(null);
    const [firebaseReady, setFirebaseReady] = useState(true);

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

    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [sent, setSent] = useState(false);

    const isValidEmail = useMemo(
        () => /\S+@\S+\.\S+/.test(email.trim()),
        [email]
    );

    const disableAll = loading || !authBundle;

    const mapAuthError = (err: any) => {
        switch (err?.code) {
            case "auth/invalid-email":
                return "Invalid email.";
            case "auth/user-not-found":
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
            await sendPasswordResetEmail(authBundle!.auth, email.trim(), {
                url: "https://ekarihub.com/reset-password",
                handleCodeInApp: false,
            });
            setSent(true);
        } catch (err: any) {
            setErrorMsg(mapAuthError(err));
        } finally {
            setLoading(false);
        }
    };


    return (
        <main
            className="h-[100svh] w-full overflow-hidden bg-[#F8F7F2]"
        >
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
                    <div className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-[#F39A22]/[0.08]" />

                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.24, ease: "easeOut" }}
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
                                Back to login
                            </Link>
                        </div>

                        <div className="flex flex-1 flex-col justify-center py-8 lg:py-10">
                            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/65">
                                <IoSparklesOutline
                                    size={12}
                                    className="text-[#F39A22]"
                                />
                                Account recovery
                            </div>

                            <h1 className="mt-5 max-w-[470px] text-[30px] font-black leading-[1.06] tracking-[-0.045em] sm:text-[36px] xl:text-[42px]">
                                Recover access without losing your ekarihub journey.
                            </h1>

                            <p className="mt-4 max-w-[470px] text-[11px] font-medium leading-5 text-white/55 sm:text-[12px]">
                                Enter the email linked to your account and we&apos;ll send a secure reset link so you can create a new password.
                            </p>

                            <div className="mt-7 space-y-5">
                                <FeatureRow
                                    icon={<IoMailOutline size={18} />}
                                    title="Reset by email"
                                    description="We send the password-reset link only to the email address connected to your account."
                                />

                                <FeatureRow
                                    icon={<IoShieldCheckmarkOutline size={18} />}
                                    title="Secure recovery"
                                    description="Firebase validates the password-reset request and recovery link before your password changes."
                                />

                                <FeatureRow
                                    icon={<IoLeafOutline size={18} />}
                                    title="Keep your profile"
                                    description="Resetting your password does not remove your profile, deeds, listings, connections or account history."
                                />
                            </div>

                            <div className="mt-7 rounded-[17px] border border-white/10 bg-white/[0.055] p-4">
                                <div className="flex items-start gap-3">
                                    <IoLockClosedOutline
                                        size={18}
                                        className="mt-0.5 shrink-0 text-[#F39A22]"
                                    />

                                    <div>
                                        <div className="text-[10px] font-black text-white">
                                            Keep the reset link private
                                        </div>

                                        <p className="mt-1 text-[9px] font-medium leading-4 text-white/45">
                                            Never forward your password-reset email or share the recovery link with another person.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pb-1 text-[9px] font-semibold text-white/30">
                            Collaborate · Innovate · Cultivate
                        </div>
                    </motion.div>
                </section>

                <section className="relative flex h-full  overflow-y-auto overflow-x-hidden flex-col bg-[#F8F7F2] px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10 xl:px-14">
                    <div className="pointer-events-none absolute -right-32 -top-28 h-80 w-80 rounded-full bg-[#173C2E]/[0.025]" />
                    <div className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-[#F39A22]/[0.035]" />

                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.24, ease: "easeOut" }}
                        className="relative mx-auto flex h-full w-full min-w-0 max-w-[560px] flex-1 flex-col"
                    >
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
                                Log in
                            </Link>
                        </div>

                        <div className="flex flex-1 flex-col justify-center py-3 lg:py-8">
                            <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
                                Password reset
                            </div>

                            <h2 className="mt-1 text-[25px] font-black tracking-[-0.035em] text-slate-900 sm:text-[29px]">
                                Forgot your password?
                            </h2>

                            <p className="mt-2 max-w-[480px] text-[10px] font-medium leading-5 text-slate-500">
                                Enter the email linked to your ekarihub account. We&apos;ll send you a secure password-reset link.
                            </p>

                            {!firebaseReady ? (
                                <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-[10px] font-semibold text-rose-700">
                                    Firebase is not configured yet.
                                </div>
                            ) : null}

                            <div className="mt-6">
                                <label className="mb-1.5 block text-[10px] font-black text-slate-700">
                                    Email address
                                </label>

                                <div className="flex h-12 items-center rounded-[14px] border border-[#D9D3C7] bg-white px-3 transition-all focus-within:border-[#173C2E]/50 focus-within:ring-4 focus-within:ring-[#173C2E]/5">
                                    <IoMailOutline
                                        className="mr-2 shrink-0 text-slate-400"
                                        size={17}
                                    />

                                    <input
                                        type="email"
                                        inputMode="email"
                                        autoComplete="email"
                                        placeholder="you@example.com"
                                        className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            if (sent) setSent(false);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                void handleSend();
                                            }
                                        }}
                                        aria-label="Email"
                                        disabled={disableAll}
                                    />
                                </div>

                                {!isValidEmail && email.length > 0 ? (
                                    <div className="mt-2 text-[9px] font-semibold text-slate-400">
                                        Enter a valid email like{" "}
                                        <span className="font-black text-slate-600">
                                            you@example.com
                                        </span>
                                        .
                                    </div>
                                ) : null}
                            </div>

                            {!!errorMsg ? (
                                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[10px] font-semibold leading-4 text-rose-700">
                                    {errorMsg}
                                </div>
                            ) : null}

                            {sent && !errorMsg ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.18, ease: "easeOut" }}
                                    className="mt-4 rounded-[15px] border border-emerald-200 bg-emerald-50 px-3.5 py-3"
                                >
                                    <div className="flex items-start gap-2.5">
                                        <IoCheckmarkCircle
                                            size={18}
                                            className="mt-0.5 shrink-0 text-emerald-600"
                                        />

                                        <div>
                                            <div className="text-[10px] font-black text-emerald-800">
                                                Check your inbox
                                            </div>

                                            <p className="mt-1 text-[9px] font-medium leading-4 text-emerald-700">
                                                If that email exists, we&apos;ve sent a password-reset link. Also check your spam or promotions folder.
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : null}

                            <button
                                type="button"
                                onClick={() => void handleSend()}
                                disabled={!isValidEmail || disableAll}
                                className="group mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#173C2E] px-4 text-[10px] font-black text-white shadow-[0_10px_24px_rgba(23,60,46,0.14)] transition hover:bg-[#214C3A] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loading ? (
                                    <>
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                                        Sending reset link...
                                    </>
                                ) : (
                                    <>
                                        {sent ? "Send again" : "Send reset link"}
                                        <IoArrowForwardOutline size={14} />
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="mx-auto mt-3 inline-flex h-9 items-center gap-1.5 px-3 text-[9px] font-black text-slate-400 transition hover:text-[#173C2E]"
                            >
                                <IoArrowBackOutline size={13} />
                                Back to login
                            </button>

                            <div className="mt-5 rounded-[16px] border border-[#E5E0D6] bg-[#FBFAF6] px-4 py-3">
                                <div className="flex items-start gap-2.5">
                                    <IoLockClosedOutline
                                        size={14}
                                        className="mt-0.5 shrink-0 text-[#173C2E]"
                                    />

                                    <div>
                                        <div className="text-[9px] font-black text-slate-600">
                                            Didn&apos;t receive the email?
                                        </div>

                                        <div className="mt-1 text-[8px] font-medium leading-4 text-slate-400">
                                            Confirm the address is correct, check spam, then use Send again after a moment.
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
                                    className="font-black text-[#173C2E] transition hover:text-[#F39A22]"
                                >
                                    Terms and Conditions
                                </Link>{" "}
                                and{" "}
                                <Link
                                    href="/privacy"
                                    className="font-black text-[#173C2E] transition hover:text-[#F39A22]"
                                >
                                    Privacy Policy
                                </Link>
                                .
                            </p>

                            <div style={{ height: "env(safe-area-inset-bottom)" }} />
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
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border border-white/10 bg-white/[0.07] text-[#F39A22]">
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