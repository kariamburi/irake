"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  IoArrowForwardOutline,
  IoCheckmarkCircleOutline,
  IoChevronUpOutline,
  IoHelpCircleOutline,
  IoLockClosedOutline,
  IoMailOutline,
  IoShieldCheckmarkOutline,
  IoTimeOutline,
  IoTrashOutline,
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
  { href: "#how-to-request", label: "How to request deletion" },
  { href: "#what-happens", label: "What happens next" },
  { href: "#timeline", label: "Deletion timeline" },
  { href: "#support", label: "Support contact" },
] as const;

export default function DeleteAccountClientPage() {
  const [showTop, setShowTop] = React.useState(false);
  const [activeSection, setActiveSection] =
    React.useState<string>("#how-to-request");

  React.useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 320);
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

        if (visible[0]) {
          setActiveSection(`#${visible[0].target.id}`);
        }
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
    <main className="w-full max-w-full overflow-x-clip bg-[#F8F7F2]">
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
        <div className="pointer-events-none absolute -bottom-24 left-[36%] h-64 w-64 rounded-full bg-[#c69258]/[0.08]" />

        <div className="relative mx-auto max-w-[1280px] px-5 py-10 sm:px-7 md:py-14 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="max-w-[760px]"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-white/65">
              <IoShieldCheckmarkOutline size={12} className="text-[#c69258]" />
              Account & privacy
            </div>

            <h1 className="mt-4 text-[30px] font-black leading-[1.04] tracking-[-0.045em] sm:text-[38px] md:text-[46px]">
              Delete your ekarihub account
            </h1>

            <p className="mt-4 max-w-[680px] text-[11px] font-medium leading-5 text-white/55 sm:text-[12px] md:leading-6">
              You can request permanent deletion of your ekarihub account and
              associated data by email or directly from your profile settings.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <a
                href="#how-to-request"
                className="inline-flex h-10 items-center gap-2 rounded-[13px] bg-[#c69258] px-4 text-[9px] font-black text-[#173C2E] transition hover:brightness-105"
              >
                How to delete
                <IoArrowForwardOutline size={13} />
              </a>

              <a
                href="mailto:support@ekarihub.com"
                className="inline-flex h-10 items-center gap-2 rounded-[13px] border border-white/12 bg-white/[0.06] px-4 text-[9px] font-black text-white/75 transition hover:bg-white/[0.11]"
              >
                <IoMailOutline size={13} />
                Contact support
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 md:py-8 lg:px-8">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[270px_minmax(0,1fr)] xl:gap-8">
          <aside className="min-w-0 lg:sticky lg:top-5 lg:self-start">
            <div className="overflow-hidden rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
              <div className="border-b border-[#E5E0D6] px-4 py-3.5">
                <div className="text-[8px] font-black uppercase tracking-[0.11em] text-[#c69258]">
                  In this guide
                </div>
                <h2 className="mt-1 text-[12px] font-black text-slate-800">
                  Account deletion
                </h2>
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
                      <span
                        className={[
                          "grid h-7 w-7 shrink-0 place-items-center rounded-[9px]",
                          "text-[8px] font-black",
                          active
                            ? "bg-[#173C2E] text-white"
                            : "bg-white text-slate-400",
                        ].join(" ")}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      <span className="min-w-0 flex-1 text-[9px] font-black">
                        {item.label}
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
                    Permanent action
                  </div>

                  <p className="mt-1 text-[8px] font-medium leading-4 text-slate-400">
                    Once deletion is completed, your account cannot be restored.
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0 space-y-5">
            <motion.section
              id="how-to-request"
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.15 }}
              className="scroll-mt-6 rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] p-5 shadow-[0_8px_24px_rgba(15,23,42,0.035)] sm:p-6"
            >
              <div className="flex items-start gap-3.5">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[#FFF2DF] text-[#c69258]">
                  <IoTrashOutline size={19} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[8px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                    Step 01
                  </div>

                  <h2 className="mt-1 text-[18px] font-black tracking-[-0.025em] text-slate-900 sm:text-[20px]">
                    How to request account deletion
                  </h2>

                  <div className="mt-4 space-y-3 text-[10px] font-medium leading-5 text-slate-500 sm:text-[11px]">
                    <p>
                      To request deletion of your ekarihub account and all
                      associated data, email us at{" "}
                      <a
                        href="mailto:support@ekarihub.com"
                        className="font-black text-[#173C2E] underline underline-offset-4"
                      >
                        support@ekarihub.com
                      </a>
                      .
                    </p>

                    <p>
                      You can also request deletion directly from ekarihub under{" "}
                      <span className="font-black text-slate-700">
                        Profile Edit settings
                      </span>{" "}
                      by selecting{" "}
                      <span className="font-black text-slate-700">
                        Delete account
                      </span>
                      .
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <a
                      href="mailto:support@ekarihub.com"
                      className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-[#173C2E] px-4 text-[9px] font-black text-white transition hover:bg-[#214C3A]"
                    >
                      <IoMailOutline size={13} />
                      Email support
                    </a>

                    <Link
                      href="/account/edit"
                      className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[#DDD8CC] bg-white px-4 text-[9px] font-black text-slate-600 transition hover:bg-[#F3F1EB] hover:text-[#173C2E]"
                    >
                      Open profile settings
                      <IoArrowForwardOutline size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.section
              id="what-happens"
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.15 }}
              className="scroll-mt-6 rounded-[20px] border border-[#DDD8CC] bg-[#F3F1EB]/75 p-5 sm:p-6"
            >
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[#E8ECE8] text-[#173C2E]">
                  <IoShieldCheckmarkOutline size={19} />
                </div>

                <div>
                  <div className="text-[8px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                    Step 02
                  </div>
                  <h2 className="mt-1 text-[18px] font-black tracking-[-0.025em] text-slate-900 sm:text-[20px]">
                    What happens after your request
                  </h2>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <ProcessCard
                  number="01"
                  title="Review"
                  description="We verify the deletion request to make sure it comes from the rightful account owner."
                />
                <ProcessCard
                  number="02"
                  title="Processing"
                  description="Your account and related personal data are queued for permanent removal from our systems."
                />
                <ProcessCard
                  number="03"
                  title="Completion"
                  description="Once deletion is complete, the account cannot be restored and access to its data is removed."
                />
              </div>
            </motion.section>

            <motion.section
              id="timeline"
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.15 }}
              className="scroll-mt-6 rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] p-5 shadow-[0_8px_24px_rgba(15,23,42,0.035)] sm:p-6"
            >
              <div className="flex items-start gap-3.5">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[#FFF2DF] text-[#c69258]">
                  <IoTimeOutline size={19} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[8px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                    Step 03
                  </div>

                  <h2 className="mt-1 text-[18px] font-black tracking-[-0.025em] text-slate-900 sm:text-[20px]">
                    Deletion timeline
                  </h2>

                  <div className="mt-4 rounded-[15px] border border-[#F3D5AD] bg-[#FFF7EB] p-4">
                    <div className="flex items-start gap-3">
                      <IoTimeOutline
                        size={17}
                        className="mt-0.5 shrink-0 text-[#c69258]"
                      />

                      <p className="text-[10px] font-semibold leading-5 text-slate-600 sm:text-[11px]">
                        Once your deletion request is received, your data will
                        be permanently deleted within{" "}
                        <span className="font-black text-[#173C2E]">
                          7 days
                        </span>
                        .
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-[10px] font-medium leading-5 text-slate-500 sm:text-[11px]">
                    Some limited information may be temporarily retained where
                    required for legal, fraud prevention, security, or
                    compliance purposes, after which it is removed according
                    to our internal retention procedures.
                  </p>
                </div>
              </div>
            </motion.section>

            <motion.section
              id="support"
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.15 }}
              className="scroll-mt-6 rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] p-5 shadow-[0_8px_24px_rgba(15,23,42,0.035)] sm:p-6"
            >
              <div className="flex items-start gap-3.5">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[#E8ECE8] text-[#173C2E]">
                  <IoHelpCircleOutline size={19} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[8px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                    Support
                  </div>

                  <h2 className="mt-1 text-[18px] font-black tracking-[-0.025em] text-slate-900 sm:text-[20px]">
                    Need help?
                  </h2>

                  <p className="mt-3 text-[10px] font-medium leading-5 text-slate-500 sm:text-[11px]">
                    If you cannot access your account or need help with the
                    deletion process, contact our support team.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <a
                      href="mailto:support@ekarihub.com"
                      className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-[#173C2E] px-4 text-[9px] font-black text-white transition hover:bg-[#214C3A]"
                    >
                      <IoMailOutline size={13} />
                      Email support
                    </a>

                    <Link
                      href="/privacy"
                      className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[#DDD8CC] bg-white px-4 text-[9px] font-black text-slate-600 transition hover:bg-[#F3F1EB] hover:text-[#173C2E]"
                    >
                      Privacy policy
                      <IoArrowForwardOutline size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            </motion.section>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={() =>
          window.scrollTo({
            top: 0,
            behavior: "smooth",
          })
        }
        className={[
          "fixed bottom-5 right-4 z-40",
          "inline-flex h-10 items-center gap-1.5 rounded-full",
          "border border-[#DDD8CC] bg-[#FBFAF6] px-3.5",
          "text-[9px] font-black text-[#173C2E]",
          "shadow-[0_10px_28px_rgba(15,23,42,0.10)]",
          "transition-all duration-200",
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

function ProcessCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[16px] border border-[#DDD8CC] bg-[#FBFAF6] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[8px] font-black uppercase tracking-[0.1em] text-[#c69258]">
          {number}
        </span>

        <IoCheckmarkCircleOutline
          size={15}
          className="text-[#173C2E]"
        />
      </div>

      <h3 className="mt-3 text-[10px] font-black text-slate-700">
        {title}
      </h3>

      <p className="mt-1.5 text-[9px] font-medium leading-4 text-slate-400">
        {description}
      </p>
    </div>
  );
}