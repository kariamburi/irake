// app/policy/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { Topbar } from "../components/Topbar";
import { Footer } from "../components/Footer";
import { IoArrowForwardOutline, IoChevronUpOutline, IoLockClosedOutline, IoShieldCheckmarkOutline, IoSparklesOutline } from "react-icons/io5";

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

/** --- Animations --- */
const fadeUp: Variants = {
    hidden: { opacity: 0, y: 12 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as unknown as any },
    },
};

/** --- Policy Sections (EXACT text, structured only) --- */
const SECTIONS: Section[] = [
    {
        id: "introduction",
        title: "1. Introduction",
        body: (
            <div className="space-y-4">
                <p>
                    Welcome to ekarihub, a platform designed to facilitate the trading of agricultural goods and
                    services. ekarihub (the Hub) is a product of EKABEL LIMITED, a company registered in Kenya under
                    Registration Number CPR/2015/81281 (the Company).
                </p>
                <p>
                    Protecting your privacy is essential to us. This Privacy Policy explains how we collect, use, share,
                    and protect your personal data and applies to all users of ekarihub, including buyers, sellers,
                    logistics providers, input suppliers, and any other stakeholders using the Hub. It governs the
                    collection, use, storage, and transfer of personal data provided through our website and services in
                    compliance with the Data Protection Act, 2019 of Kenya.
                </p>
                <p>
                    By using the Hub, you agree to this Privacy Policy. If you do not agree, please refrain from using
                    the Hub.
                </p>
            </div>
        ),
    },
    {
        id: "definitions",
        title: "2. Definitions",
        body: (
            <div className="space-y-2">
                <p>
                    Business Purpose refers to the discussions, planning, design, and development of ekarihub, including
                    all related business strategies, market analysis, and technological implementation.
                </p>
                <p>
                    Data Controller means Ekabel Limited, the entity that determines how and why personal data is
                    processed.
                </p>
                <p>
                    Data Processor means Ekabel Limited, the entity that processes data on behalf of the Data Controller.
                </p>
                <p>
                    Personal Data means any information that can identify an individual, such as names, contact
                    information, and trade details.
                </p>
                <p>
                    Users means individuals or entities using ekarihub for trading goods and services.
                </p>
            </div>
        ),
    },
    {
        id: "collect",
        title: "3. What we collect",
        body: (
            <div className="space-y-2">
                <p>We may collect the following data when you use the Hub:</p>
                <p>
                    Personal Identification Information such as names, phone numbers, email addresses, national
                    identification details (ID/passport) and user account credentials, including usernames and passwords.
                </p>
                <p>
                    Transaction Details which will include purchase history, product descriptions, payment details and
                    delivery information.
                </p>
                <p>
                    Technical Information including IP address, device information, browser type, operating system, and
                    usage data collected through cookies, analytics, and user feedback and similar technologies.
                </p>
                <p>
                    Third-Party Data which will include data from third-party sources or integrations, such as payment
                    service providers, logistics partners, and external databases.
                </p>
            </div>
        ),
    },
    {
        id: "legal-basis",
        title: "4. Legal Basis for Data Processing",
        body: (
            <div className="space-y-2">
                <p>
                    We process your personal data based on the following legal grounds under the Data Protection Act:
                </p>
                <p>Consent: When you have given us explicit consent for data processing.</p>
                <p>Contract Performance: Data processing is necessary for the performance of a contract with you.</p>
                <p>
                    Legal Obligation: When we are required to comply with a legal obligation such as tax or anti-money
                    laundering laws.
                </p>
                <p>
                    Legitimate Interest: When processing is necessary for the legitimate interests of the Hub such as
                    analyzing platform activity and improve services, provided it does not override your rights.
                </p>
                <p>
                    Public Interest such as data sharing with government authorities for public safety concerns or
                    exercising official authority.
                </p>
            </div>
        ),
    },
    {
        id: "how-collect",
        title: "5. How We Collect Your Data",
        body: (
            <div className="space-y-2">
                <p>When you register or create an account.</p>
                <p>When you use the Hub to list, buy, or sell goods and services.</p>
                <p>Through automated means such as cookies and other tracking technologies.</p>
            </div>
        ),
    },
    {
        id: "use",
        title: "6. How We Use Your Information",
        body: (
            <div className="space-y-2">
                <p>Your personal data may be used for the following purposes:</p>
                <p>
                    To Provide Services, facilitate transactions, manage user accounts, and deliver products/services.
                </p>
                <p>
                    Communication: To notify you of updates, respond to inquiries, and send promotional content (with your
                    consent).
                </p>
                <p>Security: Detect and prevent fraud, abuse, or unauthorized activities on the platform.</p>
                <p>
                    Compliance: Fulfill legal and regulatory requirements, including tax and financial reporting
                    obligations.
                </p>
                <p>Analytics: Conduct market research and analyze user behavior to improve our services.</p>
                <p>Complying with legal and regulatory obligations.</p>
            </div>
        ),
    },
    {
        id: "sharing",
        title: "7. Data Sharing and Disclosure",
        body: (
            <div className="space-y-2">
                <p>We may share your personal data in the following scenarios:</p>
                <p>
                    With Service Providers: We may share your data with third-party service providers (e.g., payment
                    processors, logistics partners) and other essential service providers who assist in delivering our
                    services.
                </p>
                <p>
                    With Affiliates: Data may be shared with EKABEL LIMITED’s affiliates for the Business Purpose of the
                    Hub.
                </p>
                <p>
                    With Regulatory Authorities for Legal Compliance: We may disclose your data if required by law, court
                    order, or government authority.
                </p>
                <p>
                    Business Transfers: In the event of a merger, acquisition, or sale of assets, your data may be
                    transferred as part of the transaction.
                </p>
                <p>We do not sell your personal data to third parties.</p>
            </div>
        ),
    },
    {
        id: "transfers",
        title: "8. International Data Transfers",
        body: (
            <p>
                If your data is transferred outside Kenya, we will ensure that the receiving entity provides an adequate
                level of data protection in compliance with the Data Protection Act, 2019.
            </p>
        ),
    },
    {
        id: "storage",
        title: "9. Data Storage and Retention",
        body: (
            <div className="space-y-3">
                <p>
                    ekarihub utilizes third-party cloud services to store and manage User data. We do not store data on
                    servers managed by Ekabel Limited. Instead, User data is securely stored in cloud infrastructure
                    provided by reputable cloud service providers, who are compliant with international data protection
                    standards.
                </p>
                <p>
                    Our cloud service providers implement appropriate security measures to protect your data, including
                    encryption, access control, and regular security assessments. However, please note that while we strive
                    to protect your data, no method of electronic storage or transmission is completely secure.
                </p>
                <p>
                    Your data may be stored on servers located in different countries, depending on the cloud service
                    provider&apos;s infrastructure. By using the Hub, you consent to the transfer of your data to these servers,
                    which may be outside Kenya, in compliance with the relevant data protection laws.
                </p>
                <p>
                    We retain your personal data only for as long as necessary to fulfill the purposes for which it was
                    collected, or as required by law. Once your data is no longer needed, it will be securely deleted or
                    anonymized.
                </p>
            </div>
        ),
    },
    {
        id: "security",
        title: "10. Data Security",
        body: (
            <p>
                EKABEL LIMITED implements industry-standard security measures, including encryption, firewalls, and
                secure access protocols, to protect your data from unauthorized access, breaches, misuse loss, or
                alteration. However, no method of transmission over the internet is entirely secure, and we cannot
                guarantee absolute security.
            </p>
        ),
    },
    {
        id: "identity-verification",
        title: "11. Identity Verification & Face Data",
        body: (
            <div className="space-y-3">
                <p>
                    To help prevent fraud, impersonation, scams, and misuse of the platform,
                    ekarihub may request identity verification documents such as a selfie
                    photo and government-issued identification.
                </p>

                <p>
                    This information is used solely for:
                </p>

                <ul className="list-disc pl-6 space-y-1">
                    <li>Account verification</li>
                    <li>Fraud prevention</li>
                    <li>Safety and trust purposes</li>
                </ul>

                <p>
                    Verification data is stored securely and is not sold or shared with
                    advertisers or third parties for marketing purposes.
                </p>

                <p>
                    Access to verification data is restricted to authorized internal
                    reviewers only.
                </p>

                <p>
                    Users may request account deletion and removal of associated
                    verification data, subject to applicable legal, fraud prevention,
                    and compliance obligations.
                </p>
            </div>
        ),
    },
    {
        id: "rights",
        title: "12. Your Data Rights",
        body: (
            <div className="space-y-2">
                <p>As a user, you have the following rights under the Kenya Data Protection Act, 2019:</p>
                <p>Right to Access: You can request a copy of the personal data we hold about you.</p>
                <p>Right to Correction: You can request that we correct any inaccurate or incomplete data.</p>
                <p>Right to Erasure: You can request that we delete your personal data, subject to legal obligations.</p>
                <p>Right to Restrict Processing: You can request that we limit the processing of your data.</p>
                <p>
                    Right to Data Portability: You can request a copy of your data in a structured, commonly used format.
                </p>
                <p>
                    Right to Object: You can object to the processing of your data for certain purposes, such as direct
                    marketing.
                </p>
                <p>
                    Right to Withdraw Consent: If you have given consent for data processing, you can withdraw it at any
                    time.
                </p>
                <p>To exercise these rights, please contact us using the details provided in Section 14.</p>
            </div>
        ),
    },
    {
        id: "cookies",
        title: "13. Use of Cookies and Tracking Technologies",
        body: (
            <p>
                ekarihub uses cookies and similar tracking technologies to improve user experience, gather analytics,
                and support our marketing efforts. Cookies collect technical information such as browsing behavior and
                preferences. By using the platform, you consent to the use of cookies. You can manage your cookie
                preferences through your browser settings, , but disabling cookies may affect certain features of the
                platform.
            </p>
        ),
    },
    {
        id: "changes",
        title: "14. Changes to This Privacy Policy",
        body: (
            <p>
                This Privacy Policy may be updated periodically to reflect changes in the Hub. We will notify you of any
                material changes by posting the updated policy on our website and updating the "Effective Date" above.
            </p>
        ),
    },
    {
        id: "contact",
        title: "15. Contact Information",
        body: (
            <div className="space-y-2">
                <p>
                    If you have questions about this Privacy Policy, or if you would like to exercise your data rights,
                    please contact us at:
                </p>
                <p>Data Controller and Processor:</p>
                <p>
                    EKABEL LIMITED
                    <br />
                    P.O. Box 10812-00100, Nairobi.
                    <br />
                    Email: legal@ekabell.com
                </p>
            </div>
        ),
    },
    {
        id: "liability",
        title: "16. Liability for Data Management",
        body: (
            <p>
                EKABEL LIMITED is ultimately responsible for compliance with data protection laws and for ensuring the
                lawful basis for processing user data.
            </p>
        ),
    },
];

export default function PrivacyPolicyPage() {
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
                FULL-WIDTH PRIVACY HERO
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
                <div className="pointer-events-none absolute -bottom-24 left-[34%] h-64 w-64 rounded-full bg-[#F39A22]/[0.08]" />

                <div className="relative mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-7 md:py-14 lg:px-8">
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
                        className="max-w-[820px]"
                    >
                        <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/70">
                                <IoShieldCheckmarkOutline
                                    size={12}
                                    className="text-[#F39A22]"
                                />
                                Privacy
                            </span>

                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/70">
                                <IoLockClosedOutline
                                    size={12}
                                    className="text-[#F39A22]"
                                />
                                Data protection
                            </span>
                        </div>

                        <div className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-[#F39A22]">
                            ekarihub legal
                        </div>

                        <h1 className="mt-1 max-w-4xl text-[32px] font-black leading-[1.04] tracking-[-0.045em] sm:text-[40px] lg:text-[50px]">
                            Privacy Policy
                        </h1>

                        <p className="mt-4 max-w-3xl text-[11px] font-medium leading-5 text-white/60 sm:text-[12px] md:leading-6">
                            This policy explains how ekarihub collects, uses, stores, shares and protects personal information when you use the platform.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[9px] font-semibold text-white/40">
                            <span>Effective: 15 November 2024</span>
                            <span>Updated: 30 November 2024</span>
                        </div>

                        <div className="mt-6 flex flex-wrap gap-2">
                            <a
                                href="#introduction"
                                className="inline-flex h-10 items-center gap-2 rounded-[13px] bg-[#F39A22] px-4 text-[9px] font-black text-[#173C2E] transition hover:brightness-105"
                            >
                                Read the policy
                                <IoArrowForwardOutline size={13} />
                            </a>

                            <Link
                                href="/terms"
                                className="inline-flex h-10 items-center gap-2 rounded-[13px] border border-white/12 bg-white/[0.06] px-4 text-[9px] font-black text-white/80 transition hover:bg-white/[0.11]"
                            >
                                Terms & conditions
                                <IoArrowForwardOutline size={13} />
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* =====================================================
                POLICY CONTENT
            ===================================================== */}
            <section className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 md:py-8 lg:px-8">
                <div className="grid min-w-0 gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:gap-8">
                    {/* LEFT NAV */}
                    <aside className="min-w-0 lg:sticky lg:top-5 lg:self-start">
                        <div className="overflow-hidden rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
                            <div className="border-b border-[#E5E0D6] px-4 py-3.5">
                                <div className="text-[8px] font-black uppercase tracking-[0.11em] text-[#F39A22]">
                                    In this policy
                                </div>

                                <h2 className="mt-1 text-[12px] font-black text-slate-800">
                                    Contents
                                </h2>
                            </div>

                            <nav className="max-h-[72vh] overflow-y-auto overscroll-contain p-2">
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
                            <div className="flex items-start gap-2.5">
                                <IoLockClosedOutline
                                    size={15}
                                    className="mt-0.5 shrink-0 text-[#173C2E]"
                                />

                                <div>
                                    <div className="text-[9px] font-black text-slate-700">
                                        Your privacy matters
                                    </div>

                                    <p className="mt-1 text-[8px] font-medium leading-4 text-slate-400">
                                        This policy explains how your data is handled and the rights available to you.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* MAIN POLICY */}
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

                                            <div className="mt-3 text-[10px] font-medium leading-5 text-slate-600 sm:text-[11px] sm:leading-6 [&_a]:font-black [&_a]:text-[#173C2E] [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-black [&_ul]:space-y-1.5">
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
                            className="mt-5 rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-5 sm:p-6"
                        >
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div className="max-w-2xl">
                                    <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
                                        Privacy controls
                                    </div>

                                    <h3 className="mt-1 text-[17px] font-black tracking-[-0.03em] text-slate-900">
                                        Need help with your data?
                                    </h3>

                                    <p className="mt-1 text-[9px] font-medium leading-4 text-slate-400">
                                        Review account deletion options or contact us about your privacy rights.
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <Link
                                        href="/delete-account"
                                        className="inline-flex h-10 items-center rounded-[12px] bg-[#173C2E] px-4 text-[9px] font-black text-white transition hover:bg-[#214C3A]"
                                    >
                                        Delete account
                                    </Link>

                                    <a
                                        href="mailto:legal@ekabell.com"
                                        className="inline-flex h-10 items-center rounded-[12px] border border-[#DDD8CC] bg-white px-4 text-[9px] font-black text-[#173C2E] transition hover:bg-[#EEF3EE]"
                                    >
                                        Contact legal
                                    </a>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            variants={fadeUp}
                            initial="hidden"
                            whileInView="show"
                            viewport={{
                                once: true,
                                amount: 0.15,
                            }}
                            className="mt-4 rounded-[18px] border border-[#DDD8CC] bg-[#173C2E] p-5 text-white sm:p-6"
                        >
                            <div className="flex items-start gap-3">
                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-white/10 text-[#F39A22]">
                                    <IoSparklesOutline size={18} />
                                </span>

                                <div className="min-w-0">
                                    <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
                                        Transparency
                                    </div>

                                    <h3 className="mt-1 text-[16px] font-black tracking-[-0.02em]">
                                        Understand how your information is used.
                                    </h3>

                                    <p className="mt-1 max-w-2xl text-[9px] font-medium leading-4 text-white/50">
                                        We aim to explain our data practices clearly and give users meaningful choices over their information.
                                    </p>
                                </div>
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