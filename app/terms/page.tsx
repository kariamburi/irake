// app/terms/page.tsx
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

/** --- Page Sections (replace bodies with your exact legal text when ready) --- */
const SECTIONS: Section[] = [
  {
    id: "overview",
    title: "Overview",
    body: (
      <p>
        These Terms of Service (“Terms”) govern your use of EkariHub’s websites, apps, and services (“Platform”).
        By using the Platform, you agree to these Terms and our Privacy Policy. If you’re using EkariHub on behalf of
        a business, you confirm you’re authorized to bind that business.
      </p>
    ),
  },
  {
    id: "using-services",
    title: "1. Using our Services",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>You must be 18+ (or age of majority in your jurisdiction).</li>
        <li>Keep your account secure; you’re responsible for activity under it.</li>
        <li>Follow applicable laws, advertising standards, and marketplace rules.</li>
        <li>We may request additional verification to enable certain features (e.g., selling).</li>
      </ul>
    ),
  },
  {
    id: "your-commitments",
    title: "2. Your commitments to EkariHub and our community",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>No unlawful, misleading, discriminatory, or fraudulent activity.</li>
        <li>No infringement of others’ intellectual property or privacy rights.</li>
        <li>No spam, malware, scraping, or attempts to disrupt Platform integrity.</li>
        <li>Comply with product and service restrictions (prohibited & restricted items).</li>
      </ul>
    ),
  },
  {
    id: "advertising",
    title: "3. Advertising and listings",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>Advertisers & Sellers are responsible for the accuracy and legality of listings.</li>
        <li>Sponsored placements and fees are disclosed; eligibility may require verification.</li>
        <li>We may remove non-compliant content or suspend repeat offenders.</li>
      </ul>
    ),
  },
  {
    id: "trading",
    title: "4. Trading on the Platform",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>EkariHub facilitates Buyer–Seller connections; unless stated, we’re not a party to transactions.</li>
        <li>Buyers should review prices, delivery timelines, and return/refund terms before purchase.</li>
        <li>Disputes should be resolved in good faith; we may offer limited mediation at our discretion.</li>
      </ul>
    ),
  },
  {
    id: "data-privacy",
    title: "5. Data Usage & Privacy",
    body: (
      <p>
        We process personal data per our <Link href="/privacy" className="underline">Privacy Policy</Link>. We use appropriate
        safeguards but no system is 100% secure. You must keep your information accurate and up to date.
      </p>
    ),
  },
  {
    id: "ip",
    title: "6. Intellectual Property & Content Rights",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>
          You own the content you post; you grant EkariHub a worldwide, non-exclusive, royalty-free license to host,
          display, and distribute it to operate and promote the Platform.
        </li>
        <li>Do not upload content you don’t have rights to. We respond to valid IP complaints and may remove infringing content.</li>
      </ul>
    ),
  },
  {
    id: "nda",
    title: "7. Confidentiality (NDA)",
    body: (
      <p>
        Confidential information shared by EkariHub or users must not be disclosed without consent. This does not
        apply to information that is public, independently developed, or lawfully received without confidentiality obligations.
      </p>
    ),
  },
  {
    id: "safety",
    title: "8. Safety, suspension, and termination",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>We may limit, suspend, or terminate access for policy breaches or legal reasons.</li>
        <li>We may remove or restrict content that violates these Terms or applicable law.</li>
      </ul>
    ),
  },
  {
    id: "disclaimers",
    title: "9. Disclaimers and limitation of liability",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>Platform is provided “as-is” and “as-available”, without warranties of any kind.</li>
        <li>
          To the fullest extent allowed by law, EkariHub is not liable for indirect, incidental, special, consequential,
          or punitive damages, or loss of profits, data, or use.
        </li>
      </ul>
    ),
  },
  {
    id: "law",
    title: "10. Governing law and disputes",
    body: (
      <p>
        These Terms are governed by the laws of Kenya (unless mandatory local law applies). Disputes will be submitted
        to competent courts in Kenya after good-faith attempts to resolve informally.
      </p>
    ),
  },
  {
    id: "changes",
    title: "11. Changes to these Terms",
    body: (
      <p>
        We may update these Terms; changes take effect upon posting. Continued use after updates means you accept the
        revised Terms. Last updated: {new Date().toLocaleDateString()}.
      </p>
    ),
  },
  {
    id: "contact",
    title: "12. Contact",
    body: (
      <p>
        EkariHub Support — <a className="underline" href="mailto:support@ekarihub.com">support@ekarihub.com</a>
        <br />
        P.O. Box 12345-00100, Nairobi, Kenya
      </p>
    ),
  },
];

/** --- Active section highlight (Facebook-like) --- */
function useActiveSection(ids: string[]) {
  const [active, setActive] = React.useState(ids[0] || "");
  React.useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActive(visible.target.id);
      },
      { root: null, rootMargin: "0px 0px -60% 0px", threshold: [0.15, 0.35, 0.6] }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [ids]);
  return active;
}

/** --- Animations (typed Variants; fixed transition typing) --- */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      // Cast to satisfy older Framer Motion type defs
      ease: [0.22, 1, 0.36, 1] as unknown as any,
    },
  },
};



export default function TermsPage() {
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
      <section className="relative">
        <div className="mx-auto max-w-6xl px-5 py-5 md:py-4">

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-0"
          >
            <h1 className="text-3xl md:text-4xl font-black tracking-tight" style={{ color: EKARI.forest }}>Terms of Service</h1>
            <p className="mt-2 max-w-2xl">
              Our rules for using EkariHub. Please read them carefully.
            </p>
          </motion.div>
        </div>

      </section>

      {/* Body */}
      <section className="mx-auto max-w-6xl px-5 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-8">
          {/* Left nav */}
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

          {/* Main content */}
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

            {/* App CTA */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              className="mt-8 rounded-2xl border p-5 md:p-6"
              style={{ borderColor: EKARI.hair, background: "#FBFBFD" }}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h3 className="text-base md:text-lg font-extrabold" style={{ color: EKARI.text }}>
                    Download the EkariHub App
                  </h3>
                  <p className="text-sm" style={{ color: EKARI.dim }}>
                    Join the community and grow together.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href="#"
                    className="rounded-xl border px-3 py-2 text-sm font-bold hover:shadow-sm"
                    style={{ borderColor: EKARI.hair, color: EKARI.text, background: "#fff" }}
                  >
                    Google Play
                  </Link>
                  <Link
                    href="#"
                    className="rounded-xl border px-3 py-2 text-sm font-bold hover:shadow-sm"
                    style={{ borderColor: EKARI.hair, color: EKARI.text, background: "#fff" }}
                  >
                    App Store
                  </Link>
                </div>
              </div>
            </motion.div>
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
