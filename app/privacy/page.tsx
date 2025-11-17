// app/policy/page.tsx
"use client";

import * as React from "react";
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
    id: "rights",
    title: "11. Your Data Rights",
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
    title: "12. Use of Cookies and Tracking Technologies",
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
    title: "13. Changes to This Privacy Policy",
    body: (
      <p>
        This Privacy Policy may be updated periodically to reflect changes in the Hub. We will notify you of any
        material changes by posting the updated policy on our website and updating the "Effective Date" above.
      </p>
    ),
  },
  {
    id: "contact",
    title: "14. Contact Information",
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
    title: "15. Liability for Data Management",
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
            <h1
              className="text-3xl md:text-4xl font-black tracking-tight"
              style={{ color: EKARI.forest }}
            >
              ekarihub Privacy Policy
            </h1>
            <p className="mt-2 text-sm md:text-base" style={{ color: EKARI.dim }}>
              Effective Date: 15th November 2024
              <br />
              Last Updated: 30th November 2024
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
              <div
                className="px-4 py-3 border-b rounded-t-2xl"
                style={{ borderColor: EKARI.hair }}
              >
                <div className="text-sm font-extrabold" style={{ color: EKARI.text }}>
                  Contents
                </div>
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
                            borderLeft: is
                              ? `3px solid ${EKARI.gold}`
                              : "3px solid transparent",
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
                <h2
                  className="text-xl md:text-2xl font-black mb-2"
                  style={{ color: EKARI.text }}
                >
                  {sec.title}
                </h2>
                <div className="text-[15px] leading-7 text-gray-700">{sec.body}</div>
                <div className="mt-6 h-px" style={{ background: EKARI.hair }} />
              </motion.section>
            ))}

            {/* App CTA (non-legal UI) */}
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
                  <h3
                    className="text-base md:text-lg font-extrabold"
                    style={{ color: EKARI.text }}
                  >
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
