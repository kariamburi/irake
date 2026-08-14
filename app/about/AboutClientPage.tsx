// app/about/page.tsx
"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion, Variants } from "framer-motion";
import {
    IoLeafOutline,
    IoPeopleOutline,
    IoCartOutline,
    IoSchoolOutline,
    IoSparklesOutline,
    IoCalendarOutline,
    IoNewspaperOutline,
    IoShieldCheckmarkOutline,
    IoArrowForwardOutline,
    IoCheckmarkCircleOutline,
    IoTrendingUpOutline,
    IoChatbubblesOutline,
    IoRibbonOutline,
} from "react-icons/io5";
import { useAuth } from "../hooks/useAuth";

const EKARI = {
    forest: "#173C2E",
    leaf: "#214C3A",
    gold: "#c69258",
    sand: "#F8F7F2",
    paper: "#FBFAF6",
    text: "#0F172A",
    subtext: "#64748B",
    border: "#DDD8CC",
};

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const container: Variants = {
    hidden: { opacity: 0, y: 16 },
    show: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            ease: EASE_OUT,
            staggerChildren: 0.08,
        },
    },
};

const item: Variants = {
    hidden: { opacity: 0, y: 14 },
    show: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.45,
            ease: EASE_OUT,
        },
    },
};



function Pill({
    children,
    icon,
}: {
    children: React.ReactNode;
    icon?: React.ReactNode;
}) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-[10px] font-black text-white/85 backdrop-blur-sm">
            {icon}
            {children}
        </span>
    );
}

function Feature({
    title,
    desc,
    icon,
}: {
    title: string;
    desc: string;
    icon: React.ReactNode;
}) {
    return (
        <motion.div
            variants={item}
            whileHover={{ y: -2 }}
            className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.025)] transition"
        >
            <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E8ECE8] text-[#173C2E]">
                    {icon}
                </div>

                <div className="min-w-0">
                    <h4 className="text-[12px] font-black text-slate-900">
                        {title}
                    </h4>

                    <p className="mt-1 text-[10px] font-medium leading-5 text-slate-500">
                        {desc}
                    </p>
                </div>
            </div>
        </motion.div>
    );
}

function InfoCard({
    eyebrow,
    title,
    body,
    icon,
}: {
    eyebrow: string;
    title: string;
    body: React.ReactNode;
    icon: React.ReactNode;
}) {
    return (
        <motion.section
            variants={item}
            className="rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] p-5 shadow-[0_10px_28px_rgba(15,23,42,0.03)]"
        >
            <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[#E8ECE8] text-[#173C2E]">
                    {icon}
                </div>

                <div className="min-w-0">
                    <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                        {eyebrow}
                    </div>

                    <h3 className="mt-1 text-[15px] font-black text-slate-900">
                        {title}
                    </h3>

                    <div className="mt-2 text-[10px] font-medium leading-5 text-slate-500">
                        {body}
                    </div>
                </div>
            </div>
        </motion.section>
    );
}

function MiniStat({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-[14px] border border-white/12 bg-white/[0.06] px-3 py-3">
            <div className="text-[9px] font-black uppercase tracking-[0.08em] text-white/45">
                {label}
            </div>

            <div className="mt-1 text-[11px] font-black text-white">
                {value}
            </div>
        </div>
    );
}

function StepCard({
    number,
    title,
    body,
}: {
    number: string;
    title: string;
    body: string;
}) {
    return (
        <motion.div
            variants={item}
            className="rounded-[18px] border border-[#DDD8CC] bg-white p-4"
        >
            <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#173C2E] text-[10px] font-black text-white">
                    {number}
                </span>

                <div>
                    <div className="text-[11px] font-black text-slate-800">
                        {title}
                    </div>

                    <p className="mt-1 text-[9px] font-medium leading-4 text-slate-400">
                        {body}
                    </p>
                </div>
            </div>
        </motion.div>
    );
}

export default function AboutPage() {
    const reduceMotion =
        useReducedMotion();

    const {
        user,
        loading: authLoading,
    } = useAuth();

    const isGuest =
        !authLoading &&
        !user?.uid;

    const MainContent = (
        <div className="w-full max-w-full overflow-x-clip bg-[#F8F7F2]">
            {/* =========================================================
                PUBLIC / TOP NAVIGATION
            ========================================================= */}
            <div className="sticky top-0 z-50 border-b border-[#DDD8CC] bg-[#FBFAF6]/95 backdrop-blur-xl">
                <div className="mx-auto flex h-[64px] max-w-[1280px] items-center gap-3 px-3 sm:px-5 md:px-6 lg:px-8">
                    <Link
                        href="/"
                        className="inline-flex items-center"
                        aria-label="Go to ekarihub"
                    >
                        <Image
                            src="/ekarihub-logo.png"
                            alt="ekarihub"
                            width={160}
                            height={48}
                            priority
                            className="h-auto w-[132px] sm:w-[145px]"
                        />
                    </Link>

                    <div className="flex-1" />

                    <Link
                        href="/leadership"
                        className="hidden h-9 items-center gap-1.5 rounded-[12px] border border-[#DDD8CC] bg-white px-3 text-[9px] font-black text-slate-600 transition hover:bg-[#F3F1EB] md:inline-flex"
                    >
                        <IoRibbonOutline size={14} />
                        Leadership
                    </Link>

                    <Link
                        href="/market"
                        className="hidden h-9 items-center rounded-[12px] border border-[#DDD8CC] bg-white px-3 text-[9px] font-black text-[#173C2E] transition hover:bg-[#EEF3EE] sm:inline-flex"
                    >
                        Marketplace
                    </Link>

                    <Link
                        href={
                            isGuest
                                ? "/getstarted?next=/about"
                                : "/"
                        }
                        className="inline-flex h-9 items-center gap-1.5 rounded-[12px] bg-[#173C2E] px-3.5 text-[9px] font-black text-white transition hover:bg-[#214C3A]"
                    >
                        {isGuest
                            ? "Get started"
                            : "Back to ekarihub"}
                        <IoArrowForwardOutline size={13} />
                    </Link>
                </div>
            </div>

            {/* =========================================================
                FULL-WIDTH HERO
            ========================================================= */}
            <motion.section
                initial={
                    reduceMotion
                        ? { opacity: 1, y: 0 }
                        : { opacity: 0, y: 8 }
                }
                animate={{ opacity: 1, y: 0 }}
                transition={{
                    duration: 0.24,
                    ease: "easeOut",
                }}
                className="relative w-full overflow-hidden border-b border-[#DDD8CC] bg-[#173C2E] text-white"
            >
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.045]"
                    style={{
                        backgroundImage:
                            "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.75) 18px 19px)",
                    }}
                />

                <div className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full bg-white/[0.035]" />
                <div className="pointer-events-none absolute -bottom-24 left-[32%] h-64 w-64 rounded-full bg-[#c69258]/[0.08]" />

                <div className="relative mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-7 md:py-14 lg:px-8">
                    <motion.div
                        variants={container}
                        initial={
                            reduceMotion
                                ? "show"
                                : "hidden"
                        }
                        animate="show"
                        className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-end"
                    >
                        <div className="min-w-0">
                            <motion.div
                                variants={item}
                                className="flex flex-wrap gap-2"
                            >
                                <Pill icon={<IoSparklesOutline />}>
                                    AI + Data + Community
                                </Pill>

                                <Pill icon={<IoLeafOutline />}>
                                    Agribusiness ecosystem
                                </Pill>

                                <Pill icon={<IoShieldCheckmarkOutline />}>
                                    Trusted network
                                </Pill>
                            </motion.div>

                            <motion.div
                                variants={item}
                                className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-[#c69258]"
                            >
                                About ekarihub
                            </motion.div>

                            <motion.h1
                                variants={item}
                                className="mt-1 max-w-4xl text-[32px] font-black leading-[1.04] tracking-[-0.045em] sm:text-[40px] lg:text-[50px]"
                            >
                                Collaborate. Innovate. Cultivate.
                            </motion.h1>

                            <motion.p
                                variants={item}
                                className="mt-4 max-w-3xl text-[11px] font-medium leading-5 text-white/60 sm:text-[12px] md:leading-6"
                            >
                                ekarihub is a digital agribusiness ecosystem built to create value across agribusiness, green living, and wildlife conservation. Powered by data, artificial intelligence and social connectivity, we bring together farmers, agronomists, agro-vets, suppliers, buyers, exporters, conservationists and sustainability advocates into one intelligent network.
                            </motion.p>

                            <motion.p
                                variants={item}
                                className="mt-3 max-w-3xl text-[11px] font-medium leading-5 text-white/50 sm:text-[12px] md:leading-6"
                            >
                                From farm to forest, and from soil to wildlife, ekarihub helps people share knowledge, build meaningful partnerships, access markets and adopt sustainable practices that support both economic growth and environmental stewardship.
                            </motion.p>

                            <motion.div
                                variants={item}
                                className="mt-6 flex flex-wrap gap-2"
                            >
                                <Link
                                    href="/"
                                    className="inline-flex h-10 items-center gap-2 rounded-[13px] bg-[#c69258] px-4 text-[9px] font-black text-[#173C2E] transition hover:brightness-105"
                                >
                                    Explore deeds
                                    <IoArrowForwardOutline size={13} />
                                </Link>

                                <Link
                                    href="/market"
                                    className="inline-flex h-10 items-center gap-2 rounded-[13px] border border-white/12 bg-white/[0.06] px-4 text-[9px] font-black text-white/80 transition hover:bg-white/[0.11]"
                                >
                                    Visit ekariMarket
                                    <IoArrowForwardOutline size={13} />
                                </Link>

                                <Link
                                    href="/leadership"
                                    className="inline-flex h-10 items-center gap-2 rounded-[13px] border border-white/12 bg-white/[0.06] px-4 text-[9px] font-black text-white/80 transition hover:bg-white/[0.11] md:hidden"
                                >
                                    Leadership
                                    <IoArrowForwardOutline size={13} />
                                </Link>
                            </motion.div>
                        </div>

                        <motion.div
                            variants={item}
                            className="grid grid-cols-2 gap-2"
                        >
                            <MiniStat
                                label="Trust"
                                value="Verified profiles"
                            />
                            <MiniStat
                                label="Market"
                                value="Buy & sell goods"
                            />
                            <MiniStat
                                label="Learn"
                                value="Guides + ekari AI"
                            />
                            <MiniStat
                                label="Events"
                                value="Trainings & talks"
                            />
                        </motion.div>
                    </motion.div>
                </div>
            </motion.section>

            {/* =========================================================
                PAGE CONTENT
            ========================================================= */}
            <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 md:py-8 lg:px-8">
                {/* MISSION + VISION */}
                <motion.div
                    variants={container}
                    initial={
                        reduceMotion
                            ? "show"
                            : "hidden"
                    }
                    whileInView="show"
                    viewport={{
                        once: true,
                        amount: 0.15,
                    }}
                    className="mt-5 grid gap-4 md:grid-cols-2"
                >
                    <InfoCard
                        eyebrow="Our mission"
                        title="Empower the agribusiness community"
                        icon={
                            <IoTrendingUpOutline size={19} />
                        }
                        body={
                            <>
                                To empower the global agribusiness community by fostering collaboration, enabling seamless market access, and driving knowledge sharing through technology, data and artificial intelligence — supporting sustainable growth for every player across the value chain.
                            </>
                        }
                    />

                    <InfoCard
                        eyebrow="Our vision"
                        title="One intelligent agribusiness ecosystem"
                        icon={
                            <IoSparklesOutline size={19} />
                        }
                        body={
                            <>
                                To be the leading social network and digital marketplace for agribusiness — connecting stakeholders in one intelligent ecosystem that <strong className="font-black text-slate-700">Cultivates Communities</strong>, <strong className="font-black text-slate-700">Grows Agribusiness Opportunities</strong>, and redefines how the world connects, trades, learns and thrives in agriculture.
                            </>
                        }
                    />
                </motion.div>

                {/* WHAT WE DO */}
                <motion.section
                    variants={container}
                    initial={
                        reduceMotion
                            ? "show"
                            : "hidden"
                    }
                    whileInView="show"
                    viewport={{
                        once: true,
                        amount: 0.12,
                    }}
                    className="mt-5 rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.025)] sm:p-5"
                >
                    <motion.div
                        variants={item}
                        className="max-w-2xl"
                    >
                        <div className="text-[10px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                            What we do
                        </div>

                        <h2 className="mt-1 text-[20px] font-black tracking-[-0.03em] text-slate-900">
                            One ecosystem for connection, trade and growth
                        </h2>

                        <p className="mt-1 text-[10px] font-medium leading-5 text-slate-400">
                            ekarihub makes it easier to connect, trade, learn and grow through an integrated set of agribusiness tools.
                        </p>
                    </motion.div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <Feature
                            title="Social Networking for Agribusiness"
                            desc="Engage with peers, share updates, exchange insights, and build relationships."
                            icon={
                                <IoPeopleOutline size={18} />
                            }
                        />

                        <Feature
                            title="Marketplace for Goods & Services"
                            desc="Buy and sell products, equipment, and services with transparent pricing and trusted profiles."
                            icon={
                                <IoCartOutline size={18} />
                            }
                        />

                        <Feature
                            title="Learning & Resources Hub"
                            desc="Access expert content, ekari AI, practical guides, and data-driven insights."
                            icon={
                                <IoSchoolOutline size={18} />
                            }
                        />

                        <Feature
                            title="Business Opportunities & Partnerships"
                            desc="Discover new markets, collaborators, and growth avenues across the value chain."
                            icon={
                                <IoSparklesOutline size={18} />
                            }
                        />

                        <Feature
                            title="Events & Discussions"
                            desc="Join discussions and training to expand expertise and professional networks."
                            icon={
                                <IoCalendarOutline size={18} />
                            }
                        />

                        <Feature
                            title="Agricultural News & Insights"
                            desc="Stay informed with trends, policies, and technologies shaping agribusiness."
                            icon={
                                <IoNewspaperOutline size={18} />
                            }
                        />
                    </div>
                </motion.section>

                {/* WHY + HOW */}
                <motion.div
                    variants={container}
                    initial={
                        reduceMotion
                            ? "show"
                            : "hidden"
                    }
                    whileInView="show"
                    viewport={{
                        once: true,
                        amount: 0.12,
                    }}
                    className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]"
                >
                    <motion.section
                        variants={item}
                        className="rounded-[20px] border border-[#DDD8CC] bg-[#173C2E] p-5 text-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
                    >
                        <div className="text-[10px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                            Why ekarihub
                        </div>

                        <h2 className="mt-1 text-[18px] font-black">
                            Built for the whole value chain
                        </h2>

                        <p className="mt-2 text-[11px] font-medium leading-5 text-white/65">
                            We’re a thriving community where agribusiness actors collaborate, innovate and cultivate success. Whether you’re a smallholder farmer or a global exporter, ekarihub supports your journey with tools that make agribusiness simpler, smarter and more secure.
                        </p>

                        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                            <MiniStat
                                label="Community"
                                value="Connect & collaborate"
                            />
                            <MiniStat
                                label="Opportunity"
                                value="Trade & partnerships"
                            />
                            <MiniStat
                                label="Intelligence"
                                value="AI + data insights"
                            />
                            <MiniStat
                                label="Trust"
                                value="Verified ecosystem"
                            />
                        </div>
                    </motion.section>

                    <motion.section
                        variants={item}
                        className="rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] p-5 shadow-[0_10px_28px_rgba(15,23,42,0.025)]"
                    >
                        <div className="text-[10px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                            How it works
                        </div>

                        <h2 className="mt-1 text-[17px] font-black text-slate-900">
                            Join. Connect. Grow.
                        </h2>

                        <div className="mt-4 space-y-2">
                            <StepCard
                                number="1"
                                title="Build your trusted profile"
                                body="Join the community and establish your presence in the agribusiness ecosystem."
                            />

                            <StepCard
                                number="2"
                                title="Connect, learn and share"
                                body="Exchange insights, discover expertise and participate across the value chain."
                            />

                            <StepCard
                                number="3"
                                title="Trade and unlock opportunities"
                                body="Use ekariMarket and community connections to access buyers, suppliers and partnerships."
                            />
                        </div>
                    </motion.section>
                </motion.div>

                {/* SUSTAINABILITY */}
                <motion.section
                    initial={
                        reduceMotion
                            ? {
                                opacity: 1,
                                y: 0,
                            }
                            : {
                                opacity: 0,
                                y: 6,
                            }
                    }
                    whileInView={{
                        opacity: 1,
                        y: 0,
                    }}
                    viewport={{
                        once: true,
                        amount: 0.15,
                    }}
                    transition={{
                        duration: 0.22,
                    }}
                    className="mt-5 rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] p-5 shadow-[0_10px_28px_rgba(15,23,42,0.025)]"
                >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="max-w-2xl">
                            <div className="flex items-center gap-3">
                                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[#E8ECE8] text-[#173C2E]">
                                    <IoLeafOutline size={20} />
                                </span>

                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                                        Sustainability
                                    </div>

                                    <h2 className="mt-0.5 text-[17px] font-black text-slate-900">
                                        Agribusiness that protects the future
                                    </h2>
                                </div>
                            </div>

                            <p className="mt-3 text-[10px] font-medium leading-5 text-slate-500">
                                Learn eco-friendly techniques that promote environmental stewardship and long-term productivity. ekarihub connects farm productivity with green living, conservation and community prosperity.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:min-w-[390px]">
                            {[
                                "Farm",
                                "Environment",
                                "Wildlife",
                                "Prosperity",
                            ].map(
                                (
                                    label,
                                    index
                                ) => (
                                    <div
                                        key={label}
                                        className="rounded-xl bg-[#F3F1EB] px-3 py-3 text-center"
                                    >
                                        <div className="text-[16px] font-black text-[#173C2E]">
                                            {index + 1}
                                        </div>

                                        <div className="mt-1 text-[8px] font-black uppercase tracking-[0.07em] text-slate-400">
                                            {label}
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </motion.section>

                {/* FINAL CTA */}
                <motion.section
                    initial={
                        reduceMotion
                            ? {
                                opacity: 1,
                                y: 0,
                            }
                            : {
                                opacity: 0,
                                y: 6,
                            }
                    }
                    whileInView={{
                        opacity: 1,
                        y: 0,
                    }}
                    viewport={{
                        once: true,
                        amount: 0.18,
                    }}
                    transition={{
                        duration: 0.22,
                    }}
                    className="mt-5 overflow-hidden rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6]"
                >
                    <div className="flex flex-col gap-4 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
                        <div className="max-w-2xl">
                            <div className="text-[10px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                                Grow with ekarihub
                            </div>

                            <h2 className="mt-1 text-[20px] font-black tracking-[-0.03em] text-slate-900">
                                Cultivating communities. Growing opportunities.
                            </h2>

                            <p className="mt-1 text-[10px] font-medium leading-5 text-slate-400">
                                Join the ecosystem, discover opportunities and connect with people shaping the future of agribusiness.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Link
                                href={
                                    isGuest
                                        ? "/getstarted?next=/about"
                                        : "/"
                                }
                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#173C2E] px-4 text-[10px] font-black text-white transition hover:bg-[#214C3A]"
                            >
                                {isGuest
                                    ? "Join ekarihub"
                                    : "Open ekarihub"}
                                <IoArrowForwardOutline size={13} />
                            </Link>

                            <Link
                                href="/market"
                                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-4 text-[10px] font-black text-[#173C2E] transition hover:bg-[#EEF3EE]"
                            >
                                Explore market
                            </Link>

                            <Link
                                href="/leadership"
                                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-4 text-[10px] font-black text-slate-600 transition hover:bg-[#F3F1EB]"
                            >
                                Leadership
                            </Link>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#E4DED2] px-5 py-3 sm:px-6">
                        <Link
                            href="/terms"
                            className="text-[9px] font-black text-slate-400 transition hover:text-[#173C2E]"
                        >
                            Terms
                        </Link>

                        <Link
                            href="/privacy"
                            className="text-[9px] font-black text-slate-400 transition hover:text-[#173C2E]"
                        >
                            Privacy
                        </Link>

                        <Link
                            href="/careers"
                            className="text-[9px] font-black text-slate-400 transition hover:text-[#173C2E]"
                        >
                            Careers
                        </Link>

                        <Link
                            href="/support"
                            className="text-[9px] font-black text-slate-400 transition hover:text-[#173C2E]"
                        >
                            Support
                        </Link>

                        <div className="ml-auto text-[9px] font-semibold text-slate-400">
                            ©{" "}
                            {new Date().getFullYear()}{" "}
                            ekarihub
                        </div>
                    </div>
                </motion.section>

                <div
                    style={{
                        height:
                            "env(safe-area-inset-bottom)",
                    }}
                />
            </main>
        </div>
    );

    if (
        !isGuest &&
        !authLoading
    ) {
        return (

            <div
                className="h-[100svh] w-full max-w-full overflow-y-auto overflow-x-hidden overscroll-y-contain bg-[#F8F7F2] touch-pan-y"
                style={{
                    WebkitOverflowScrolling: "touch",
                    touchAction: "pan-y",
                }}
            >
                {MainContent}
            </div>

        );
    }

    return (
        <div
            className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#F8F7F2] touch-pan-y"
            style={{
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-y",
            }}
        >
            {MainContent}
        </div>
    );
}