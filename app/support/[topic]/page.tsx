// app/support/[topic]/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  IoArrowBack,
  IoAlertCircleOutline,
  IoBulbOutline,
  IoChevronForward,
  IoMailOutline,
  IoPricetagOutline,
  IoSettingsOutline,
} from "react-icons/io5";
import { Topbar } from "@/app/components/Topbar";
import { Footer } from "@/app/components/Footer";

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  hair: "#E5E7EB",
  text: "#0F172A",
  dim: "#6B7280",
  bg: "#FFFFFF",
};

const TOPIC_CONTENT = {
  billing: {
    label: "Billing & Payments",
    icon: IoPricetagOutline,
    color: "#FFF7ED",
    title: "Billing & Payments Support",
    intro:
      "Get help with payments, failed transactions, subscriptions, verification payments, and billing questions.",
    guides: [
      "Confirm your payment reference or receipt before contacting support.",
      "If payment was deducted but not reflected, submit a support ticket with the transaction code.",
      "For M-Pesa payments, include your phone number and payment time.",
      "For card payments, include the email used and approximate payment time.",
    ],
  },
  account: {
    label: "Account & Login",
    icon: IoSettingsOutline,
    color: "#EFF6FF",
    title: "Account & Login Support",
    intro:
      "Get help with login, Sign in with Apple, Google login, account deletion, profile updates, and access issues.",
    guides: [
      "Use the same login method you used when creating the account.",
      "Account deletion is available in the app under Profile > Edit Profile > Danger Zone.",
      "If you cannot access your account, submit a ticket using the email linked to the account.",
      "For Apple login, your private relay email may be used if you selected Hide My Email.",
    ],
  },
  technical: {
    label: "Technical Issue",
    icon: IoAlertCircleOutline,
    color: "#EEFDF3",
    title: "Technical Support",
    intro:
      "Report bugs, upload issues, app crashes, loading problems, notification problems, or device-specific issues.",
    guides: [
      "Include your device model and app version.",
      "Attach screenshots or screen recordings where possible.",
      "Describe what happened and what you expected to happen.",
      "If the issue happens repeatedly, include the steps to reproduce it.",
    ],
  },
  feature: {
    label: "Feature Request",
    icon: IoBulbOutline,
    color: "#F5F3FF",
    title: "Feature Requests",
    intro:
      "Suggest new features or improvements for ekarihub.",
    guides: [
      "Explain the feature you want added.",
      "Tell us how it will help farmers, buyers, sellers, or agribusiness users.",
      "Include examples if you have seen a similar feature elsewhere.",
      "We review feature requests and prioritize based on user impact.",
    ],
  },
} as const;

export default function SupportTopicPage() {
  const router = useRouter();
  const params = useParams();
  const topicKey = String(params?.topic || "") as keyof typeof TOPIC_CONTENT;

  const topic = TOPIC_CONTENT[topicKey] || TOPIC_CONTENT.technical;
  const Icon = topic.icon;

  return (
    <main className="min-h-screen bg-white">
      <Topbar />

      <section
        className="border-b"
        style={{
          borderColor: EKARI.hair,
          background:
            "radial-gradient(1200px 400px at 20% -10%, #C7925715, transparent 60%), #FFFFFF",
        }}
      >
        <div className="mx-auto max-w-5xl px-5 py-8 md:py-12">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: EKARI.dim }}
          >
            <IoArrowBack />
            Back
          </button>

          <div className="mt-6 flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: topic.color }}
            >
              <Icon className="text-slate-700 text-xl" />
            </div>

            <div>
              <div className="text-sm font-semibold" style={{ color: EKARI.dim }}>
                Support guide
              </div>
              <h1
                className="text-3xl md:text-4xl font-black tracking-tight"
                style={{ color: EKARI.text }}
              >
                {topic.title}
              </h1>
            </div>
          </div>

          <p className="mt-4 max-w-3xl text-base" style={{ color: EKARI.dim }}>
            {topic.intro}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-8">
          <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: EKARI.hair }}>
            <h2 className="text-lg font-black" style={{ color: EKARI.text }}>
              Helpful steps
            </h2>

            <ul className="mt-4 space-y-3">
              {topic.guides.map((item) => (
                <li key={item} className="flex gap-3">
                  <span
                    className="mt-1 h-2 w-2 rounded-full flex-shrink-0"
                    style={{ background: EKARI.gold }}
                  />
                  <span className="text-sm leading-6" style={{ color: EKARI.dim }}>
                    {item}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-xl border bg-slate-50 p-4" style={{ borderColor: EKARI.hair }}>
              <h3 className="font-black" style={{ color: EKARI.text }}>
                Still need help?
              </h3>
              <p className="mt-2 text-sm" style={{ color: EKARI.dim }}>
                Submit a support ticket and our team will respond within 24 hours.
              </p>

              <Link
                href="/support"
                className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-extrabold text-white"
                style={{ background: EKARI.gold }}
              >
                Submit a ticket
                <IoChevronForward />
              </Link>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: EKARI.hair }}>
              <h3 className="font-black" style={{ color: EKARI.text }}>
                Contact us
              </h3>

              <a
                href="mailto:support@ekarihub.com"
                className="mt-4 flex items-center gap-3 rounded-xl border p-3 hover:bg-gray-50"
                style={{ borderColor: EKARI.hair }}
              >
                <div className="w-9 h-9 rounded-full bg-[#C79257] text-white grid place-items-center">
                  <IoMailOutline />
                </div>

                <div className="flex-1">
                  <div className="font-bold" style={{ color: EKARI.text }}>
                    Email
                  </div>
                  <div className="text-sm" style={{ color: EKARI.dim }}>
                    support@ekarihub.com
                  </div>
                </div>
              </a>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: EKARI.hair }}>
              <h3 className="font-black" style={{ color: EKARI.text }}>
                Response time
              </h3>
              <p className="mt-2 text-sm" style={{ color: EKARI.dim }}>
                Email and support tickets are reviewed within 24 hours.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <Footer />
    </main>
  );
}