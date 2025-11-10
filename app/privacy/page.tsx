// app/policy/page.tsx
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

/** --- Animations (typed; easing cast to satisfy older FM typings) --- */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as unknown as any },
  },
};

/** --- Reusable Topbar / Footer (same as /terms) --- */


/** --- Policy Sections (from your content) --- */
const SECTIONS: Section[] = [
  {
    id: "intro",
    title: "ekarihub Privacy Policy",
    body: (
      <div className="space-y-4">
        <p><strong>Effective Date:</strong> 15th November 2024<br /><strong>Last Updated:</strong> 30th November 2024</p>
        <p>
          Welcome to ekarihub, a platform designed to facilitate the trading of agricultural goods and services.
          ekarihub (the <em>Hub</em>) is a product of EKABEL LIMITED, a company registered in Kenya under Registration
          Number CPR/2015/81281 (the <em>Company</em>).
        </p>
        <p>
          Protecting your privacy is essential to us. This Privacy Policy explains how we collect, use, share,
          and protect your personal data and applies to all users of ekarihub, including buyers, sellers, logistics
          providers, input suppliers, and any other stakeholders using the Hub. It governs the collection, use, storage,
          and transfer of personal data provided through our website and services in compliance with the Data Protection Act, 2019 of Kenya.
        </p>
        <p>By using the Hub, you agree to this Privacy Policy. If you do not agree, please refrain from using the Hub.</p>
      </div>
    ),
  },
  {
    id: "definitions",
    title: "2. Definitions",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li><strong>Business Purpose</strong> refers to the discussions, planning, design, and development of ekarihub, including all related business strategies, market analysis, and technological implementation.</li>
        <li><strong>Data Controller</strong> means Ekabel Limited, the entity that determines how and why personal data is processed.</li>
        <li><strong>Data Processor</strong> means Ekabel Limited, the entity that processes data on behalf of the Data Controller.</li>
        <li><strong>Personal Data</strong> means any information that can identify an individual, such as names, contact information, and trade details.</li>
        <li><strong>Users</strong> means individuals or entities using ekarihub for trading goods and services.</li>
      </ul>
    ),
  },
  {
    id: "collect",
    title: "3. What we collect",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li><strong>Personal Identification Information</strong> such as names, phone numbers, email addresses, national identification details (ID/passport) and user account credentials, including usernames and passwords.</li>
        <li><strong>Transaction Details</strong> including purchase history, product descriptions, payment details and delivery information.</li>
        <li><strong>Technical Information</strong> including IP address, device information, browser type, operating system, and usage data collected through cookies, analytics, and user feedback and similar technologies.</li>
        <li><strong>Third-Party Data</strong> including data from third-party sources or integrations, such as payment service providers, logistics partners, and external databases.</li>
      </ul>
    ),
  },
  {
    id: "legal-basis",
    title: "4. Legal Basis for Data Processing",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li><strong>Consent</strong>: When you have given us explicit consent for data processing.</li>
        <li><strong>Contract Performance</strong>: Necessary for performing a contract with you.</li>
        <li><strong>Legal Obligation</strong>: To comply with legal obligations (e.g., tax, AML laws).</li>
        <li><strong>Legitimate Interest</strong>: For the Hub’s legitimate interests (e.g., analytics, improving services) without overriding your rights.</li>
        <li><strong>Public Interest</strong>: e.g., sharing with authorities for public safety or official authority.</li>
      </ul>
    ),
  },
  {
    id: "how-collect",
    title: "5. How We Collect Your Data",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>When you register or create an account.</li>
        <li>When you use the Hub to list, buy, or sell goods and services.</li>
        <li>Through automated means such as cookies and other tracking technologies.</li>
      </ul>
    ),
  },
  {
    id: "use",
    title: "6. How We Use Your Information",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li><strong>To Provide Services</strong>: facilitate transactions, manage user accounts, and deliver products/services.</li>
        <li><strong>Communication</strong>: updates, inquiries, and (with consent) promotional content.</li>
        <li><strong>Security</strong>: detect and prevent fraud, abuse, or unauthorized activities.</li>
        <li><strong>Compliance</strong>: meet legal/regulatory obligations, including tax and reporting.</li>
        <li><strong>Analytics</strong>: market research and behavior analysis to improve services.</li>
      </ul>
    ),
  },
  {
    id: "sharing",
    title: "7. Data Sharing and Disclosure",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li><strong>Service Providers</strong>: payment processors, logistics partners, and other vendors who support our services.</li>
        <li><strong>Affiliates</strong>: EKABEL LIMITED affiliates for the Business Purpose of the Hub.</li>
        <li><strong>Regulatory / Legal</strong>: where required by law, court order, or government authority.</li>
        <li><strong>Business Transfers</strong>: merger, acquisition, or asset sale scenarios.</li>
        <li>We do <strong>not sell</strong> your personal data to third parties.</li>
      </ul>
    ),
  },
  {
    id: "transfers",
    title: "8. International Data Transfers",
    body: (
      <p>
        If your data is transferred outside Kenya, we will ensure the receiving entity provides an adequate level of
        protection in compliance with the Data Protection Act, 2019.
      </p>
    ),
  },
  {
    id: "storage",
    title: "9. Data Storage and Retention",
    body: (
      <div className="space-y-3">
        <p>
          ekarihub utilizes third-party cloud services to store and manage User data. We do not store data on servers
          managed by Ekabel Limited. User data is securely stored in reputable cloud infrastructure compliant with
          international standards.
        </p>
        <p>
          Providers implement appropriate safeguards (encryption, access controls, assessments). While we strive to
          protect your data, no method of electronic storage or transmission is completely secure.
        </p>
        <p>
          Your data may be stored on servers in different countries, depending on provider infrastructure. By using the
          Hub, you consent to such transfers, in line with relevant data protection laws.
        </p>
        <p>
          We retain personal data only as long as necessary for the purposes collected or as required by law, after which
          it is securely deleted or anonymized.
        </p>
      </div>
    ),
  },
  {
    id: "security",
    title: "10. Data Security",
    body: (
      <p>
        EKABEL LIMITED applies industry-standard measures—encryption, firewalls, and secure access protocols—to protect
        data against unauthorized access, breach, misuse, loss, or alteration. No internet transmission is entirely
        secure; absolute security cannot be guaranteed.
      </p>
    ),
  },
  {
    id: "rights",
    title: "11. Your Data Rights",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li><strong>Access</strong> — request a copy of your personal data.</li>
        <li><strong>Correction</strong> — request correction of inaccurate or incomplete data.</li>
        <li><strong>Erasure</strong> — request deletion, subject to legal obligations.</li>
        <li><strong>Restriction</strong> — request limitation of processing.</li>
        <li><strong>Portability</strong> — request a structured, commonly used copy.</li>
        <li><strong>Object</strong> — object to certain processing (e.g., direct marketing).</li>
        <li><strong>Withdraw consent</strong> — withdraw at any time where processing is based on consent.</li>
        <li>To exercise these rights, contact us using the details in Section 14.</li>
      </ul>
    ),
  },
  {
    id: "cookies",
    title: "12. Use of Cookies and Tracking Technologies",
    body: (
      <p>
        ekarihub uses cookies and similar technologies for experience, analytics, and marketing. By using the platform,
        you consent to cookies. You can manage preferences in your browser; disabling cookies may affect functionality.
      </p>
    ),
  },
  {
    id: "changes",
    title: "13. Changes to This Privacy Policy",
    body: (
      <p>
        We may update this Policy periodically. Material changes will be posted on our website, and the “Effective Date”
        above will be updated.
      </p>
    ),
  },
  {
    id: "contact",
    title: "14. Contact Information",
    body: (
      <div>
        <p className="mb-2">If you have questions or wish to exercise your data rights, contact:</p>
        <p>
          <strong>Data Controller and Processor:</strong><br />
          EKABEL LIMITED<br />
          P.O. Box 10812-00100, Nairobi.<br />
          Email: <a className="underline" href="mailto:legal@ekabell.com">legal@ekabell.com</a>
        </p>
      </div>
    ),
  },
  {
    id: "liability",
    title: "15. Liability for Data Management",
    body: (
      <p>
        EKABEL LIMITED is ultimately responsible for compliance with data protection laws and for ensuring the lawful
        basis for processing user data.
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
            className="mt-5"
          >
            <h1 className="text-3xl md:text-4xl font-black tracking-tight" style={{ color: EKARI.forest }}>Privacy Policy</h1>
            <p className="mt-2 max-w-2xl">
              How we collect, use, share, and protect your data on EkariHub.
            </p>
          </motion.div>
        </div>

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
