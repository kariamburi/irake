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

export default function DeleteAccountClientPage() {
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
      <section className="relative overflow-hidden border-b" style={{ borderColor: EKARI.hair }}>
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
              Account & Privacy
            </div>

            <h1
              className="mt-4 text-3xl font-black tracking-tight md:text-5xl"
              style={{ color: EKARI.forest }}
            >
              Delete your ekarihub account
            </h1>

            <p
              className="mt-4 max-w-2xl text-base leading-7 md:text-lg"
              style={{ color: EKARI.dim }}
            >
              You can request permanent deletion of your ekarihub account and associated
              data by email or directly from the app through your profile settings.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Body */}
      <section className="mx-auto max-w-6xl px-5 py-8 md:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: EKARI.hair }}>
              <div
                className="border-b px-4 py-3"
                style={{ borderColor: EKARI.hair, background: "#FCFCFD" }}
              >
                <h2 className="text-sm font-extrabold" style={{ color: EKARI.text }}>
                  On this page
                </h2>
              </div>

              <div className="p-2">
                {[
                  { href: "#how-to-request", label: "How to request deletion" },
                  { href: "#what-happens", label: "What happens next" },
                  { href: "#timeline", label: "Deletion timeline" },
                  { href: "#support", label: "Support contact" },
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
              id="how-to-request"
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
                    How to request account deletion
                  </h2>
                  <div className="mt-3 space-y-3 text-[15px] leading-7 text-gray-700">
                    <p>
                      To request deletion of your ekarihub account and all associated data,
                      please email us at{" "}
                      <a
                        href="mailto:support@ekarihub.com"
                        className="font-semibold underline underline-offset-4"
                        style={{ color: EKARI.forest }}
                      >
                        support@ekarihub.com
                      </a>
                      .
                    </p>
                    <p>
                      You may also request deletion directly from the mobile app under{" "}
                      <span className="font-semibold">Profile Edit settings</span> by
                      selecting <span className="font-semibold">Delete Account</span>.
                    </p>
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.section
              id="what-happens"
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
                What happens after your request
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div
                  className="rounded-2xl border bg-white p-4"
                  style={{ borderColor: EKARI.hair }}
                >
                  <div
                    className="mb-2 text-sm font-extrabold uppercase tracking-wide"
                    style={{ color: EKARI.gold }}
                  >
                    Review
                  </div>
                  <p className="text-sm leading-6 text-gray-700">
                    We verify the deletion request to ensure it is coming from the
                    rightful account owner.
                  </p>
                </div>

                <div
                  className="rounded-2xl border bg-white p-4"
                  style={{ borderColor: EKARI.hair }}
                >
                  <div
                    className="mb-2 text-sm font-extrabold uppercase tracking-wide"
                    style={{ color: EKARI.gold }}
                  >
                    Processing
                  </div>
                  <p className="text-sm leading-6 text-gray-700">
                    Your account and related personal data are queued for permanent
                    removal from our systems.
                  </p>
                </div>

                <div
                  className="rounded-2xl border bg-white p-4"
                  style={{ borderColor: EKARI.hair }}
                >
                  <div
                    className="mb-2 text-sm font-extrabold uppercase tracking-wide"
                    style={{ color: EKARI.gold }}
                  >
                    Completion
                  </div>
                  <p className="text-sm leading-6 text-gray-700">
                    Once complete, the deleted account cannot be restored and access to
                    its data will be removed.
                  </p>
                </div>
              </div>
            </motion.section>

            <motion.section
              id="timeline"
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
                Deletion timeline
              </h2>

              <div className="mt-4 rounded-2xl border p-5" style={{ borderColor: "#EADBC9", background: "#FFF9F4" }}>
                <p className="text-base leading-7" style={{ color: EKARI.text }}>
                  Once your deletion request is received, your data will be permanently
                  deleted within <span className="font-extrabold">7 days</span>.
                </p>
              </div>

              <p className="mt-4 text-[15px] leading-7 text-gray-700">
                Some limited information may be temporarily retained where required for
                legal, fraud prevention, security, or compliance purposes, after which it
                is removed according to our internal retention procedures.
              </p>
            </motion.section>

            <motion.section
              id="support"
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
                Need help?
              </h2>

              <p className="mt-3 text-[15px] leading-7 text-gray-700">
                If you are unable to access your account or need help with the deletion
                process, contact our support team.
              </p>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <a
                  href="mailto:support@ekarihub.com"
                  className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:opacity-95"
                  style={{ background: EKARI.forest }}
                >
                  Email Support
                </a>

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