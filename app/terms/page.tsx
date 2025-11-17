// app/terms/page.tsx
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

/** --- Exact legal text, structured into sections but NOT reworded --- */
const SECTIONS: Section[] = [
  {
    id: "introduction",
    title: "1. Introduction",
    body: (
      <div className="space-y-4">
        <p>Last Updated: November 2024</p>

        <p>
          Welcome to ekarihub (the Hub), your agribusiness’ new innovative favorite hangout! ekarihub is a
          product of EKABEL LIMITED, a limited liability company registered in the Republic of Kenya, with
          its address at P.O. Box 10812-00100, Nairobi, Kenya.
        </p>

        <p>
          The primary purpose of ekarihub is to create an avenue for you to have fun online as you connect with
          farmers and other agribusiness value chain actors such as agronomists, veterinarians, agricultural
          products exporters, show off your farms, plants, animals etc., showcase your work, share your
          agribusiness challenges, get expert agribusiness advice, lease tools and machinery , advertise,
          market and sell produce with confidence. We are your one stop hub for everything you need to do
          agribusiness like a superstar!
        </p>

        <p>
          As part of the ekarihub community, you will have the opportunity to upload and showcase various types
          of content, including articles, deeds, photos, videos, and other materials related to agriculture.
          These user-generated materials will be featured on the platform, allowing others to access, view, and
          engage with the content shared. Please read this policy carefully to understand how we collect, use,
          store, and protect your personal data and content.
        </p>

        <p>
          By accessing or using ekarihub, you agree to comply with these Terms and Conditions (T&amp;Cs). If you
          do not agree with any part of these T&amp;Cs, please discontinue using the Hub.
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
          "Buyer" refers to any registered User who purchases or intends to purchase agricultural products,
          services, or inputs listed on Ekarihub by Sellers.
        </p>
        <p>
          "Content" refers to all information, data, text, graphics, videos, and other materials available on
          the Platform.
        </p>
        <p>"Hub" or "ekarihub" refers to the ekarihub website and mobile application.</p>
        <p>
          "Seller" refers to any registered User who lists, advertises, or sells agricultural products,
          services, or inputs on Ekarihub.
        </p>
        <p>
          "Services" refer to all features and functionalities provided by ekarihub, including marketplace
          services, data analytics and information resources.
        </p>
        <p>
          "Transaction" refers to any completed or intended exchange of goods, services, or payments between a
          Buyer and a Seller facilitated through ekarihub.
        </p>
        <p>
          "User" refers to any individual or entity using ekarihub, including but not limited to farmers,
          buyers, logistics providers, input suppliers and service providers.
        </p>
      </div>
    ),
  },
  {
    id: "accounts",
    title: "3. User Accounts and Registration",
    body: (
      <div className="space-y-4">
        <p>
          Users must create an account to access features of ekarihub. You agree to provide accurate, complete
          and current information during the registration process.
        </p>
        <p>
          Users are responsible for maintaining the confidentiality of their login credentials and are liable
          for all activities conducted under their account.
        </p>
      </div>
    ),
  },
  {
    id: "use-of-platform",
    title: "4. Use of the Platform",
    body: (
      <div className="space-y-4">
        <p>
          Users agree to use the Hub for lawful purposes only and in accordance with these T&amp;Cs. User may
          not:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Misrepresent their identity or affiliation with any entity.</li>
          <li>Post or share any illegal, offensive, or misleading content.</li>
          <li>Use the Hub in a way that could disrupt its operation or harm its integrity.</li>
          <li>Engage in fraudulent activities or violate any applicable laws.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "advertising",
    title: "5. Advertising on the Hub",
    body: (
      <div className="space-y-4">
        <p>
          ekarihub reserves the right to display advertisements on the Hub, including banners, sponsored
          content, and other promotional material. These advertisements may be targeted to Users based on their
          activity and preferences.
        </p>
        <p>
          Users may be allowed to post advertisements for their goods and services in accordance with the Hub’s
          advertising guidelines. All ads must comply with relevant laws and cannot contain offensive,
          misleading, or unlawful content. ekarihub reserves the right to reject or remove any user
          advertisement that violates these guidelines.
        </p>
        <p>
          If applicable, Users may be required to pay a fee for displaying advertisements on the Hub. The
          applicable fees and payment terms will be detailed in a separate agreement.
        </p>
        <p>
          ekarihub may modify its advertising policies at any time. Users will be notified of any significant
          changes, and continued use of the platform after such changes constitutes acceptance of the updated
          policy.
        </p>
      </div>
    ),
  },
  {
    id: "trading",
    title: "6. ekarihub Terms and Conditions for Trading on the Platform",
    body: (
      <div className="space-y-4">
        <p>(a) Eligibility</p>

        <p>
          Only registered Users who have completed the account verification process are permitted to engage in
          trading on the Hub.
        </p>
        <p>Users must be 18 years or older and legally capable of entering into binding contracts.</p>
        <p>
          the Hub reserves the right to reject any registration or to suspend or terminate any account at its
          discretion.
        </p>

        <p>(b) User Obligations for Trading</p>

        <p>
          Users are solely responsible for ensuring that all information provided about their products or
          services (e.g., product descriptions, pricing, availability) is accurate, complete, and up-to-date.
        </p>
        <p>
          Users must comply with all applicable local, national, and international laws and regulations,
          including trade and consumer protection laws.
        </p>
        <p>Users must not engage in:</p>
        <p>
          (a) Fraudulent or deceptive activities, such as misrepresenting product quality or quantity.
          <br />
          (b) Illegal trade practices, including trading in banned, restricted, or counterfeit goods.
          <br />
          (c) Unfair trade practices, such as price manipulation or misleading advertising.
        </p>

        <p>(c) Listing and Selling Products</p>

        <p>
          Users may list products and services for sale on the Hub, subject to compliance with the Platform&apos;s
          guidelines and these T&amp;Cs.
        </p>
        <p>
          Product listings must be accurate and must not contain false, misleading, or incomplete information.
          Listings that violate these requirements may be removed by the Hub without notice.
        </p>
        <p>
          Users are prohibited from listing items or services that are illegal, hazardous, or otherwise
          restricted by law or the Hub’s policies.
        </p>
        <p>
          All prices must be clearly stated in Kenya Shillings (KES) or United States Dollars (USD), inclusive
          of applicable taxes and fees.
        </p>

        <p>(d) Buyer Obligations</p>

        <p>
          Buyers must review product descriptions, terms of sale, and any other relevant details before making a
          purchase.
        </p>
        <p>
          Buyers agree to pay the total amount due, including any applicable fees, taxes, and shipping costs, as
          specified by the seller.
        </p>
        <p>
          By making a purchase, the Buyer enters into a binding contract with the Seller and is obligated to
          complete the transaction unless the product is found to be materially different from its description.
        </p>

        <p>(e) Payment and Fees</p>

        <p>
          The Hub provides various payment options, including mobile payments (M-Pesa), bank transfers, and
          credit or debit card payments.
        </p>
        <p>
          Users agree to pay any fees or charges associated with the use of the Hub’s services, as shall be
          specified on the Hub from time to time.
        </p>
        <p>
          Payments can be made in Kenya Shillings (KES) or United States Dollars (USD). Users are responsible
          for any bank or transaction fees incurred.
        </p>
        <p> ekarihub reserves the right to withhold or suspend payments if any fraudulent or suspicious activity is detected.</p>

        <p>(f) Dispute Resolution and Refunds</p>

        <p>
          In the event of a dispute between a Buyer and a Seller, both parties must attempt to resolve the issue
          amicably through direct communication.
        </p>
        <p>
          If the parties cannot resolve the dispute, the Hub may, at its discretion, intervene to mediate.
          However, the Hub is not obligated to resolve disputes and assumes no liability for any transactions
          conducted on the Hub.
        </p>
        <p>
          Refunds or returns must comply with the Seller’s stated policies. Ekarihub is not responsible for
          enforcing or processing refunds or returns unless explicitly stated.
        </p>

        <p>(g) Liability Disclaimer</p>

        <p>
          ekarihub acts as a facilitator for transactions between Users and does not guarantee the quality,
          safety, legality, or accuracy of the products or services listed.
        </p>
        <p>
          ekarihub is not liable for any direct, indirect, incidental, or consequential damages arising from the
          use of the Hub or transactions conducted through it.
        </p>
        <p>
          Users assume full responsibility for their actions and interactions on the Platform. ekarihub disclaims
          any liability for disputes, product defects, delivery issues, or any other problems arising from
          trading activities.
        </p>

        <p>(h) Prohibited Activities</p>

        <p>
          Users are prohibited from using the Hub for illegal, fraudulent, or unauthorized purposes, posting or
          sharing content that is harmful, offensive, defamatory, or that violates the rights of others and
          engaging in activities that could harm the integrity, security, or operation of the Hub, such as
          hacking or introducing malware.
        </p>

        <p>(i) Termination of Trading Privileges</p>

        <p>
          ekarihub reserves the right to suspend or terminate any User’s trading privileges without notice if
          they violate these T&amp;Cs, engage in fraudulent activities, or misuse the Hub.
        </p>
        <p>
          Upon termination, the User’s access to trading features will be revoked, and any pending transactions
          may be canceled at ekarihub’s discretion.
        </p>
      </div>
    ),
  },
  {
    id: "data-privacy",
    title: "7. Data Usage and Privacy",
    body: (
      <div className="space-y-4">
        <p>
          By using the Hub Users consent to the collection, processing, and sharing of their data as described in
          our Privacy Policy, which forms part of these T&amp;Cs.
        </p>
        <p>
          Users may use their own data or data obtained from third-party sources when conducting transactions on
          the Hub. The responsibility for ensuring the accuracy, legality, and appropriateness of any data used
          rests solely with the User.
        </p>
        <p>
          The Hub acts as a facilitator and is not a party to any contracts or agreements made between Users.
          Users are solely responsible for the terms, conditions, and fulfillment of their transactions. Users
          must comply with all applicable laws and regulations, including those governing trade, product
          quality, and consumer protection
        </p>
        <p>
          EKABEL LIMITED takes measures to protect User data but is not liable for any unauthorized access
          resulting from User negligence such as failure to secure login credentials.
        </p>
      </div>
    ),
  },
  {
    id: "ip",
    title: "8. Intellectual Property Rights",
    body: (
      <div className="space-y-4">
        <p>
          ekarihub and its content, including all software, trademarks, logos, and materials, are the exclusive
          property of EKABEL LIMITED and are protected by copyright, trademark, and other intellectual property
          laws.
        </p>
        <p>
          Users are granted a limited, non-exclusive license to access and use ekarihub for its intended purpose.
          Users may not copy, modify, distribute, or exploit any content from the Hub without prior written
          consent from EKABEL LIMITED.
        </p>
        <p>
          Any suggestions, feedback, or ideas submitted by Users shall become the property of EKABEL LIMITED,
          which may use them without any obligation to the User.
        </p>
      </div>
    ),
  },
  {
    id: "nda",
    title: "9. Non-Disclosure Agreement (NDA)",
    body: (
      <div className="space-y-4">
        <p>
          Users agree to keep confidential any proprietary information, business strategies, or sensitive data
          they may access through the Hub.
        </p>
        <p>
          Users shall not disclose any confidential information to third parties without express written consent
          from EKABEL LIMITED.
        </p>
        <p>
          The obligations of confidentiality shall continue for a period of ten (10) years after termination of
          their use of the Platform.
        </p>
      </div>
    ),
  },
  {
    id: "liability-indemnification",
    title: "10. Liability and Indemnification",
    body: (
      <div className="space-y-4">
        <p>
          EKABEL LIMITED provides the Hub on an "as is" and "as available" basis and makes no warranties or
          guarantees regarding its accuracy, reliability, or availability.
        </p>
        <p>
          EKABEL LIMITED is not liable for any direct, indirect, incidental, consequential, or punitive damages
          resulting from the use or inability to use the Hub.
        </p>
        <p>
          Users agree to indemnify and hold EKABEL LIMITED harmless from any claims, damages, or losses arising
          from their use of the Hub or breach of these T&amp;Cs.
        </p>
      </div>
    ),
  },
  {
    id: "disclaimers",
    title: "11. Disclaimers and Limitation of Liability",
    body: (
      <div className="space-y-4">
        <p>(a) Disclaimers</p>

        <p>
          ekarihub serves as a neutral intermediary between buyers, sellers, and service providers on the Hub.
          It does not verify, endorse, or guarantee the quality, safety, legality, or suitability of any goods
          or services traded on the Hub.
        </p>
        <p>
          The Hub is provided on an "as-is" “where-is" basis, without warranties of any kind, either express or
          implied. This includes warranties of fitness for a particular purpose, merchantability and
          non-infringement.
        </p>
        <p>
          The Hub may offer integrations with third-party providers, such as logistics and payment services, for
          user convenience. These third-party services operate independently, and ekarihub is not liable for
          their actions, errors, or failures.
        </p>
        <p>
          ekarihub does not validate the content posted by users, such as product descriptions or reviews. Users
          are encouraged to conduct their own due diligence.
        </p>
        <p>
          Any information shared on the Hub is intended for general guidance only and should not be relied upon
          as legal, financial, or agricultural advice.
        </p>

        <p>(b) Limitation of Liability</p>

        <p>
          To the maximum extent permitted by law, ekarihub, Ekabel Limited, and their representatives shall not
          be held liable for indirect, incidental, special, punitive, or consequential damages and/or loss of
          profits, data, or business opportunities resulting from platform use.
        </p>
        <p>
          ekarihub disclaims liability for disputes arising from transactions between users, including
          non-delivery of goods or services and payment failures or fraud.
        </p>
        <p>
          ekarihub will not be responsible for any interruptions or errors due to technical issues, scheduled
          maintenance, or unforeseen events beyond its control (force majeure).
        </p>
        <p>
          While reasonable security measures are in place, ekarihub is not liable for breaches caused by
          third-party attacks, user negligence, or factors outside its control.
        </p>
        <p>
          ekarihub&apos;s liability, in any case, is limited to the amount paid by the User for Hub services during
          the three months prior to the incident.
        </p>

        <p>(c) Indemnification</p>

        <p>
          Users agree to indemnify and defend ekarihub, Ekabel Limited, and their agents against claims or
          liabilities arising from User-generated content, breach of these terms by the user and/or violation of
          any law or third-party rights.
        </p>
      </div>
    ),
  },
  {
    id: "termination-access",
    title: "12. Termination of Access",
    body: (
      <div className="space-y-4">
        <p>
          EKABEL LIMITED reserves the right to suspend or terminate any User’s access to the Hub at any time,
          without notice, for any reason, including but not limited to violation of these T&amp;Cs, fraudulent
          activity, or misuse of the Hub.
        </p>
        <p>
          Upon termination, the User’s right to use the Hub will cease immediately, and EKABEL LIMITED retains
          ownership of all data, IP, and content generated through the User’s activities on the Hub.
        </p>
      </div>
    ),
  },
  {
    id: "governing-law",
    title: "13. Governing Law and Dispute Resolution",
    body: (
      <div className="space-y-4">
        <p>
          These T&amp;Cs shall be governed by the laws of Kenya. Any disputes arising from these T&amp;Cs shall be
          resolved through good-faith negotiations. If negotiations fail, disputes shall be submitted to
          mediation in Nairobi, Kenya, before pursuing other legal remedies. Such mediation will be conducted
          under the Nairobi Centre for International Arbitration (Mediation) Rules, 2015 and where the parties
          cannot agree on the choice of a mediator within fourteen (14) days of the issuance of the
          aforementioned notice to institute mediation proceedings, then the parties hereby agree that on the
          application of either party, the chairperson for the time being of the Nairobi Centre for International
          Arbitration shall appoint the mediator. The mediation proceedings shall be conducted in Nairobi, Kenya.
        </p>
        <p>
          Should such mediation fail, the parties shall submit to the exclusive jurisdiction of the Kenyan
          courts as regards any dispute, claim or matter.
        </p>
      </div>
    ),
  },
  {
    id: "changes",
    title: "14. Changes to the Terms and Conditions",
    body: (
      <div className="space-y-4">
        <p>
          EKABEL LIMITED reserves the right to update or modify these T&amp;Cs at any time. Users will be notified
          of significant changes via the Hub. Continued use of the Hub following any changes constitutes
          acceptance of the revised T&amp;Cs.
        </p>
      </div>
    ),
  },
  {
    id: "contact",
    title: "15. Contact Information",
    body: (
      <div className="space-y-4">
        <p>
          For any questions about these T&amp;Cs or to report a violation, please contact us at:
        </p>
        <p>
          Email: legal@ekabell.com
          <br />
          Address: P.O. Box 10812-00100, Nairobi, Kenya
        </p>
      </div>
    ),
  },
];

/** --- Active section highlight (sidebar) --- */
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

/** --- Animations --- */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
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
            <h1
              className="text-3xl md:text-4xl font-black tracking-tight"
              style={{ color: EKARI.forest }}
            >
              Terms and Conditions for Ekarihub
            </h1>
          </motion.div>
        </div>
      </section>

      {/* Body */}
      <section className="mx-auto max-w-6xl px-5 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-8">
          {/* Left nav */}
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

            {/* App CTA (same style as before, not part of the legal text) */}
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
                    style={{
                      borderColor: EKARI.hair,
                      color: EKARI.text,
                      background: "#fff",
                    }}
                  >
                    Google Play
                  </Link>
                  <Link
                    href="#"
                    className="rounded-xl border px-3 py-2 text-sm font-bold hover:shadow-sm"
                    style={{
                      borderColor: EKARI.hair,
                      color: EKARI.text,
                      background: "#fff",
                    }}
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
