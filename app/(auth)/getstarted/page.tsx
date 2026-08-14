// app/getstarted/page.tsx
"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    motion,
    useReducedMotion,
} from "framer-motion";
import {
    IoArrowForwardOutline,
    IoCheckmarkCircleOutline,
    IoLeafOutline,
    IoLockClosedOutline,
    IoPeopleOutline,
    IoPersonAddOutline,
    IoPersonOutline,
    IoPlayOutline,
    IoShieldCheckmarkOutline,
    IoSparklesOutline,
} from "react-icons/io5";

const container = {
    hidden: {},
    show: {
        transition: {
            staggerChildren: 0.055,
        },
    },
};

const item = {
    hidden: {
        opacity: 0,
        y: 7,
    },
    show: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.22,
            ease: "easeOut" as const,
        },
    },
};

function Benefit({
    icon,
    title,
    description,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        <motion.div
            variants={item}
            className="flex items-start gap-3"
        >
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
        </motion.div>
    );
}

function TrustItem({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-1.5">
            <IoCheckmarkCircleOutline
                size={13}
                className="shrink-0 text-[#173C2E]"
            />

            <span className="text-[9px] font-bold text-slate-500">
                {children}
            </span>
        </div>
    );
}

export default function OnboardingPage() {
    const router = useRouter();
    const reduceMotion = useReducedMotion();

    return (
        <main
            className="h-[100svh] w-full overflow-hidden bg-[#F8F7F2]"
        >
            <div className="grid h-full w-full lg:grid-cols-[0.92fr_1.08fr]">
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
                        variants={container}
                        initial={reduceMotion ? "show" : "hidden"}
                        animate="show"
                        className="relative mx-auto flex h-full w-full max-w-[560px] flex-col"
                    >
                        <motion.div
                            variants={item}
                            className="flex items-center justify-between gap-3"
                        >
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
                                href="/about"
                                className="inline-flex h-9 items-center rounded-xl border border-white/12 bg-white/[0.06] px-3 text-[9px] font-black text-white/70 transition hover:bg-white/[0.11]"
                            >
                                About ekarihub
                            </Link>
                        </motion.div>

                        <div className="flex flex-1 flex-col justify-center py-8 lg:py-10">
                            <motion.div variants={item}>
                                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/65">
                                    <IoSparklesOutline
                                        size={12}
                                        className="text-[#c69258]"
                                    />
                                    Welcome to ekarihub
                                </span>
                            </motion.div>

                            <motion.h1
                                variants={item}
                                className="mt-5 max-w-[470px] text-[30px] font-black leading-[1.06] tracking-[-0.045em] sm:text-[36px] xl:text-[42px]"
                            >
                                Grow your agribusiness with the right community.
                            </motion.h1>

                            <motion.p
                                variants={item}
                                className="mt-4 max-w-[470px] text-[11px] font-medium leading-5 text-white/55 sm:text-[12px]"
                            >
                                Collaborate, innovate and cultivate through a connected ecosystem for agribusiness, sustainability and green living.
                            </motion.p>

                            <div className="mt-7 space-y-5">
                                <Benefit
                                    icon={<IoPeopleOutline size={18} />}
                                    title="Connect with the community"
                                    description="Meet farmers, agripreneurs, experts, buyers and people building across the agricultural value chain."
                                />

                                <Benefit
                                    icon={<IoLeafOutline size={18} />}
                                    title="Share your journey"
                                    description="Post deeds, showcase your work, exchange knowledge and build a trusted presence."
                                />

                                <Benefit
                                    icon={<IoSparklesOutline size={18} />}
                                    title="Discover opportunities"
                                    description="Explore markets, expert services, AI insights, partnerships and resources designed to help you grow."
                                />
                            </div>

                            <motion.div
                                variants={item}
                                className="mt-7 rounded-[17px] border border-white/10 bg-white/[0.055] p-4"
                            >
                                <div className="flex items-start gap-3">
                                    <IoShieldCheckmarkOutline
                                        size={18}
                                        className="mt-0.5 shrink-0 text-[#c69258]"
                                    />

                                    <div>
                                        <div className="text-[10px] font-black text-white">
                                            Built around trust
                                        </div>

                                        <p className="mt-1 text-[9px] font-medium leading-4 text-white/45">
                                            Your profile helps tell your story, establish credibility and connect you with people who believe in what you are building.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        <motion.div
                            variants={item}
                            className="pb-1 text-[9px] font-semibold text-white/30"
                        >
                            Collaborate · Innovate · Cultivate
                        </motion.div>
                    </motion.div>
                </section>

                <section className="relative flex min-h-[100svh] flex-col bg-[#F8F7F2] px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10 xl:px-14">
                    <div className="pointer-events-none absolute -right-32 -top-28 h-80 w-80 rounded-full bg-[#173C2E]/[0.025]" />
                    <div className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-[#c69258]/[0.035]" />

                    <motion.div
                        variants={container}
                        initial={reduceMotion ? "show" : "hidden"}
                        animate="show"
                        className="relative mx-auto flex h-full w-full max-w-[560px] flex-1 flex-col"
                    >
                        <motion.div
                            variants={item}
                            className="mb-6 flex items-center justify-between lg:hidden"
                        >
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
                                href="/about"
                                className="inline-flex h-9 items-center rounded-xl border border-[#DDD8CC] bg-[#FBFAF6] px-3 text-[9px] font-black text-[#173C2E]"
                            >
                                About
                            </Link>
                        </motion.div>

                        <div className="flex flex-1 flex-col justify-center py-3 lg:py-8">
                            <motion.div variants={item}>
                                <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                                    Get started
                                </div>

                                <h2 className="mt-1 text-[25px] font-black tracking-[-0.035em] text-slate-900 sm:text-[29px]">
                                    Choose how you want to begin.
                                </h2>

                                <p className="mt-2 max-w-[480px] text-[10px] font-medium leading-5 text-slate-500">
                                    Create your ekarihub account, sign back in, or explore the community before joining.
                                </p>
                            </motion.div>

                            <motion.button
                                variants={item}
                                type="button"
                                onClick={() =>
                                    router.push("/signup")
                                }
                                whileTap={
                                    reduceMotion
                                        ? undefined
                                        : { scale: 0.99 }
                                }
                                className="group mt-6 w-full rounded-[18px] bg-[#173C2E] p-4 text-left text-white shadow-[0_12px_28px_rgba(23,60,46,0.14)] transition-all duration-200 hover:bg-[#214C3A] hover:shadow-[0_15px_34px_rgba(23,60,46,0.18)]"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-white/[0.09] text-[#c69258]">
                                        <IoPersonAddOutline size={20} />
                                    </span>

                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[12px] font-black">
                                            Create a new account
                                        </span>

                                        <span className="mt-1 block text-[9px] font-medium leading-4 text-white/50">
                                            Build your profile and unlock the full ekarihub experience.
                                        </span>
                                    </span>

                                    <IoArrowForwardOutline
                                        size={16}
                                        className="shrink-0 text-white/45 transition-transform duration-200 group-hover:translate-x-1"
                                    />
                                </div>
                            </motion.button>

                            <motion.div
                                variants={item}
                                className="mt-3"
                            >
                                <Link
                                    href="/login"
                                    className="group flex w-full items-center gap-3 rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 transition-all duration-200 hover:border-[#CBC4B7] hover:bg-white hover:shadow-[0_10px_24px_rgba(15,23,42,0.045)]"
                                >
                                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[#E8ECE8] text-[#173C2E]">
                                        <IoPersonOutline size={19} />
                                    </span>

                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[12px] font-black text-slate-800">
                                            I already have an account
                                        </span>

                                        <span className="mt-1 block text-[9px] font-medium leading-4 text-slate-400">
                                            Sign in and continue where you left off.
                                        </span>
                                    </span>

                                    <IoArrowForwardOutline
                                        size={16}
                                        className="shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-[#173C2E]"
                                    />
                                </Link>
                            </motion.div>

                            <motion.div
                                variants={item}
                                className="my-5 flex items-center gap-3"
                            >
                                <div className="h-px flex-1 bg-[#E5E0D6]" />
                                <span className="text-[8px] font-black uppercase tracking-[0.1em] text-slate-300">
                                    or explore first
                                </span>
                                <div className="h-px flex-1 bg-[#E5E0D6]" />
                            </motion.div>

                            <motion.button
                                variants={item}
                                type="button"
                                onClick={() =>
                                    router.replace("/")
                                }
                                whileTap={
                                    reduceMotion
                                        ? undefined
                                        : { scale: 0.99 }
                                }
                                className="group flex w-full items-center gap-3 rounded-[18px] border border-[#DDD8CC] bg-[#F3F1EB]/65 p-4 text-left transition-all duration-200 hover:bg-[#F3F1EB]"
                            >
                                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-white text-[#c69258] shadow-[0_5px_15px_rgba(15,23,42,0.04)]">
                                    <IoPlayOutline size={19} />
                                </span>

                                <span className="min-w-0 flex-1">
                                    <span className="block text-[11px] font-black text-slate-700">
                                        Explore deeds without an account
                                    </span>

                                    <span className="mt-1 block text-[9px] font-medium leading-4 text-slate-400">
                                        Browse the community first and join whenever you are ready.
                                    </span>
                                </span>

                                <IoArrowForwardOutline
                                    size={15}
                                    className="shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-1"
                                />
                            </motion.button>

                            <motion.div
                                variants={item}
                                className="mt-5 rounded-[16px] border border-[#E5E0D6] bg-[#FBFAF6] px-4 py-3"
                            >
                                <div className="flex items-center gap-2">
                                    <IoLockClosedOutline
                                        size={13}
                                        className="text-[#173C2E]"
                                    />

                                    <span className="text-[9px] font-black text-slate-600">
                                        Your account. Your choice.
                                    </span>
                                </div>

                                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-2">
                                    <TrustItem>
                                        Secure account
                                    </TrustItem>

                                    <TrustItem>
                                        Trusted profiles
                                    </TrustItem>

                                    <TrustItem>
                                        Browse before joining
                                    </TrustItem>
                                </div>
                            </motion.div>
                        </div>

                        <motion.div
                            variants={item}
                            className="pt-5"
                        >
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

                            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                                <span className="text-[9px] font-semibold text-slate-400">
                                    © {new Date().getFullYear()} ekarihub
                                </span>

                                <Link
                                    href="/support"
                                    className="text-[9px] font-bold text-slate-400 transition hover:text-[#173C2E]"
                                >
                                    Support
                                </Link>

                                <Link
                                    href="/about"
                                    className="text-[9px] font-bold text-slate-400 transition hover:text-[#173C2E] lg:hidden"
                                >
                                    About
                                </Link>
                            </div>

                            <div
                                style={{
                                    height:
                                        "env(safe-area-inset-bottom)",
                                }}
                            />
                        </motion.div>
                    </motion.div>
                </section>
            </div>
        </main>
    );
}