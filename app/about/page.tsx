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

const EKARI = {
  forest: "#233F39",
  leaf: "#1F3A34",
  gold: "#C79257",
  sand: "#FFFFFF",
  text: "#1F2F2B",
  subtext: "#5C6B66",
  border: "#E5E7EB",
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
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium tracking-wide"
      style={{
        borderColor: "rgba(255,255,255,0.20)",
        background: "rgba(255,255,255,0.10)",
        color: "rgba(255,255,255,0.92)",
      }}
    >
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
    <div
      className="group rounded-3xl border bg-white/80 backdrop-blur-xl p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: "rgba(229,231,235,0.75)" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center"
          style={{
            // borderColor: "rgba(35,63,57,0.16)",
            // background:
            //   "linear-gradient(135deg, rgba(35,63,57,0.10), rgba(199,146,87,0.10))",
            color: EKARI.forest,
          }}
          aria-hidden
        >
          {icon}
        </div>

        <div className="min-w-0">
          <h4 className="font-semibold" style={{ color: EKARI.text }}>
            {title}
          </h4>
          <p className="mt-1 text-sm leading-6" style={{ color: EKARI.subtext }}>
            {desc}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatChip({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border bg-white/80 backdrop-blur-xl px-4 py-3 shadow-sm"
      style={{ borderColor: "rgba(229,231,235,0.75)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-2xl border"
          style={{
            borderColor: "rgba(35,63,57,0.16)",
            background:
              "linear-gradient(135deg, rgba(35,63,57,0.10), rgba(199,146,87,0.10))",
            color: EKARI.forest,
          }}
          aria-hidden
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: EKARI.subtext }}
          >
            {label}
          </div>
          <div
            className="text-sm font-extrabold leading-5"
            style={{ color: EKARI.text }}
          >
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
      <div className="text-[11px] font-semibold text-white/80 uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

export default function AboutPage() {
  const reduceMotion = useReducedMotion();

  // Right-side “serious” stats
  const stats = {
    verifiedProfiles: "Verified profiles • Trust layer",
    marketplace: "Marketplace listings • Trade",
    events: "Events & trainings • Learn",
    community: "Community discussions • Connect",
  };

  return (
    <main
      className="min-h-screen w-full px-4 py-8"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(35,63,57,0.14), transparent 50%), radial-gradient(circle at bottom right, rgba(199,146,87,0.18), #F3F4F6)",
      }}
    >
      <motion.div
        className="w-full max-w-6xl mx-auto"
        initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {/* Top header */}
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image
              src="/ekarihub-logo.png"
              alt="ekarihub"
              width={180}
              height={54}
              priority
              className="h-auto w-auto"
            />
          </Link>

          <div className="flex items-center gap-2">
            {/* ✅ Premium gold leadership button on desktop */}
            <Link
              href="/leadership"
              className="hidden md:inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition hover:shadow-md active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #C79257, #fbbf77)",
                color: "#111827",
              }}
            >
              <IoRibbonOutline className="text-base" />
              Meet our leadership
            </Link>

            <Link
              href="/market"
              className="hidden sm:inline-flex rounded-full border bg-white/70 backdrop-blur-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:shadow-md"
              style={{
                borderColor: "rgba(229,231,235,0.75)",
                color: EKARI.text,
              }}
            >
              Explore Marketplace
            </Link>

            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
              style={{
                background: "linear-gradient(135deg, #233F39, #111827)",
              }}
            >
              Get Started <IoArrowForwardOutline className="text-base" />
            </Link>
          </div>
        </div>

        {/* MAIN CARD */}
        <motion.div
          className="grid md:grid-cols-2 rounded-3xl bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_24px_80px_rgba(15,23,42,0.25)] overflow-hidden"
          initial={
            reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.98 }
          }
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          {/* LEFT: Brand gradient side */}
          <div
            className="relative px-6 py-7 sm:px-8 sm:py-8 flex flex-col"
            style={{
              background:
                "radial-gradient(circle at top, rgba(253,230,138,0.12), transparent 60%), linear-gradient(160deg, #233F39, #111827)",
              color: "white",
            }}
          >
            <motion.div
              variants={container}
              initial={reduceMotion ? "show" : "hidden"}
              animate="show"
              className="flex-1"
            >
              <motion.div variants={item} className="flex flex-wrap gap-2">
                <Pill icon={<IoSparklesOutline />}>AI + Data + Community</Pill>
                <Pill icon={<IoLeafOutline />}>Agribusiness Ecosystem</Pill>
                <Pill icon={<IoShieldCheckmarkOutline />}>Trusted Network</Pill>
              </motion.div>

              <motion.h1
                variants={item}
                className="mt-4 text-2xl sm:text-3xl font-semibold tracking-tight"
              >
                About ekarihub
              </motion.h1>

              <motion.p
                variants={item}
                className="mt-3 text-sm sm:text-[15px] text-emerald-100 leading-relaxed"
              >
                ekarihub is a digital agribusiness hub built to{" "}
                <span className="font-semibold text-white">
                  Collaborate, Innovate, and Cultivate
                </span>{" "}
                value across the agribusiness ecosystem. Powered by data, artificial
                intelligence (AI), and social media, we connect farmers, agronomists,
                agro-vets, suppliers, buyers, exporters, and other stakeholders —
                empowering them to share insights, build partnerships, and grow within a
                trusted, intelligent network.
              </motion.p>

              <motion.div variants={item} className="mt-6 grid gap-3">
                {[
                  {
                    n: "1",
                    title: "Cultivating Communities",
                    desc: "A social network that helps agribusiness actors connect, share, and support each other.",
                  },
                  {
                    n: "2",
                    title: "Growing Opportunities",
                    desc: "A marketplace and partnership layer that unlocks access to buyers, suppliers, and new markets.",
                  },
                  {
                    n: "3",
                    title: "Smarter Decisions",
                    desc: "Learning + AI + insights to help you improve practices, productivity, and outcomes.",
                  },
                ].map((x) => (
                  <div key={x.n} className="flex items-start gap-3">
                    <span className="mt-0.5 h-6 w-6 inline-flex items-center justify-center rounded-full bg-white/10 border border-white/20 text-[12px] font-semibold">
                      {x.n}
                    </span>
                    <div>
                      <div className="font-semibold">{x.title}</div>
                      <div className="text-[13px] text-emerald-100/80 leading-relaxed">
                        {x.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>

              <motion.div variants={item} className="mt-6 text-[12px] text-emerald-100/80">
                Cultivating Communities, Growing Agribusiness Opportunities.
              </motion.div>

              {/* CTAs */}
              <motion.div variants={item} className="mt-6 flex flex-wrap gap-2">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, #C79257, #fbbf77)",
                    color: "#111827",
                  }}
                >
                  Explore Deeds <IoArrowForwardOutline className="text-base" />
                </Link>

                <Link
                  href="/market"
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold bg-white/10 border border-white/20 text-white shadow-sm transition active:scale-[0.98]"
                >
                  Visit ekariMarket <IoArrowForwardOutline className="text-base" />
                </Link>

                {/* ✅ Mobile: outlined leadership button (matches left panel style) */}
                <Link
                  href="/leadership"
                  className="md:hidden inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold bg-white/10 border border-white/20 text-white shadow-sm transition active:scale-[0.98]"
                >
                  Meet our leadership <IoArrowForwardOutline className="text-base" />
                </Link>
              </motion.div>

              {/* ✅ Fill extra left space */}
              <motion.div variants={item} className="mt-8">
                <div className="text-[12px] font-semibold text-white/80">
                  ekarihub at a glance
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <MiniStat label="Trust" value="Verified profiles" />
                  <MiniStat label="Market" value="Buy & sell goods" />
                  <MiniStat label="Learn" value="Guides + ekari AI" />
                  <MiniStat label="Events" value="Trainings & talks" />
                </div>

                <div className="mt-5 rounded-2xl border border-white/15 bg-white/10 p-4">
                  <div className="text-[12px] font-semibold text-white">
                    How it works
                  </div>
                  <div className="mt-2 space-y-2 text-[13px] text-emerald-100/80 leading-relaxed">
                    <div className="flex gap-2">
                      <span className="h-5 w-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[11px] font-semibold text-white">
                        1
                      </span>
                      <span>Join the community and build your trusted profile.</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="h-5 w-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[11px] font-semibold text-white">
                        2
                      </span>
                      <span>Connect, learn, and share insights across the value chain.</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="h-5 w-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[11px] font-semibold text-white">
                        3
                      </span>
                      <span>Trade on ekariMarket and unlock new opportunities.</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* RIGHT: Content side */}
          <div className="px-6 py-7 sm:px-8 sm:py-8 flex flex-col">
            {/* Stats row 
            <motion.div
              initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.35, ease: "easeOut" }}
              className="grid gap-3 sm:grid-cols-2"
            >
              <StatChip
                label="Trust"
                value={stats.verifiedProfiles}
                icon={<IoCheckmarkCircleOutline className="text-xl" />}
              />
              <StatChip
                label="Marketplace"
                value={stats.marketplace}
                icon={<IoTrendingUpOutline className="text-xl" />}
              />
              <StatChip
                label="Events"
                value={stats.events}
                icon={<IoCalendarOutline className="text-xl" />}
              />
              <StatChip
                label="Community"
                value={stats.community}
                icon={<IoChatbubblesOutline className="text-xl" />}
              />
            </motion.div>
*/}
            {/* Mission / Vision */}
            <div className="mt-4 grid gap-4">
              <div
                className="rounded-2xl border bg-white/70 backdrop-blur-xl p-5 shadow-sm"
                style={{ borderColor: "rgba(229,231,235,0.75)" }}
              >
                <div className="text-sm font-semibold" style={{ color: EKARI.text }}>
                  Our Mission
                </div>
                <p className="mt-2 text-sm leading-6" style={{ color: EKARI.subtext }}>
                  To empower the global agribusiness community by fostering collaboration,
                  enabling seamless market access, and driving knowledge sharing through
                  technology, data, and artificial intelligence — supporting sustainable growth
                  for every player across the value chain.
                </p>
              </div>

              <div
                className="rounded-2xl border bg-white/70 backdrop-blur-xl p-5 shadow-sm"
                style={{ borderColor: "rgba(229,231,235,0.75)" }}
              >
                <div className="text-sm font-semibold" style={{ color: EKARI.text }}>
                  Our Vision
                </div>
                <p className="mt-2 text-sm leading-6" style={{ color: EKARI.subtext }}>
                  To be the leading social network and digital marketplace for agribusiness —
                  connecting stakeholders in one intelligent ecosystem that{" "}
                  <span className="font-semibold" style={{ color: EKARI.text }}>
                    Cultivates Communities
                  </span>
                  ,{" "}
                  <span className="font-semibold" style={{ color: EKARI.text }}>
                    Grows Agribusiness Opportunities
                  </span>
                  , and redefines how the world connects, trades, learns, and thrives in agriculture.
                </p>
              </div>
            </div>

            {/* What we do */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold" style={{ color: EKARI.text }}>
                What We Do
              </h3>
              <p className="mt-1 text-sm" style={{ color: EKARI.subtext }}>
                ekarihub makes it easier to connect, trade, learn, and grow by offering:
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Feature
                  title="Social Networking for Agribusiness"
                  desc="Engage with peers, share updates, exchange insights, and build relationships."
                  icon={<IoPeopleOutline className="text-xl" />}
                />
                <Feature
                  title="Marketplace for Goods & Services"
                  desc="Buy and sell products, equipment, and services with transparent pricing and verified profiles."
                  icon={<IoCartOutline className="text-xl" />}
                />
                <Feature
                  title="Learning & Resources Hub"
                  desc="Access expert content, ekari AI, practical guides, and data-driven insights."
                  icon={<IoSchoolOutline className="text-xl" />}
                />
                <Feature
                  title="Business Opportunities & Partnerships"
                  desc="Discover new markets, collaborators, and growth avenues across the value chain."
                  icon={<IoSparklesOutline className="text-xl" />}
                />
                <Feature
                  title="Events & Discussions"
                  desc="Join discussions and training to expand expertise and professional networks."
                  icon={<IoCalendarOutline className="text-xl" />}
                />
                <Feature
                  title="Agricultural News & Insights"
                  desc="Stay informed with trends, policies, and technologies shaping agribusiness."
                  icon={<IoNewspaperOutline className="text-xl" />}
                />
              </div>

              <div
                className="mt-4 rounded-3xl border bg-white/70 backdrop-blur-xl p-5 shadow-sm"
                style={{ borderColor: "rgba(229,231,235,0.75)" }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center"
                    style={{
                      //  borderColor: "rgba(35,63,57,0.16)",
                      // background:
                      //   "linear-gradient(135deg, rgba(35,63,57,0.10), rgba(199,146,87,0.10))",
                      color: EKARI.forest,
                    }}
                    aria-hidden
                  >
                    <IoLeafOutline className="text-xl" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: EKARI.text }}>
                      Sustainable Farming Support
                    </div>
                    <p className="mt-1 text-sm leading-6" style={{ color: EKARI.subtext }}>
                      Learn eco-friendly techniques that promote environmental stewardship and
                      long-term productivity.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Why */}
            <div
              className="mt-6 rounded-2xl border bg-slate-50/70 px-4 py-3 text-[12px] leading-relaxed"
              style={{
                borderColor: "rgba(229,231,235,0.85)",
                color: EKARI.subtext,
              }}
            >
              <span className="font-semibold" style={{ color: EKARI.text }}>
                Why ekarihub?
              </span>{" "}
              We’re a thriving community where agribusiness actors collaborate, innovate, and
              cultivate success. Whether you’re a smallholder farmer or a global exporter,
              ekarihub supports your journey with tools that make agribusiness simpler, smarter,
              and more secure.
            </div>

            {/* Bottom CTA */}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/onboarding"
                className="inline-flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-semibold text-white shadow-sm active:scale-[0.98] transition"
                style={{ background: "linear-gradient(135deg, #233F39, #111827)" }}
              >
                Join ekarihub <IoArrowForwardOutline className="text-base" />
              </Link>


              <Link
                href="/terms"
                className="text-xs font-semibold underline underline-offset-4"
                style={{ color: EKARI.subtext }}
              >
                Terms
              </Link>
              <Link
                href="/privacy"
                className="text-xs font-semibold underline underline-offset-4"
                style={{ color: EKARI.subtext }}
              >
                Privacy
              </Link>
              <Link
                href="/careers"
                className="text-xs font-semibold underline underline-offset-4"
                style={{ color: EKARI.subtext }}
              >
                Careers
              </Link>

              <Link
                href="/support"
                className="text-xs font-semibold underline underline-offset-4"
                style={{ color: EKARI.subtext }}
              >
                Support
              </Link>

              <div className="sm:ml-auto text-xs font-semibold" style={{ color: EKARI.subtext }}>
                © {new Date().getFullYear()} ekarihub
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </main>
  );
}
