"use client";

import React, {
    useEffect,
    useState,
} from "react";
import {
    useRouter,
    useSearchParams,
} from "next/navigation";
import {
    IoCheckmarkCircleOutline,
    IoCloseCircleOutline,
    IoTimeOutline,
    IoChevronBack,
    IoShieldCheckmarkOutline,
    IoReceiptOutline,
} from "react-icons/io5";
import {
    getFunctions,
    httpsCallable,
} from "firebase/functions";
import {
    motion,
    AnimatePresence,
} from "framer-motion";

import AppShell from "@/app/components/AppShell";
import { app } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";

type VerifyResultStatus =
    | "idle"
    | "checking"
    | "success"
    | "failed";

function useMediaQuery(
    queryStr: string
) {
    const [matches, setMatches] =
        React.useState(false);

    React.useEffect(() => {
        if (
            typeof window ===
            "undefined"
        ) {
            return;
        }

        const mq =
            window.matchMedia(
                queryStr
            );

        const onChange = () =>
            setMatches(
                mq.matches
            );

        onChange();

        mq.addEventListener?.(
            "change",
            onChange
        );

        return () =>
            mq.removeEventListener?.(
                "change",
                onChange
            );
    }, [queryStr]);

    return matches;
}

function useIsMobile() {
    return useMediaQuery(
        "(max-width: 1023px)"
    );
}

export default function VerificationCallbackPage() {
    const searchParams =
        useSearchParams();

    const router =
        useRouter();

    const { user } =
        useAuth();

    const isMobile =
        useIsMobile();

    const [status, setStatus] =
        useState<VerifyResultStatus>(
            "idle"
        );

    const [message, setMessage] =
        useState<string | null>(
            null
        );

    const reference =
        searchParams.get(
            "reference"
        ) ||
        searchParams.get(
            "trxref"
        ) ||
        null;

    const goBack =
        React.useCallback(() => {
            if (
                typeof window !==
                "undefined" &&
                window.history.length > 1
            ) {
                router.back();
            } else {
                router.push(
                    "/account/verification"
                );
            }
        }, [router]);

    useEffect(() => {
        if (
            user === undefined
        ) {
            return;
        }

        if (!user) {
            const next =
                `/account/verification/callback?${searchParams.toString()}`;

            router.push(
                `/login?next=${encodeURIComponent(
                    next
                )}`
            );

            return;
        }

        if (!reference) {
            setStatus(
                "failed"
            );

            setMessage(
                "Missing transaction reference in the callback URL."
            );

            return;
        }

        const run =
            async () => {
                try {
                    setStatus(
                        "checking"
                    );

                    setMessage(
                        "Confirming your verification payment with Paystack…"
                    );

                    const functions =
                        getFunctions(app);

                    const confirmVerificationPayment =
                        httpsCallable(
                            functions,
                            "confirmVerificationPayment"
                        );

                    const response =
                        await confirmVerificationPayment(
                            {
                                reference,
                            }
                        );

                    const data =
                        response.data as any;

                    if (data?.ok) {
                        setStatus(
                            "success"
                        );

                        setMessage(
                            data?.message ||
                            "Your payment was confirmed successfully. Your verification request is now awaiting review."
                        );
                    } else {
                        setStatus(
                            "failed"
                        );

                        setMessage(
                            data?.message ||
                            "We could not confirm this payment. Please contact support if money was deducted."
                        );
                    }
                } catch (
                error: any
                ) {
                    console.error(
                        "confirmVerificationPayment error:",
                        error
                    );

                    setStatus(
                        "failed"
                    );

                    setMessage(
                        error?.message ||
                        "Something went wrong while confirming your payment. Please try again or contact support."
                    );
                }
            };

        void run();
    }, [
        user,
        reference,
        router,
        searchParams,
    ]);

    const checking =
        status ===
        "checking" ||
        status === "idle";

    const success =
        status ===
        "success";

    const statusTitle =
        checking
            ? "Confirming payment"
            : success
                ? "Payment confirmed"
                : "Confirmation failed";

    const statusCaption =
        checking
            ? "Please keep this page open while we verify the transaction."
            : success
                ? "Your verification request is now ready for administrative review."
                : "We could not confirm the verification payment.";

    const statusTone =
        checking
            ? {
                wrapper:
                    "border-sky-200 bg-sky-50",
                icon:
                    "bg-sky-100 text-sky-700",
            }
            : success
                ? {
                    wrapper:
                        "border-emerald-200 bg-emerald-50",
                    icon:
                        "bg-emerald-100 text-emerald-700",
                }
                : {
                    wrapper:
                        "border-rose-200 bg-rose-50",
                    icon:
                        "bg-rose-100 text-rose-700",
                };

    const StatusIcon =
        checking
            ? IoTimeOutline
            : success
                ? IoCheckmarkCircleOutline
                : IoCloseCircleOutline;

    const Body = (
        <div className="flex min-h-[100svh] flex-col bg-[#F8F7F2]">
            <motion.header
                initial={{
                    opacity: 0,
                    y: -6,
                }}
                animate={{
                    opacity: 1,
                    y: 0,
                }}
                transition={{
                    duration: 0.24,
                    ease: "easeOut",
                }}
                className="relative overflow-hidden bg-[#173C2E] text-white"
            >
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.07]"
                    style={{
                        backgroundImage:
                            "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.6) 18px 19px)",
                    }}
                />

                <div className="relative mx-auto flex max-w-[980px] items-start gap-3 px-4 py-5 md:px-6 md:py-6">
                    <button
                        type="button"
                        onClick={goBack}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[0.06] text-white transition hover:bg-white/[0.11] active:scale-95"
                        aria-label="Back"
                    >
                        <IoChevronBack
                            size={19}
                        />
                    </button>

                    <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#F39A22]">
                            Account trust
                        </div>

                        <h1 className="mt-1 text-[24px] font-black tracking-[-0.035em] md:text-[28px]">
                            Verification payment
                        </h1>

                        <p className="mt-1 max-w-2xl text-[11px] font-medium leading-5 text-white/50 md:text-[12px]">
                            Securely confirming your verification transaction.
                        </p>
                    </div>
                </div>
            </motion.header>

            <main className="grid flex-1 place-items-center px-4 py-8">
                <motion.div
                    initial={{
                        opacity: 0,
                        y: 8,
                        scale: 0.985,
                    }}
                    animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                    }}
                    transition={{
                        duration: 0.24,
                        ease: "easeOut",
                    }}
                    className="w-full max-w-xl"
                >
                    <section
                        className={[
                            "rounded-[20px] border p-5 sm:p-6",
                            "shadow-[0_16px_38px_rgba(15,23,42,0.06)]",
                            statusTone.wrapper,
                        ].join(" ")}
                    >
                        <div className="flex flex-col items-center text-center">
                            <motion.div
                                animate={
                                    checking
                                        ? {
                                            scale: [
                                                1,
                                                1.06,
                                                1,
                                            ],
                                        }
                                        : {
                                            scale: 1,
                                        }
                                }
                                transition={
                                    checking
                                        ? {
                                            duration: 1.2,
                                            repeat:
                                                Infinity,
                                        }
                                        : undefined
                                }
                                className={[
                                    "grid h-16 w-16 place-items-center rounded-full",
                                    statusTone.icon,
                                ].join(" ")}
                            >
                                <StatusIcon
                                    size={32}
                                />
                            </motion.div>

                            <h2 className="mt-4 text-[20px] font-black tracking-[-0.025em] text-slate-900">
                                {statusTitle}
                            </h2>

                            <p className="mt-1 text-[11px] font-medium leading-5 text-slate-500">
                                {statusCaption}
                            </p>

                            <AnimatePresence
                                mode="wait"
                            >
                                <motion.p
                                    key={
                                        message ||
                                        "message"
                                    }
                                    initial={{
                                        opacity: 0,
                                        y: 3,
                                    }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                    }}
                                    exit={{
                                        opacity: 0,
                                    }}
                                    className="mt-4 max-w-md text-[12px] font-semibold leading-5 text-slate-700"
                                >
                                    {message ||
                                        "Confirming your verification payment…"}
                                </motion.p>
                            </AnimatePresence>
                        </div>

                        <div className="mt-5 rounded-[14px] border border-black/5 bg-white/70 px-4 py-3">
                            <div className="flex items-center gap-2">
                                <IoReceiptOutline
                                    size={15}
                                    className="text-[#F39A22]"
                                />

                                <div className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
                                    Transaction reference
                                </div>
                            </div>

                            <div className="mt-1 break-all font-mono text-[11px] font-bold text-slate-700">
                                {reference ||
                                    "—"}
                            </div>
                        </div>

                        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                            <button
                                type="button"
                                onClick={() =>
                                    router.push(
                                        "/account/verification"
                                    )
                                }
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#173C2E] px-4 text-[10px] font-black text-white transition hover:-translate-y-0.5 hover:bg-[#214C3A]"
                            >
                                <IoShieldCheckmarkOutline
                                    size={14}
                                />
                                Verification page
                            </button>

                            {status ===
                                "failed" ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.push(
                                            "/support" as any
                                        )
                                    }
                                    className="inline-flex h-10 items-center justify-center rounded-xl border border-[#D9D3C7] bg-white px-4 text-[10px] font-black text-slate-600 transition hover:bg-[#F3F1EB]"
                                >
                                    Contact support
                                </button>
                            ) : null}
                        </div>
                    </section>

                    <p className="mt-4 text-center text-[9px] font-medium leading-4 text-slate-400">
                        Do not refresh or close the page while payment confirmation is in progress.
                    </p>
                </motion.div>
            </main>

            {isMobile ? (
                <div
                    style={{
                        height:
                            "env(safe-area-inset-bottom)",
                    }}
                />
            ) : null}
        </div>
    );

    if (isMobile) {
        return (
            <div className="fixed inset-0 overflow-y-auto bg-[#F8F7F2]">
                {Body}
            </div>
        );
    }

    return (
        <AppShell>
            <div className="h-full min-h-0 overflow-y-auto bg-[#F8F7F2]">
                {Body}
            </div>
        </AppShell>
    );
}