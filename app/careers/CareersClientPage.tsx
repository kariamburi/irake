// app/careers/page.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { Topbar } from "../components/Topbar";
import { Footer } from "../components/Footer";
import {
    IoArrowForwardOutline,
    IoBriefcaseOutline,
    IoChevronUpOutline,
    IoPeopleOutline,
    IoRocketOutline,
    IoSparklesOutline,
} from "react-icons/io5";

/** --- Brand --- */
const EKARI = {
    forest: "#173C2E",
    leaf: "#214C3A",
    gold: "#F39A22",
    page: "#F8F7F2",
    surface: "#FBFAF6",
    hair: "#DDD8CC",
    text: "#0F172A",
    dim: "#64748B",
    bg: "#F8F7F2",
};

type Section = { id: string; title: string; body: React.ReactNode };

/** --- Helper: active section tracking --- */
function useActiveSection(ids: string[]) {
    const [active, setActive] = React.useState(ids[0] || "");
    React.useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const top = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
                if (top?.target?.id) setActive(top.target.id);
            },
            { root: null, rootMargin: "0px 0px -60% 0px", threshold: [0.15, 0.35, 0.6] }
        );
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, [ids]);
    return active;
}

/** --- Animations (typed; easing cast satisfies TS for older FM typings) --- */
const fadeUp: Variants = {
    hidden: { opacity: 0, y: 12 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as unknown as any },
    },
};
const fadeIn: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.35 } },
};

/** --- Job Cards --- */
type Job = {
    title: string;
    team: string;
    location: string;
    type: string;
    href?: string;
    future?: boolean;
};

const OPEN_ROLES: Job[] = []; // no openings right now

function JobCard({ job }: { job: Job }) {
    return (
        <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
            className="rounded-[16px] border border-[#DDD8CC] bg-white p-4 transition hover:border-[#CFC7B8] hover:shadow-[0_10px_26px_rgba(15,23,42,0.05)] md:p-5"
        >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                    <div className="text-[11px] font-black text-slate-800 md:text-[12px]">
                        {job.title}
                    </div>

                    <div className="mt-1 text-[8px] font-semibold text-slate-400">
                        {job.team} • {job.location} • {job.type}
                    </div>

                    {job.future ? (
                        <div className="mt-2 inline-flex items-center rounded-full border border-[#F3D5AD] bg-[#FFF7EB] px-2.5 py-1 text-[8px] font-black text-[#F39A22]">
                            Future role
                        </div>
                    ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    {job.href ? (
                        <Link
                            href={job.href}
                            className="inline-flex h-9 items-center gap-1.5 rounded-[11px] bg-[#173C2E] px-3 text-[8px] font-black text-white transition hover:bg-[#214C3A]"
                        >
                            View details
                            <IoArrowForwardOutline size={11} />
                        </Link>
                    ) : (
                        <a
                            href="mailto:careers@ekarihub.com?subject=Talent%20Network%20-%20ekarihub&body=Hi%20ekarihub%2C%20I%27d%20love%20to%20be%20considered%20for%20future%20roles..."
                            className="inline-flex h-9 items-center gap-1.5 rounded-[11px] border border-[#DDD8CC] bg-[#FBFAF6] px-3 text-[8px] font-black text-[#173C2E] transition hover:bg-[#F3F1EB]"
                        >
                            Notify me
                            <IoArrowForwardOutline size={11} />
                        </a>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

/** --- Page Sections --- */
const SECTIONS: Section[] = [
    {
        id: "open-roles",
        title: "Open Roles",
        body: (
            <div className="space-y-4">
                {OPEN_ROLES.length === 0 ? (
                    <div className="rounded-2xl border p-5 text-center" style={{ borderColor: EKARI.hair, background: "#FBFBFD" }}>
                        <div className="text-base md:text-lg font-extrabold" style={{ color: EKARI.text }}>
                            We’re not hiring right now
                        </div>
                        <p className="mt-1 text-sm" style={{ color: EKARI.dim }}>
                            No open roles at the moment - but we’re growing. Join our Talent Network and we’ll reach out when the timing is right.
                        </p>
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                            <a
                                href="mailto:careers@ekarihub.com?subject=Talent%20Network%20-%20ekarihub&body=Attach%20your%20CV%20and%20share%20a%20few%20lines%20on%20how%20you%27d%20like%20to%20contribute."
                                className="rounded-xl px-4 py-2 text-sm font-bold"
                                style={{ background: EKARI.forest, color: "#fff" }}
                            >
                                Join Talent Network
                            </a>
                            <Link
                                href="/about"
                                className="rounded-xl border px-4 py-2 text-sm font-bold"
                                style={{ borderColor: EKARI.hair, color: EKARI.text, background: "#fff" }}
                            >
                                Learn about ekarihub
                            </Link>
                        </div>
                    </div>
                ) : (
                    OPEN_ROLES.map((job) => <JobCard key={job.title} job={job} />)
                )}
            </div>
        ),
    },
    {
        id: "culture",
        title: "Life at ekarihub",
        body: (
            <div className="space-y-3 text-[15px] leading-7 text-gray-700">
                <p><strong>Mission:</strong> Collaborate • Innovate • Cultivate — we’re building the digital rails for African agriculture.</p>
                <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Impact first:</strong> We optimize for farmer outcomes and transparent markets.</li>
                    <li><strong>High ownership:</strong> Small teams, big responsibility, clear goals.</li>
                    <li><strong>Craft:</strong> We sweat the details — usability, reliability, performance.</li>
                    <li><strong>Remote friendly:</strong> Work from anywhere in EAT ±3, with periodic in-person gatherings.</li>
                </ul>
            </div>
        ),
    },
    {
        id: "process",
        title: "How We Hire",
        body: (
            <ol className="list-decimal pl-5 space-y-2 text-[15px] leading-7 text-gray-700">
                <li>Share your profile/CV and a short note on why ekarihub.</li>
                <li>Screen chat (30–45 min) focused on fit and impact.</li>
                <li>Practical exercise or portfolio review (role-dependent).</li>
                <li>Panel conversation with future collaborators.</li>
                <li>Offer & references.</li>
            </ol>
        ),
    },
    {
        id: "faq",
        title: "FAQ",
        body: (
            <div className="space-y-3 text-[15px] leading-7 text-gray-700">
                <p><strong>Do you offer internships?</strong> Occasionally - send a note with your interests and timing.</p>
                <p><strong>Do you sponsor visas?</strong> Not currently.</p>

            </div>
        ),
    },
    {
        id: "talent",
        title: "Join Our Talent Network",
        body: (
            <div className="rounded-2xl border p-5 md:p-6" style={{ borderColor: EKARI.hair, background: "#FBFBFD" }}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <div className="text-base md:text-lg font-extrabold" style={{ color: EKARI.text }}>
                            Get notified when roles open
                        </div>
                        <div className="text-sm" style={{ color: EKARI.dim }}>
                            Send your CV and a few lines about how you’d like to contribute.
                        </div>
                    </div>
                    <a
                        href="mailto:careers@ekarihub.com?subject=Talent%20Network%20-%20ekarihub&body=Attach%20your%20CV%20and%20share%20a%20few%20lines%20on%20how%20you%27d%20like%20to%20contribute."
                        className="rounded-xl px-4 py-2 text-sm font-bold"
                        style={{ background: EKARI.forest, color: "#fff" }}
                    >
                        Email careers@ekarihub.com
                    </a>
                </div>
            </div>
        ),
    },
];

export default function CareersPage() {
    const ids = React.useMemo(() => SECTIONS.map((s) => s.id), []);
    const active = useActiveSection(ids);
    const [showTop, setShowTop] = React.useState(false);

    React.useEffect(() => {
        const onScroll = () => setShowTop(window.scrollY > 300);

        onScroll();

        window.addEventListener("scroll", onScroll, {
            passive: true,
        });

        return () =>
            window.removeEventListener("scroll", onScroll);
    }, []);

    const onClickNav = (
        e: React.MouseEvent<HTMLAnchorElement>,
        id: string
    ) => {
        e.preventDefault();

        const el = document.getElementById(id);
        if (!el) return;

        el.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });

        history.replaceState(null, "", `#${id}`);
    };

    return (
        <main
            className="min-h-[100svh] w-full max-w-full overflow-x-clip bg-[#F8F7F2] touch-pan-y"
            style={{
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-y",
            }}
        >
            <Topbar />

            {/* =====================================================
                FULL-WIDTH CAREERS HERO
            ===================================================== */}
            <section className="relative overflow-hidden border-b border-[#DDD8CC] bg-[#173C2E] text-white">
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.045]"
                    style={{
                        backgroundImage:
                            "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.75) 18px 19px)",
                    }}
                />

                <div className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full bg-white/[0.035]" />
                <div className="pointer-events-none absolute -bottom-28 left-[34%] h-72 w-72 rounded-full bg-[#F39A22]/[0.08]" />

                <div className="relative mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-7 md:py-14 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                            duration: 0.24,
                            ease: "easeOut",
                        }}
                        className="max-w-[840px]"
                    >
                        <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/70">
                                <IoBriefcaseOutline
                                    size={12}
                                    className="text-[#F39A22]"
                                />
                                Careers
                            </span>

                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/70">
                                <IoSparklesOutline
                                    size={12}
                                    className="text-[#F39A22]"
                                />
                                Build with us
                            </span>
                        </div>

                        <div className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-[#F39A22]">
                            Join the mission
                        </div>

                        <h1 className="mt-1 max-w-4xl text-[32px] font-black leading-[1.04] tracking-[-0.045em] sm:text-[40px] lg:text-[50px]">
                            Build the rails of African agriculture.
                        </h1>

                        <p className="mt-4 max-w-3xl text-[11px] font-medium leading-5 text-white/60 sm:text-[12px] md:leading-6">
                            We&apos;re not hiring right now — but we&apos;re always meeting builders who care about impact, technology, reliable systems and the future of African agribusiness.
                        </p>

                        <div className="mt-6 flex flex-wrap gap-2">
                            <a
                                href="mailto:careers@ekarihub.com?subject=Talent%20Network%20-%20ekarihub&body=Attach%20your%20CV%20and%20share%20a%20few%20lines%20on%20how%20you%27d%20like%20to%20contribute."
                                className="inline-flex h-10 items-center gap-2 rounded-[13px] bg-[#F39A22] px-4 text-[9px] font-black text-[#173C2E] transition hover:brightness-105"
                            >
                                Join talent network
                                <IoArrowForwardOutline size={13} />
                            </a>

                            <Link
                                href="/about"
                                className="inline-flex h-10 items-center gap-2 rounded-[13px] border border-white/12 bg-white/[0.06] px-4 text-[9px] font-black text-white/80 transition hover:bg-white/[0.11]"
                            >
                                About ekarihub
                                <IoArrowForwardOutline size={13} />
                            </Link>
                        </div>

                        <div className="mt-7 grid max-w-2xl grid-cols-1 gap-2 sm:grid-cols-3">
                            <HeroStat
                                icon={<IoPeopleOutline size={15} />}
                                title="Small teams"
                                text="High ownership"
                            />

                            <HeroStat
                                icon={<IoRocketOutline size={15} />}
                                title="Impact first"
                                text="Build useful systems"
                            />

                            <HeroStat
                                icon={<IoSparklesOutline size={15} />}
                                title="Remote friendly"
                                text="EAT ±3"
                            />
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* =====================================================
                CAREERS CONTENT
            ===================================================== */}
            <section className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 md:py-8 lg:px-8">
                <div className="grid min-w-0 gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:gap-8">
                    {/* LEFT NAV */}
                    <aside className="min-w-0 lg:sticky lg:top-5 lg:self-start">
                        <div className="overflow-hidden rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
                            <div className="border-b border-[#E5E0D6] px-4 py-3.5">
                                <div className="text-[8px] font-black uppercase tracking-[0.11em] text-[#F39A22]">
                                    Careers
                                </div>

                                <h2 className="mt-1 text-[12px] font-black text-slate-800">
                                    Explore
                                </h2>
                            </div>

                            <nav className="p-2">
                                {SECTIONS.map((section, index) => {
                                    const isActive =
                                        active === section.id;

                                    return (
                                        <a
                                            key={section.id}
                                            href={`#${section.id}`}
                                            onClick={(e) =>
                                                onClickNav(
                                                    e,
                                                    section.id
                                                )
                                            }
                                            className={[
                                                "group flex items-center gap-3 rounded-[13px] px-3 py-2.5",
                                                "transition-all duration-200",
                                                isActive
                                                    ? "bg-[#E8ECE8] text-[#173C2E]"
                                                    : "text-slate-500 hover:bg-[#F3F1EB] hover:text-[#173C2E]",
                                            ].join(" ")}
                                        >
                                            <span
                                                className={[
                                                    "grid h-7 w-7 shrink-0 place-items-center rounded-[9px] text-[8px] font-black",
                                                    isActive
                                                        ? "bg-[#173C2E] text-white"
                                                        : "bg-white text-slate-400",
                                                ].join(" ")}
                                            >
                                                {String(
                                                    index + 1
                                                ).padStart(
                                                    2,
                                                    "0"
                                                )}
                                            </span>

                                            <span className="min-w-0 flex-1 text-[9px] font-black leading-4">
                                                {section.title}
                                            </span>
                                        </a>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="mt-4 rounded-[16px] border border-[#E5E0D6] bg-[#FBFAF6] p-3.5">
                            <div className="text-[8px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
                                Talent network
                            </div>

                            <p className="mt-2 text-[8px] font-medium leading-4 text-slate-400">
                                No suitable opening today? Send us your CV and we&apos;ll keep you in mind as ekarihub grows.
                            </p>

                            <a
                                href="mailto:careers@ekarihub.com?subject=Talent%20Network%20-%20ekarihub&body=Attach%20your%20CV%20and%20share%20a%20few%20lines%20on%20how%20you%27d%20like%20to%20contribute."
                                className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-[11px] bg-[#173C2E] px-3 text-[8px] font-black text-white transition hover:bg-[#214C3A]"
                            >
                                Email careers
                                <IoArrowForwardOutline size={11} />
                            </a>
                        </div>
                    </aside>

                    {/* MAIN CONTENT */}
                    <article className="min-w-0">
                        <div className="overflow-hidden rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
                            {SECTIONS.map((section, index) => (
                                <motion.section
                                    key={section.id}
                                    id={section.id}
                                    variants={fadeUp}
                                    initial="hidden"
                                    whileInView="show"
                                    viewport={{
                                        once: true,
                                        amount: 0.08,
                                    }}
                                    className={[
                                        "scroll-mt-6 px-5 py-5 sm:px-6 sm:py-6",
                                        index <
                                            SECTIONS.length - 1
                                            ? "border-b border-[#E8E3D8]"
                                            : "",
                                    ].join(" ")}
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#E8ECE8] text-[9px] font-black text-[#173C2E]">
                                            {String(
                                                index + 1
                                            ).padStart(
                                                2,
                                                "0"
                                            )}
                                        </span>

                                        <div className="min-w-0 flex-1">
                                            <h2 className="text-[16px] font-black tracking-[-0.02em] text-slate-900 sm:text-[18px]">
                                                {section.title}
                                            </h2>

                                            <div className="mt-3 text-[10px] font-medium leading-5 text-slate-600 sm:text-[11px] sm:leading-6 [&_a]:font-black [&_a]:text-[#173C2E] [&_strong]:font-black [&_ul]:space-y-1.5 [&_ol]:space-y-1.5">
                                                {section.body}
                                            </div>
                                        </div>
                                    </div>
                                </motion.section>
                            ))}
                        </div>

                        <motion.div
                            variants={fadeUp}
                            initial="hidden"
                            whileInView="show"
                            viewport={{
                                once: true,
                                amount: 0.15,
                            }}
                            className="mt-5 rounded-[18px] border border-[#DDD8CC] bg-[#173C2E] p-5 text-white sm:p-6"
                        >
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div className="max-w-2xl">
                                    <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
                                        Build with ekarihub
                                    </div>

                                    <h3 className="mt-1 text-[17px] font-black tracking-[-0.03em]">
                                        Don&apos;t wait for the perfect vacancy.
                                    </h3>

                                    <p className="mt-1 text-[9px] font-medium leading-4 text-white/50">
                                        If our mission resonates with you, introduce yourself and tell us where you can create value.
                                    </p>
                                </div>

                                <a
                                    href="mailto:careers@ekarihub.com?subject=Talent%20Network%20-%20ekarihub&body=Attach%20your%20CV%20and%20share%20a%20few%20lines%20on%20how%20you%27d%20like%20to%20contribute."
                                    className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[12px] bg-[#F39A22] px-4 text-[9px] font-black text-[#173C2E] transition hover:brightness-105"
                                >
                                    Join talent network
                                    <IoArrowForwardOutline size={13} />
                                </a>
                            </div>
                        </motion.div>
                    </article>
                </div>
            </section>

            {/* BACK TO TOP */}
            <button
                type="button"
                onClick={() =>
                    window.scrollTo({
                        top: 0,
                        behavior: "smooth",
                    })
                }
                className={[
                    "fixed bottom-5 right-4 z-40 inline-flex h-10 items-center gap-1.5 rounded-full",
                    "border border-[#DDD8CC] bg-[#FBFAF6] px-3.5 text-[9px] font-black text-[#173C2E]",
                    "shadow-[0_10px_28px_rgba(15,23,42,0.10)] transition-all duration-200",
                    showTop
                        ? "translate-y-0 opacity-100"
                        : "pointer-events-none translate-y-2 opacity-0",
                ].join(" ")}
                aria-label="Back to top"
            >
                <IoChevronUpOutline size={13} />
                Top
            </button>

            <Footer />
        </main>
    );
}

function HeroStat({
    icon,
    title,
    text,
}: {
    icon: React.ReactNode;
    title: string;
    text: string;
}) {
    return (
        <div className="flex items-center gap-3 rounded-[14px] border border-white/10 bg-white/[0.06] p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-white/10 text-[#F39A22]">
                {icon}
            </span>

            <span className="min-w-0">
                <span className="block text-[9px] font-black text-white">
                    {title}
                </span>

                <span className="mt-0.5 block text-[7px] font-medium text-white/40">
                    {text}
                </span>
            </span>
        </div>
    );
}