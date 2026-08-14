"use client";

import * as React from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  IoArrowForwardOutline,
  IoChevronUpOutline,
  IoDocumentTextOutline,
  IoFlagOutline,
  IoLockClosedOutline,
  IoMailOutline,
  IoPeopleOutline,
  IoShieldCheckmarkOutline,
  IoWarningOutline,
} from "react-icons/io5";

import { Topbar } from "../components/Topbar";
import { Footer } from "../components/Footer";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.24,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const NAV_ITEMS = [
  { href: "#commitment", label: "Our commitment" },
  { href: "#prohibited", label: "Prohibited content" },
  { href: "#reporting", label: "Reporting concerns" },
  { href: "#moderation", label: "Moderation and enforcement" },
  { href: "#authorities", label: "Cooperation with authorities" },
  { href: "#contact", label: "Contact information" },
] as const;

const PROHIBITED_ITEMS = [
  "Any child sexual abuse material or exploitative imagery",
  "Content that sexualizes, exploits, or endangers minors",
  "Grooming, coercion, solicitation, or predatory communication involving minors",
  "Human trafficking, child abuse, or facilitation of abuse",
  "Attempts to use the platform to share, request, promote, or distribute abusive material",
  "Any behavior that violates applicable child safety laws or our community standards",
];

export default function ChildSafetyClientPage() {
  const [showTop, setShowTop] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState<string>("#commitment");

  React.useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 300);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    const ids = NAV_ITEMS.map((item) => item.href.replace("#", ""));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveSection(`#${visible[0].target.id}`);
      },
      {
        rootMargin: "-18% 0px -62% 0px",
        threshold: [0.1, 0.25, 0.5],
      }
    );

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <main
      className="min-h-[100svh] w-full max-w-full overflow-x-clip bg-[#F8F7F2] touch-pan-y"
      style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
    >
      <Topbar />

      <section className="relative overflow-hidden border-b border-[#DDD8CC] bg-[#173C2E] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.75) 18px 19px)",
          }}
        />
        <div className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full bg-white/[0.035]" />
        <div className="pointer-events-none absolute -bottom-28 left-[32%] h-72 w-72 rounded-full bg-[#c69258]/[0.08]" />

        <div className="relative mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-7 md:py-14 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="max-w-[840px]"
          >
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/70">
                <IoShieldCheckmarkOutline size={12} className="text-[#c69258]" />
                Safety & community
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/70">
                <IoPeopleOutline size={12} className="text-[#c69258]" />
                Child protection
              </span>
            </div>

            <div className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-[#c69258]">
              ekarihub safety standards
            </div>

            <h1 className="mt-1 max-w-4xl text-[32px] font-black leading-[1.04] tracking-[-0.045em] sm:text-[40px] lg:text-[50px]">
              Child Safety Standards
            </h1>

            <p className="mt-4 max-w-3xl text-[11px] font-medium leading-5 text-white/60 sm:text-[12px] md:leading-6">
              ekarihub is committed to maintaining a safe environment for all users. We strictly prohibit child sexual abuse and exploitation, abusive behavior toward minors, and any content or activity that endangers children.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <a href="#commitment" className="inline-flex h-10 items-center gap-2 rounded-[13px] bg-[#c69258] px-4 text-[9px] font-black text-[#173C2E] transition hover:brightness-105">
                Read our standards
                <IoArrowForwardOutline size={13} />
              </a>
              <a href="mailto:support@ekarihub.com" className="inline-flex h-10 items-center gap-2 rounded-[13px] border border-white/12 bg-white/[0.06] px-4 text-[9px] font-black text-white/80 transition hover:bg-white/[0.11]">
                <IoMailOutline size={13} />
                Report a concern
              </a>
            </div>

            <div className="mt-7 grid max-w-2xl gap-2 sm:grid-cols-3">
              <HeroStat icon={<IoShieldCheckmarkOutline size={15} />} title="Zero tolerance" text="For abuse and exploitation" />
              <HeroStat icon={<IoFlagOutline size={15} />} title="Prompt review" text="Safety reports prioritized" />
              <HeroStat icon={<IoLockClosedOutline size={15} />} title="Enforcement" text="Removal, restriction and bans" />
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 md:py-8 lg:px-8">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:gap-8">
          <aside className="min-w-0 lg:sticky lg:top-5 lg:self-start">
            <div className="overflow-hidden rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
              <div className="border-b border-[#E5E0D6] px-4 py-3.5">
                <div className="text-[8px] font-black uppercase tracking-[0.11em] text-[#c69258]">On this page</div>
                <h2 className="mt-1 text-[12px] font-black text-slate-800">Child safety</h2>
              </div>
              <nav className="p-2">
                {NAV_ITEMS.map((item, index) => {
                  const active = activeSection === item.href;
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      className={[
                        "group flex items-center gap-3 rounded-[13px] px-3 py-2.5",
                        "transition-all duration-200",
                        active
                          ? "bg-[#E8ECE8] text-[#173C2E]"
                          : "text-slate-500 hover:bg-[#F3F1EB] hover:text-[#173C2E]",
                      ].join(" ")}
                    >
                      <span className={[
                        "grid h-7 w-7 shrink-0 place-items-center rounded-[9px] text-[8px] font-black",
                        active ? "bg-[#173C2E] text-white" : "bg-white text-slate-400",
                      ].join(" ")}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1 text-[9px] font-black leading-4">{item.label}</span>
                    </a>
                  );
                })}
              </nav>
            </div>

            <div className="mt-4 rounded-[16px] border border-[#F3D5AD] bg-[#FFF7EB] p-3.5">
              <div className="flex items-start gap-2.5">
                <IoWarningOutline size={15} className="mt-0.5 shrink-0 text-[#c69258]" />
                <div>
                  <div className="text-[9px] font-black text-slate-700">Urgent safety concern?</div>
                  <p className="mt-1 text-[8px] font-medium leading-4 text-slate-500">
                    Report it through in-app tools or contact our support team directly.
                  </p>
                  <a href="mailto:support@ekarihub.com" className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-[11px] bg-[#173C2E] px-3 text-[8px] font-black text-white transition hover:bg-[#214C3A]">
                    Contact support
                    <IoArrowForwardOutline size={11} />
                  </a>
                </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0 space-y-5">
            <motion.section id="commitment" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} className="scroll-mt-6 rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] p-5 shadow-[0_8px_24px_rgba(15,23,42,0.035)] sm:p-6">
              <SectionHeader number="01" eyebrow="Our standards" title="Our commitment" icon={<IoShieldCheckmarkOutline size={18} />} />
              <div className="mt-5 space-y-3 text-[10px] font-medium leading-5 text-slate-600 sm:text-[11px] sm:leading-6">
                <p>ekarihub has zero tolerance for child sexual abuse and exploitation (CSAE), child sexual abuse material (CSAM), grooming, trafficking, or any form of exploitative, abusive, or inappropriate behavior involving minors.</p>
                <p>We are committed to protecting children, maintaining a safe digital environment, and taking prompt action against users or content that violate these standards.</p>
              </div>
            </motion.section>

            <motion.section id="prohibited" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} className="scroll-mt-6 rounded-[20px] border border-[#DDD8CC] bg-[#F3F1EB]/70 p-5 sm:p-6">
              <SectionHeader number="02" eyebrow="Not permitted" title="Prohibited content and behavior" icon={<IoWarningOutline size={18} />} />
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {PROHIBITED_ITEMS.map((item, index) => (
                  <div key={item} className="rounded-[15px] border border-[#DDD8CC] bg-[#FBFAF6] p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] bg-rose-50 text-[8px] font-black text-rose-600">{String(index + 1).padStart(2, "0")}</span>
                      <p className="text-[9px] font-medium leading-4 text-slate-500 sm:text-[10px]">{item}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>

            <motion.section id="reporting" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} className="scroll-mt-6 rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] p-5 shadow-[0_8px_24px_rgba(15,23,42,0.035)] sm:p-6">
              <SectionHeader number="03" eyebrow="Reporting" title="Reporting child safety concerns" icon={<IoFlagOutline size={18} />} />
              <div className="mt-5 rounded-[15px] border border-[#F3D5AD] bg-[#FFF7EB] p-4">
                <p className="text-[10px] font-semibold leading-5 text-slate-600 sm:text-[11px]">Users can report content, accounts, or behavior that may violate child safety standards through the in-app reporting tools or by contacting our support team directly.</p>
              </div>
              <div className="mt-4 space-y-3 text-[10px] font-medium leading-5 text-slate-600 sm:text-[11px] sm:leading-6">
                <p>Reports may include posts, marketplace listings, profiles, messages, comments, images, videos, or any other content that appears unsafe or inappropriate.</p>
                <p>We review reports promptly and prioritize matters involving the safety of children.</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/support" className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-[#173C2E] px-4 text-[9px] font-black text-white transition hover:bg-[#214C3A]">Report through support <IoArrowForwardOutline size={13} /></Link>
                <a href="mailto:support@ekarihub.com" className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[#DDD8CC] bg-white px-4 text-[9px] font-black text-[#173C2E] transition hover:bg-[#F3F1EB]"><IoMailOutline size={13} />Email support</a>
              </div>
            </motion.section>

            <motion.section id="moderation" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} className="scroll-mt-6 rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] p-5 shadow-[0_8px_24px_rgba(15,23,42,0.035)] sm:p-6">
              <SectionHeader number="04" eyebrow="Enforcement" title="Moderation and enforcement" icon={<IoLockClosedOutline size={18} />} />
              <div className="mt-5 space-y-3 text-[10px] font-medium leading-5 text-slate-600 sm:text-[11px] sm:leading-6">
                <p>ekarihub may investigate reports, remove violating content, restrict visibility, suspend accounts, or permanently ban users who breach these standards.</p>
                <p>We may use a combination of user reports, internal moderation, and platform controls to identify and respond to unsafe content or conduct.</p>
                <p>Where appropriate, we preserve relevant information for safety, legal, and compliance purposes.</p>
              </div>
            </motion.section>

            <motion.section id="authorities" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} className="scroll-mt-6 rounded-[20px] border border-[#DDD8CC] bg-[#F3F1EB]/70 p-5 sm:p-6">
              <SectionHeader number="05" eyebrow="Compliance" title="Cooperation with authorities" icon={<IoDocumentTextOutline size={18} />} />
              <div className="mt-5 space-y-3 text-[10px] font-medium leading-5 text-slate-600 sm:text-[11px] sm:leading-6">
                <p>ekarihub complies with applicable child safety laws and, where required, reports relevant violations to law enforcement, regulators, or authorized child protection agencies.</p>
                <p>We may cooperate with lawful requests and investigations relating to child exploitation, abuse, or other serious safety risks.</p>
              </div>
            </motion.section>

            <motion.section id="contact" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} className="scroll-mt-6 rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] p-5 shadow-[0_8px_24px_rgba(15,23,42,0.035)] sm:p-6">
              <SectionHeader number="06" eyebrow="Contact" title="Contact information" icon={<IoMailOutline size={18} />} />
              <p className="mt-5 text-[10px] font-medium leading-5 text-slate-600 sm:text-[11px] sm:leading-6">For child safety concerns, reporting questions, or compliance matters, contact us through the details below.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <a href="mailto:support@ekarihub.com" className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-[#173C2E] px-4 text-[9px] font-black text-white transition hover:bg-[#214C3A]"><IoMailOutline size={13} />support@ekarihub.com</a>
                <Link href="/terms" className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[#DDD8CC] bg-white px-4 text-[9px] font-black text-[#173C2E] transition hover:bg-[#F3F1EB]">View Terms <IoArrowForwardOutline size={13} /></Link>
                <Link href="/privacy" className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[#DDD8CC] bg-white px-4 text-[9px] font-black text-[#173C2E] transition hover:bg-[#F3F1EB]">View Privacy Policy <IoArrowForwardOutline size={13} /></Link>
              </div>
            </motion.section>

            <motion.section variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} className="rounded-[20px] bg-[#173C2E] p-5 text-white shadow-[0_10px_28px_rgba(23,60,46,0.12)] sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-2xl">
                  <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#c69258]">Safety first</div>
                  <h3 className="mt-1 text-[17px] font-black tracking-[-0.03em]">See something unsafe? Report it.</h3>
                  <p className="mt-1 text-[9px] font-medium leading-4 text-white/50">Reports involving children are treated as a priority and reviewed promptly.</p>
                </div>
                <Link href="/support" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[12px] bg-[#c69258] px-4 text-[9px] font-black text-[#173C2E] transition hover:brightness-105">Contact support <IoArrowForwardOutline size={13} /></Link>
              </div>
            </motion.section>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={[
          "fixed bottom-5 right-4 z-40 inline-flex h-10 items-center gap-1.5 rounded-full",
          "border border-[#DDD8CC] bg-[#FBFAF6] px-3.5 text-[9px] font-black text-[#173C2E]",
          "shadow-[0_10px_28px_rgba(15,23,42,0.10)] transition-all duration-200",
          showTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
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

function SectionHeader({
  number,
  eyebrow,
  title,
  icon,
}: {
  number: string;
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[#E8ECE8] text-[#173C2E]">{icon}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-black uppercase tracking-[0.1em] text-[#c69258]">{number}</span>
          <span className="text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">{eyebrow}</span>
        </div>
        <h2 className="mt-1 text-[18px] font-black tracking-[-0.03em] text-slate-900 sm:text-[20px]">{title}</h2>
      </div>
    </div>
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
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-white/10 text-[#c69258]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[9px] font-black text-white">{title}</span>
        <span className="mt-0.5 block text-[7px] font-medium text-white/40">{text}</span>
      </span>
    </div>
  );
}