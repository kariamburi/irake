"use client";

import * as React from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { Topbar } from "../components/Topbar";
import { Footer } from "../components/Footer";

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  hair: "#E5E7EB",
  text: "#0F172A",
  dim: "#6B7280",
  bg: "#FFFFFF",
  soft: "#F8F9FB",
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1] as unknown as any,
    },
  },
};

export default function ChildSafetyClientPage() {
  const [showTop, setShowTop] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 300);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <Topbar />

      {/* Hero */}
      <section
        className="relative overflow-hidden border-b"
        style={{ borderColor: EKARI.hair }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(199,146,87,0.12),transparent_28%),radial-gradient(circle_at_top_left,rgba(35,63,57,0.08),transparent_30%)]" />
        <div className="relative mx-auto max-w-6xl px-5 py-12 md:py-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="max-w-3xl"
          >
            <div
              className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]"
              style={{
                borderColor: "#E8D7C3",
                color: EKARI.gold,
                background: "#FFF9F3",
              }}
            >
              Safety & Community
            </div>

            <h1
              className="mt-4 text-3xl font-black tracking-tight md:text-5xl"
              style={{ color: EKARI.forest }}
            >
              Child Safety Standards
            </h1>

            <p
              className="mt-4 max-w-2xl text-base leading-7 md:text-lg"
              style={{ color: EKARI.dim }}
            >
              ekarihub is committed to maintaining a safe environment for all
              users. We strictly prohibit child sexual abuse and exploitation,
              abusive behavior toward minors, and any content or activity that
              endangers children.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Body */}
      <section className="mx-auto max-w-6xl px-5 py-8 md:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div
              className="overflow-hidden rounded-2xl border"
              style={{ borderColor: EKARI.hair }}
            >
              <div
                className="border-b px-4 py-3"
                style={{ borderColor: EKARI.hair, background: "#FCFCFD" }}
              >
                <h2
                  className="text-sm font-extrabold"
                  style={{ color: EKARI.text }}
                >
                  On this page
                </h2>
              </div>

              <div className="p-2">
                {[
                  { href: "#commitment", label: "Our commitment" },
                  { href: "#prohibited", label: "Prohibited content" },
                  { href: "#reporting", label: "Reporting concerns" },
                  { href: "#moderation", label: "Moderation and enforcement" },
                  { href: "#authorities", label: "Cooperation with authorities" },
                  { href: "#contact", label: "Contact information" },
                ].map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="block rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-gray-50"
                    style={{ color: EKARI.text }}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          </aside>

          {/* Main content */}
          <div className="space-y-6">
            <motion.section
              id="commitment"
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              className="rounded-3xl border p-6 md:p-8"
              style={{ borderColor: EKARI.hair, background: "#fff" }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-black"
                  style={{ background: "#F6EFE7", color: EKARI.gold }}
                >
                  1
                </div>
                <div>
                  <h2
                    className="text-xl font-black md:text-2xl"
                    style={{ color: EKARI.text }}
                  >
                    Our commitment
                  </h2>
                  <div className="mt-3 space-y-3 text-[15px] leading-7 text-gray-700">
                    <p>
                      ekarihub has zero tolerance for child sexual abuse and
                      exploitation (CSAE), child sexual abuse material (CSAM),
                      grooming, trafficking, or any form of exploitative,
                      abusive, or inappropriate behavior involving minors.
                    </p>
                    <p>
                      We are committed to protecting children, maintaining a safe
                      digital environment, and taking prompt action against users
                      or content that violate these standards.
                    </p>
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.section
              id="prohibited"
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              className="rounded-3xl border p-6 md:p-8"
              style={{ borderColor: EKARI.hair, background: EKARI.soft }}
            >
              <h2
                className="text-xl font-black md:text-2xl"
                style={{ color: EKARI.text }}
              >
                Prohibited content and behavior
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {[
                  "Any child sexual abuse material or exploitative imagery",
                  "Content that sexualizes, exploits, or endangers minors",
                  "Grooming, coercion, solicitation, or predatory communication involving minors",
                  "Human trafficking, child abuse, or facilitation of abuse",
                  "Attempts to use the platform to share, request, promote, or distribute abusive material",
                  "Any behavior that violates applicable child safety laws or our community standards",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border bg-white p-4"
                    style={{ borderColor: EKARI.hair }}
                  >
                    <p className="text-sm leading-6 text-gray-700">{item}</p>
                  </div>
                ))}
              </div>
            </motion.section>

            <motion.section
              id="reporting"
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              className="rounded-3xl border p-6 md:p-8"
              style={{ borderColor: EKARI.hair, background: "#fff" }}
            >
              <h2
                className="text-xl font-black md:text-2xl"
                style={{ color: EKARI.text }}
              >
                Reporting child safety concerns
              </h2>

              <div
                className="mt-4 rounded-2xl border p-5"
                style={{
                  borderColor: "#EADBC9",
                  background: "#FFF9F4",
                }}
              >
                <p className="text-base leading-7" style={{ color: EKARI.text }}>
                  Users can report content, accounts, or behavior that may
                  violate child safety standards through the in-app reporting
                  tools or by contacting our support team directly.
                </p>
              </div>

              <div className="mt-4 space-y-3 text-[15px] leading-7 text-gray-700">
                <p>
                  Reports may include posts, marketplace listings, profiles,
                  messages, comments, images, videos, or any other content that
                  appears unsafe or inappropriate.
                </p>
                <p>
                  We review reports promptly and prioritize matters involving the
                  safety of children.
                </p>
              </div>
            </motion.section>

            <motion.section
              id="moderation"
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              className="rounded-3xl border p-6 md:p-8"
              style={{ borderColor: EKARI.hair, background: "#fff" }}
            >
              <h2
                className="text-xl font-black md:text-2xl"
                style={{ color: EKARI.text }}
              >
                Moderation and enforcement
              </h2>

              <div className="mt-3 space-y-3 text-[15px] leading-7 text-gray-700">
                <p>
                  ekarihub may investigate reports, remove violating content,
                  restrict visibility, suspend accounts, or permanently ban users
                  who breach these standards.
                </p>
                <p>
                  We may use a combination of user reports, internal moderation,
                  and platform controls to identify and respond to unsafe
                  content or conduct.
                </p>
                <p>
                  Where appropriate, we preserve relevant information for safety,
                  legal, and compliance purposes.
                </p>
              </div>
            </motion.section>

            <motion.section
              id="authorities"
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              className="rounded-3xl border p-6 md:p-8"
              style={{ borderColor: EKARI.hair, background: EKARI.soft }}
            >
              <h2
                className="text-xl font-black md:text-2xl"
                style={{ color: EKARI.text }}
              >
                Cooperation with authorities
              </h2>

              <div className="mt-3 space-y-3 text-[15px] leading-7 text-gray-700">
                <p>
                  ekarihub complies with applicable child safety laws and, where
                  required, reports relevant violations to law enforcement,
                  regulators, or authorized child protection agencies.
                </p>
                <p>
                  We may cooperate with lawful requests and investigations
                  relating to child exploitation, abuse, or other serious safety
                  risks.
                </p>
              </div>
            </motion.section>

            <motion.section
              id="contact"
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              className="rounded-3xl border p-6 md:p-8"
              style={{ borderColor: EKARI.hair, background: "#fff" }}
            >
              <h2
                className="text-xl font-black md:text-2xl"
                style={{ color: EKARI.text }}
              >
                Contact information
              </h2>

              <p className="mt-3 text-[15px] leading-7 text-gray-700">
                For child safety concerns, reporting questions, or compliance
                matters, contact us through the details below.
              </p>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <a
                  href="mailto:support@ekarihub.com"
                  className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:opacity-95"
                  style={{ background: EKARI.forest }}
                >
                  support@ekarihub.com
                </a>

                <Link
                  href="/terms"
                  className="inline-flex items-center justify-center rounded-2xl border px-5 py-3 text-sm font-extrabold transition hover:bg-gray-50"
                  style={{ borderColor: EKARI.hair, color: EKARI.text }}
                >
                  View Terms
                </Link>

                <Link
                  href="/privacy"
                  className="inline-flex items-center justify-center rounded-2xl border px-5 py-3 text-sm font-extrabold transition hover:bg-gray-50"
                  style={{ borderColor: EKARI.hair, color: EKARI.text }}
                >
                  View Privacy Policy
                </Link>
              </div>
            </motion.section>
          </div>
        </div>
      </section>

      {/* Back to top */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={[
          "fixed bottom-5 right-4 z-40 rounded-full border px-3 py-2 text-sm font-bold shadow-sm transition-opacity",
          showTop ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        style={{
          background: EKARI.bg,
          borderColor: EKARI.hair,
          color: EKARI.text,
        }}
        aria-label="Back to top"
      >
        ↑ Top
      </button>

      <Footer />
    </main>
  );
}