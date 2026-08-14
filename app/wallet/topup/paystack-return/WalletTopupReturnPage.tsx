"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
    IoArrowForwardOutline,
    IoCheckmarkCircleOutline,
    IoCloseCircleOutline,
    IoHomeOutline,
    IoReceiptOutline,
    IoShieldCheckmarkOutline,
    IoTimeOutline,
    IoWalletOutline,
} from "react-icons/io5";

import AppShell from "@/app/components/AppShell";

const EKARI = {
    forest: "#173C2E",
    leaf: "#214C3A",
    gold: "#F39A22",
    page: "#F8F7F2",
    surface: "#FBFAF6",
    border: "#DDD8CC",
    text: "#0F172A",
    dim: "#64748B",
};

type TopupStatus = "pending" | "success" | "failed";

export default function WalletTopupReturnPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [status, setStatus] =
        useState<TopupStatus>("pending");

    const [reference, setReference] =
        useState<string | null>(null);

    useEffect(() => {
        if (!searchParams) return;

        const paystackStatus =
            searchParams.get("status") ||
            searchParams.get("message") ||
            searchParams.get("status_code");

        const ref =
            searchParams.get("reference") ||
            searchParams.get("trxref");

        if (ref) {
            setReference(ref);
        }

        if (
            paystackStatus &&
            paystackStatus.toLowerCase() ===
            "success"
        ) {
            setStatus("success");

            const timer = setTimeout(() => {
                router.replace("/wallet");
            }, 4000);

            return () =>
                clearTimeout(timer);
        }

        if (
            paystackStatus &&
            [
                "cancelled",
                "failed",
            ].includes(
                paystackStatus.toLowerCase()
            )
        ) {
            setStatus("failed");
            return;
        }

        setStatus("failed");
    }, [router, searchParams]);

    const title =
        status === "success"
            ? "Wallet top-up successful"
            : status === "failed"
                ? "Wallet top-up not completed"
                : "Processing your wallet top-up";

    const description =
        status === "success"
            ? "Your payment was successful. We’re updating your wallet balance and you’ll be redirected shortly."
            : status === "failed"
                ? "We could not confirm a successful payment. If money was deducted, wait a few minutes and check your wallet again or contact support."
                : "Please wait while we confirm your payment with Paystack.";

    return (
        <AppShell>
            <main className="h-full w-full overflow-y-auto overflow-x-hidden bg-[#F8F7F2] touch-pan-y">
                <div className="mx-auto flex min-h-full w-full max-w-[1180px] items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
                    <motion.section
                        initial={{
                            opacity: 0,
                            y: 8,
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                        }}
                        transition={{
                            duration: 0.22,
                            ease: "easeOut",
                        }}
                        className="w-full max-w-[720px]"
                    >
                        {/* STATUS HERO */}
                        <div className="relative overflow-hidden rounded-[22px] border border-[#DDD8CC] bg-[#173C2E] p-5 text-white shadow-[0_16px_44px_rgba(23,60,46,0.12)] sm:p-6">
                            <div
                                className="pointer-events-none absolute inset-0 opacity-[0.04]"
                                style={{
                                    backgroundImage:
                                        "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.7) 18px 19px)",
                                }}
                            />

                            <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/[0.04]" />
                            <div className="pointer-events-none absolute -bottom-20 left-[32%] h-44 w-44 rounded-full bg-[#F39A22]/[0.08]" />

                            <div className="relative">
                                <div className="flex items-start justify-between gap-4">
                                    <StatusIcon
                                        status={status}
                                    />

                                    <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.08em] text-white/60">
                                        Wallet
                                    </span>
                                </div>

                                <div className="mt-5 text-[9px] font-black uppercase tracking-[0.11em] text-[#F39A22]">
                                    Payment status
                                </div>

                                <h1 className="mt-1 text-[24px] font-black tracking-[-0.035em] sm:text-[28px]">
                                    {title}
                                </h1>

                                <p className="mt-3 max-w-[560px] text-[10px] font-medium leading-5 text-white/55 sm:text-[11px]">
                                    {description}
                                </p>

                                {reference ? (
                                    <div className="mt-5 rounded-[14px] border border-white/10 bg-white/[0.06] p-3.5">
                                        <div className="flex items-start gap-3">
                                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-white/10 text-[#F39A22]">
                                                <IoReceiptOutline
                                                    size={
                                                        15
                                                    }
                                                />
                                            </span>

                                            <div className="min-w-0">
                                                <div className="text-[8px] font-black uppercase tracking-[0.08em] text-white/35">
                                                    Payment
                                                    reference
                                                </div>

                                                <div className="mt-1 break-all font-mono text-[9px] font-semibold text-white/70">
                                                    {
                                                        reference
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        {/* DETAILS */}
                        <div className="mt-4 rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 sm:p-5">
                            {status ===
                                "pending" ? (
                                <div className="flex items-start gap-3">
                                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[#FFF2DF] text-[#F39A22]">
                                        <IoTimeOutline
                                            size={17}
                                            className="animate-pulse"
                                        />
                                    </span>

                                    <div className="min-w-0">
                                        <div className="text-[10px] font-black text-slate-700">
                                            Confirming
                                            payment
                                        </div>

                                        <p className="mt-1 text-[9px] font-medium leading-4 text-slate-400">
                                            This may
                                            take a few
                                            seconds.
                                            Please keep
                                            this page
                                            open while
                                            we check
                                            your
                                            payment.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <ActionCard
                                        icon={
                                            <IoWalletOutline
                                                size={
                                                    16
                                                }
                                            />
                                        }
                                        title="My wallet"
                                        description="View your updated balance and wallet activity."
                                        onClick={() =>
                                            router.push(
                                                "/wallet"
                                            )
                                        }
                                        primary
                                    />

                                    <ActionCard
                                        icon={
                                            <IoHomeOutline
                                                size={
                                                    16
                                                }
                                            />
                                        }
                                        title="Back home"
                                        description="Return to the ekarihub home experience."
                                        onClick={() =>
                                            router.push(
                                                "/"
                                            )
                                        }
                                    />
                                </div>
                            )}

                            {status ===
                                "failed" ? (
                                <div className="mt-4 rounded-[14px] border border-[#E5E0D6] bg-white p-3.5">
                                    <div className="flex items-start gap-3">
                                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#E8ECE8] text-[#173C2E]">
                                            <IoShieldCheckmarkOutline
                                                size={
                                                    15
                                                }
                                            />
                                        </span>

                                        <div>
                                            <div className="text-[9px] font-black text-slate-700">
                                                Money
                                                deducted?
                                            </div>

                                            <p className="mt-1 text-[8px] font-medium leading-4 text-slate-400">
                                                Give
                                                the
                                                payment
                                                a few
                                                minutes
                                                to
                                                reconcile.
                                                If the
                                                wallet
                                                still
                                                does not
                                                update,
                                                contact
                                                support
                                                with the
                                                payment
                                                reference
                                                above.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            {status ===
                                "success" ? (
                                <div className="mt-4 flex items-center justify-center gap-2 text-[8px] font-semibold text-slate-400">
                                    <IoTimeOutline
                                        size={12}
                                    />
                                    Redirecting
                                    automatically in
                                    a few seconds...
                                </div>
                            ) : null}
                        </div>
                    </motion.section>
                </div>
            </main>
        </AppShell>
    );
}

function StatusIcon({
    status,
}: {
    status: TopupStatus;
}) {
    if (status === "success") {
        return (
            <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-emerald-400/15 text-emerald-300">
                <IoCheckmarkCircleOutline
                    size={24}
                />
            </span>
        );
    }

    if (status === "failed") {
        return (
            <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-rose-400/15 text-rose-300">
                <IoCloseCircleOutline
                    size={24}
                />
            </span>
        );
    }

    return (
        <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-[#F39A22]/15 text-[#F39A22]">
            <IoTimeOutline
                size={23}
                className="animate-pulse"
            />
        </span>
    );
}

function ActionCard({
    icon,
    title,
    description,
    onClick,
    primary = false,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    onClick: () => void;
    primary?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                "group flex items-center gap-3 rounded-[14px] border p-3 text-left transition",
                primary
                    ? "border-[#173C2E] bg-[#173C2E] text-white hover:bg-[#214C3A]"
                    : "border-[#DDD8CC] bg-white text-slate-700 hover:bg-[#F3F1EB]",
            ].join(" ")}
        >
            <span
                className={[
                    "grid h-9 w-9 shrink-0 place-items-center rounded-[11px]",
                    primary
                        ? "bg-white/10 text-[#F39A22]"
                        : "bg-[#E8ECE8] text-[#173C2E]",
                ].join(" ")}
            >
                {icon}
            </span>

            <span className="min-w-0 flex-1">
                <span className="block text-[9px] font-black">
                    {title}
                </span>

                <span
                    className={[
                        "mt-0.5 block text-[7px] font-medium leading-3.5",
                        primary
                            ? "text-white/45"
                            : "text-slate-400",
                    ].join(" ")}
                >
                    {description}
                </span>
            </span>

            <IoArrowForwardOutline
                size={13}
                className={[
                    "shrink-0 transition-transform group-hover:translate-x-0.5",
                    primary
                        ? "text-white/35"
                        : "text-slate-300",
                ].join(" ")}
            />
        </button>
    );
}