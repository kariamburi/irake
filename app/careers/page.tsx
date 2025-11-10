// app/careers/page.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { Topbar } from "../components/Topbar";
import { Footer } from "../components/Footer";

/** --- Brand --- */
const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  hair: "#E5E7EB",
  text: "#0F172A",
  dim: "#6B7280",
  bg: "#FFFFFF",
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
      viewport={{ once: true, amount: 0.2 }}
      className="rounded-2xl border p-4 md:p-5 hover:shadow-sm transition"
      style={{ borderColor: EKARI.hair, background: "#fff" }}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="text-base md:text-lg font-extrabold" style={{ color: EKARI.text }}>
            {job.title}
          </div>
          <div className="mt-1 text-sm" style={{ color: EKARI.dim }}>
            {job.team} • {job.location} • {job.type}
          </div>
          {job.future && (
            <div className="mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ background: "#FFF7ED", color: EKARI.gold, border: `1px solid ${EKARI.gold}20` }}>
              Future role
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {job.href ? (
            <Link
              href={job.href}
              className="rounded-lg border px-3 py-2 text-sm font-bold hover:shadow-sm"
              style={{ borderColor: EKARI.hair, color: EKARI.text, background: "#fff" }}
            >
              View details
            </Link>
          ) : (
            <a
              href="mailto:talent@ekarihub.com?subject=Talent%20Network%20-%20EkariHub&body=Hi%20EkariHub%2C%20I%27d%20love%20to%20be%20considered%20for%20future%20roles..."
              className="rounded-lg border px-3 py-2 text-sm font-bold hover:shadow-sm"
              style={{ borderColor: EKARI.hair, color: EKARI.text, background: "#fff" }}
            >
              Notify me
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
                href="mailto:talent@ekarihub.com?subject=Talent%20Network%20-%20EkariHub&body=Attach%20your%20CV%20and%20share%20a%20few%20lines%20on%20how%20you%27d%20like%20to%20contribute."
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
                Learn about EkariHub
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
    title: "Life at EkariHub",
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
        <li>Share your profile/CV and a short note on why EkariHub.</li>
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
            href="mailto:talent@ekarihub.com?subject=Talent%20Network%20-%20EkariHub&body=Attach%20your%20CV%20and%20share%20a%20few%20lines%20on%20how%20you%27d%20like%20to%20contribute."
            className="rounded-xl px-4 py-2 text-sm font-bold"
            style={{ background: EKARI.forest, color: "#fff" }}
          >
            Email talent@ekarihub.com
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
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onClickNav = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <main className="min-h-screen bg-white scroll-smooth">
      <Topbar />

      {/* Hero */}
      <section className="relative" style={{ background: EKARI.forest }}>
        <div className="mx-auto max-w-6xl px-5 py-10 md:py-14">
          <motion.div
            variants={fadeIn}
            initial="hidden"
            animate="show"
            className="flex items-center gap-4"
          >

            <div className="text-white/80 font-semibold">Careers</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-5"
          >
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Build the rails of African agriculture</h1>
            <p className="mt-2 text-white/80 max-w-2xl">
              We’re not hiring right now - but we’re always meeting builders who care about impact.
            </p>
          </motion.div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[2px]" style={{ background: EKARI.gold }} />
      </section>

      {/* Body */}
      <section className="mx-auto max-w-6xl px-5 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-8">
          {/* Left TOC */}
          <aside className="lg:sticky lg:self-start lg:top-20 h-max">
            <div className="rounded-2xl border" style={{ borderColor: EKARI.hair }}>
              <div className="px-4 py-3 border-b rounded-t-2xl" style={{ borderColor: EKARI.hair }}>
                <div className="text-sm font-extrabold" style={{ color: EKARI.text }}>Contents</div>
              </div>
              <nav className="max-h-[70vh] overflow-auto">
                <ul className="p-2">
                  {SECTIONS.map((s) => {
                    const is = active === s.id;
                    return (
                      <li key={s.id}>
                        <a
                          href={`#${s.id}`}
                          onClick={(e) => onClickNav(e, s.id)}
                          className={[
                            "block rounded-lg px-3 py-2 text-sm font-semibold transition",
                            is ? "bg-[#F8F9FB]" : "hover:bg-gray-50",
                          ].join(" ")}
                          style={{
                            color: is ? EKARI.forest : EKARI.text,
                            borderLeft: is ? `3px solid ${EKARI.gold}` : "3px solid transparent",
                          }}
                        >
                          {s.title}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>
          </aside>

          {/* Content */}
          <article>
            {SECTIONS.map((sec) => (
              <motion.section
                key={sec.id}
                id={sec.id}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: false, amount: 0.2 }}
                className="scroll-mt-28"
              >
                <h2 className="text-xl md:text-2xl font-black mb-2" style={{ color: EKARI.text }}>
                  {sec.title}
                </h2>
                <div className="text-[15px] leading-7 text-gray-700">{sec.body}</div>
                <div className="mt-6 h-px" style={{ background: EKARI.hair }} />
              </motion.section>
            ))}
          </article>
        </div>
      </section>

      {/* Back to top */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={[
          "fixed right-4 bottom-5 z-40 rounded-full border px-3 py-2 shadow-sm text-sm font-bold",
          showTop ? "opacity-100" : "opacity-0 pointer-events-none",
          "transition-opacity",
        ].join(" ")}
        style={{ background: EKARI.bg, borderColor: EKARI.hair, color: EKARI.text }}
        aria-label="Back to top"
      >
        ↑ Top
      </button>

      <Footer />
    </main>
  );
}
