"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
    IoArrowForwardOutline,
    IoPeopleOutline,
    IoRibbonOutline,
    IoShieldCheckmarkOutline,
    IoSparklesOutline,
    IoTrendingUpOutline,
} from "react-icons/io5";

import { Footer } from "../components/Footer";
import { Topbar } from "../components/Topbar";

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

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function LeadershipClientPage() {
    const router = useRouter();
    const reduceMotion = useReducedMotion();

    return (
        <main
            className="min-h-[100svh] w-full max-w-full overflow-x-clip bg-[#F8F7F2] touch-pan-y"
            style={{
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-y",
            }}
        >
            <Topbar />

            {/* =========================================================
                FULL-WIDTH HERO
            ========================================================= */}
            <section className="relative overflow-hidden border-b border-[#DDD8CC] bg-[#173C2E] text-white">
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.045]"
                    style={{
                        backgroundImage:
                            "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.75) 18px 19px)",
                    }}
                />

                <div className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full bg-white/[0.035]" />
                <div className="pointer-events-none absolute -bottom-28 left-[30%] h-72 w-72 rounded-full bg-[#F39A22]/[0.08]" />

                <div className="relative mx-auto grid w-full max-w-[1280px] gap-8 px-5 py-10 sm:px-7 md:py-14 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:px-8">
                    <motion.div
                        initial={
                            reduceMotion
                                ? { opacity: 1, y: 0 }
                                : { opacity: 0, y: 8 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                            duration: 0.28,
                            ease: EASE_OUT,
                        }}
                        className="min-w-0"
                    >
                        <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/70">
                                <IoRibbonOutline
                                    size={12}
                                    className="text-[#F39A22]"
                                />
                                Leadership
                            </span>

                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/70">
                                <IoSparklesOutline
                                    size={12}
                                    className="text-[#F39A22]"
                                />
                                Vision + Innovation
                            </span>
                        </div>

                        <div className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-[#F39A22]">
                            Meet our leadership
                        </div>

                        <h1 className="mt-1 max-w-3xl text-[32px] font-black leading-[1.04] tracking-[-0.045em] sm:text-[40px] lg:text-[50px]">
                            Building the future of agribusiness.
                        </h1>

                        <p className="mt-4 max-w-3xl text-[11px] font-medium leading-5 text-white/60 sm:text-[12px] md:leading-6">
                            At ekarihub, our leaders are more than visionaries —
                            they are architects of the next agribusiness revolution.
                            Guided by data, powered by artificial intelligence, and
                            inspired by immersive technology and social connectivity,
                            they are transforming how the world connects, trades and
                            grows across the agribusiness ecosystem.
                        </p>

                        <p className="mt-3 max-w-3xl text-[11px] font-medium leading-5 text-white/50 sm:text-[12px] md:leading-6">
                            Together, they&apos;re redefining sustainability,
                            scalability and social impact — creating an intelligent,
                            borderless network that empowers everyone from smallholder
                            farmers to exporters, partners and consumers.
                        </p>

                        <div className="mt-6 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    router.push("/leadership/executives")
                                }
                                className="inline-flex h-10 items-center gap-2 rounded-[13px] bg-[#F39A22] px-4 text-[9px] font-black text-[#173C2E] transition hover:brightness-105 active:scale-[0.98]"
                            >
                                Meet the executive team
                                <IoArrowForwardOutline size={13} />
                            </button>

                            <button
                                type="button"
                                onClick={() => router.push("/about")}
                                className="inline-flex h-10 items-center gap-2 rounded-[13px] border border-white/12 bg-white/[0.06] px-4 text-[9px] font-black text-white/80 transition hover:bg-white/[0.11] active:scale-[0.98]"
                            >
                                About ekarihub
                                <IoArrowForwardOutline size={13} />
                            </button>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={
                            reduceMotion
                                ? { opacity: 1, scale: 1 }
                                : { opacity: 0, scale: 0.985 }
                        }
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                            duration: 0.32,
                            ease: EASE_OUT,
                            delay: reduceMotion ? 0 : 0.03,
                        }}
                        className="relative overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.16)]"
                    >
                        <div className="relative aspect-[4/4] w-full overflow-hidden rounded-[17px]">
                            <Image
                                src="/ceo.jpg"
                                alt="ekarihub leadership"
                                fill
                                priority
                                className="object-cover"
                                sizes="(max-width: 1024px) 100vw, 420px"
                            />

                            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent px-4 pb-4 pt-16">
                                <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
                                    Purpose-led leadership
                                </div>

                                <div className="mt-1 text-[12px] font-black text-white">
                                    Strategy. Innovation. Impact.
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* =========================================================
                LEADERSHIP PRINCIPLES
            ========================================================= */}
            <section className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 md:py-8 lg:px-8">
                <div className="mb-4 max-w-2xl">
                    <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
                        Leadership philosophy
                    </div>

                    <h2 className="mt-1 text-[20px] font-black tracking-[-0.03em] text-slate-900 sm:text-[22px]">
                        Leading with clarity, trust and long-term value.
                    </h2>

                    <p className="mt-1 text-[10px] font-medium leading-5 text-slate-400">
                        Our leadership approach combines technology, community
                        intelligence and accountable execution to create lasting
                        value across the agribusiness ecosystem.
                    </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                    <PrincipleCard
                        icon={<IoTrendingUpOutline size={18} />}
                        eyebrow="Growth"
                        title="Build for scale"
                        description="Create systems, partnerships and products that can grow responsibly across markets and communities."
                    />

                    <PrincipleCard
                        icon={<IoShieldCheckmarkOutline size={18} />}
                        eyebrow="Trust"
                        title="Lead with accountability"
                        description="Put transparency, safety and responsible decision-making at the centre of how ekarihub grows."
                    />

                    <PrincipleCard
                        icon={<IoPeopleOutline size={18} />}
                        eyebrow="Community"
                        title="Design for people"
                        description="Use technology to strengthen human connection, access, opportunity and shared prosperity."
                    />
                </div>

                <div className="mt-5 overflow-hidden rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6]">
                    <div className="flex flex-col gap-4 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
                        <div className="max-w-2xl">
                            <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
                                Executive team
                            </div>

                            <h2 className="mt-1 text-[18px] font-black tracking-[-0.03em] text-slate-900">
                                Get to know the people leading ekarihub.
                            </h2>

                            <p className="mt-1 text-[10px] font-medium leading-5 text-slate-400">
                                Explore the executive team, their experience and
                                the roles they play in shaping ekarihub&apos;s direction.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                router.push("/leadership/executives")
                            }
                            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[12px] bg-[#173C2E] px-4 text-[9px] font-black text-white transition hover:bg-[#214C3A] active:scale-[0.98]"
                        >
                            View executives
                            <IoArrowForwardOutline size={13} />
                        </button>
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
}

function PrincipleCard({
    icon,
    eyebrow,
    title,
    description,
}: {
    icon: React.ReactNode;
    eyebrow: string;
    title: string;
    description: string;
}) {
    return (
        <motion.article
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{
                once: true,
                amount: 0.15,
            }}
            transition={{
                duration: 0.2,
                ease: EASE_OUT,
            }}
            className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)]"
        >
            <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[#E8ECE8] text-[#173C2E]">
                    {icon}
                </span>

                <div className="min-w-0">
                    <div className="text-[8px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
                        {eyebrow}
                    </div>

                    <h3 className="mt-1 text-[11px] font-black text-slate-800">
                        {title}
                    </h3>

                    <p className="mt-1 text-[9px] font-medium leading-4 text-slate-400">
                        {description}
                    </p>
                </div>
            </div>
        </motion.article>
    );
}