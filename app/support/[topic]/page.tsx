"use client";

import React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  IoAlertCircleOutline,
  IoArrowBackOutline,
  IoArrowForwardOutline,
  IoBulbOutline,
  IoChevronForwardOutline,
  IoMailOutline,
  IoPricetagOutline,
  IoSettingsOutline,
  IoShieldCheckmarkOutline,
  IoSparklesOutline,
  IoTimeOutline,
} from "react-icons/io5";

import { Topbar } from "@/app/components/Topbar";
import { Footer } from "@/app/components/Footer";

const EKARI = {
  forest: "#173C2E",
  leaf: "#214C3A",
  gold: "#c69258",
  page: "#F8F7F2",
  surface: "#FBFAF6",
  border: "#DDD8CC",
  text: "#0F172A",
  dim: "#64748B",
};

const TOPIC_CONTENT = {
  billing: {
    label: "Billing & Payments",
    icon: IoPricetagOutline,
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

  const topicKey = String(
    params?.topic || ""
  ) as keyof typeof TOPIC_CONTENT;

  const topic =
    TOPIC_CONTENT[topicKey] ||
    TOPIC_CONTENT.technical;

  const Icon = topic.icon;

  return (
    <main
      className="min-h-[100svh] w-full max-w-full overflow-x-clip bg-[#F8F7F2] touch-pan-y"
      style={{
        WebkitOverflowScrolling: "touch",
        touchAction: "pan-y",
      }}
    >
      <Topbar />

      {/* =========================================================
          FULL-WIDTH TOPIC HERO
      ========================================================= */}
      <section className="relative overflow-hidden border-b border-[#DDD8CC] bg-[#173C2E] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.75) 18px 19px)",
          }}
        />

        <div className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full bg-white/[0.035]" />
        <div className="pointer-events-none absolute -bottom-28 left-[33%] h-72 w-72 rounded-full bg-[#c69258]/[0.08]" />

        <div className="relative mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-7 md:py-14 lg:px-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex h-9 items-center gap-2 rounded-[11px] border border-white/10 bg-white/[0.06] px-3 text-[8px] font-black text-white/65 transition hover:bg-white/[0.1]"
          >
            <IoArrowBackOutline size={12} />
            Back
          </button>

          <div className="mt-6 max-w-[840px]">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/70">
                <Icon
                  size={12}
                  className="text-[#c69258]"
                />
                {topic.label}
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/70">
                <IoShieldCheckmarkOutline
                  size={12}
                  className="text-[#c69258]"
                />
                Support guide
              </span>
            </div>

            <div className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-[#c69258]">
              Help center
            </div>

            <h1 className="mt-1 max-w-4xl text-[32px] font-black leading-[1.04] tracking-[-0.045em] sm:text-[40px] lg:text-[50px]">
              {topic.title}
            </h1>

            <p className="mt-4 max-w-3xl text-[11px] font-medium leading-5 text-white/60 sm:text-[12px] md:leading-6">
              {topic.intro}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/support"
                className="inline-flex h-10 items-center gap-2 rounded-[13px] bg-[#c69258] px-4 text-[9px] font-black text-[#173C2E] transition hover:brightness-105"
              >
                Submit a ticket
                <IoArrowForwardOutline size={13} />
              </Link>

              <a
                href="mailto:support@ekarihub.com"
                className="inline-flex h-10 items-center gap-2 rounded-[13px] border border-white/12 bg-white/[0.06] px-4 text-[9px] font-black text-white/80 transition hover:bg-white/[0.11]"
              >
                <IoMailOutline size={13} />
                Email support
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          CONTENT
      ========================================================= */}
      <section className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 md:py-8 lg:px-8">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:gap-8">
          {/* MAIN GUIDE */}
          <div className="min-w-0 space-y-5">
            <section className="rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] p-5 shadow-[0_8px_24px_rgba(15,23,42,0.035)] sm:p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[#E8ECE8] text-[#173C2E]">
                  <Icon size={18} />
                </span>

                <div>
                  <div className="text-[8px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                    Helpful steps
                  </div>

                  <h2 className="mt-1 text-[18px] font-black tracking-[-0.03em] text-slate-900">
                    What to check first
                  </h2>

                  <p className="mt-1 text-[9px] font-medium leading-4 text-slate-400">
                    Try these steps before submitting a ticket.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {topic.guides.map(
                  (item, index) => (
                    <GuideStep
                      key={item}
                      number={index + 1}
                      text={item}
                    />
                  )
                )}
              </div>
            </section>

            <section className="rounded-[20px] border border-[#DDD8CC] bg-[#173C2E] p-5 text-white shadow-[0_10px_28px_rgba(23,60,46,0.12)] sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-2xl">
                  <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                    Still need help?
                  </div>

                  <h3 className="mt-1 text-[17px] font-black tracking-[-0.03em]">
                    Submit a support ticket.
                  </h3>

                  <p className="mt-1 text-[9px] font-medium leading-4 text-white/50">
                    Share the details with our team and we&apos;ll respond within 24 hours.
                  </p>
                </div>

                <Link
                  href="/support"
                  className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[12px] bg-[#c69258] px-4 text-[9px] font-black text-[#173C2E] transition hover:brightness-105"
                >
                  Submit a ticket
                  <IoArrowForwardOutline size={13} />
                </Link>
              </div>
            </section>
          </div>

          {/* RIGHT RAIL */}
          <aside className="min-w-0 space-y-4 lg:sticky lg:top-5 lg:self-start">
            <div className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4">
              <div className="text-[8px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                Contact us
              </div>

              <a
                href="mailto:support@ekarihub.com"
                className="mt-3 flex items-center gap-3 rounded-[13px] border border-[#E5E0D6] bg-white p-3 transition hover:bg-[#F3F1EB]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#E8ECE8] text-[#173C2E]">
                  <IoMailOutline size={15} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[9px] font-black text-slate-700">
                    Email support
                  </span>

                  <span className="mt-0.5 block truncate text-[8px] font-semibold text-slate-400">
                    support@ekarihub.com
                  </span>
                </span>

                <IoChevronForwardOutline
                  size={12}
                  className="shrink-0 text-slate-300"
                />
              </a>
            </div>

            <div className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[#FFF2DF] text-[#c69258]">
                  <IoTimeOutline size={17} />
                </span>

                <div>
                  <div className="text-[9px] font-black text-slate-700">
                    Response time
                  </div>

                  <p className="mt-1 text-[8px] font-medium leading-4 text-slate-400">
                    Email and support tickets are typically reviewed within 24 hours.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4">
              <div className="text-[8px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                Explore support
              </div>

              <div className="mt-3 space-y-1.5">
                {(
                  Object.entries(
                    TOPIC_CONTENT
                  ) as [
                    keyof typeof TOPIC_CONTENT,
                    (typeof TOPIC_CONTENT)[keyof typeof TOPIC_CONTENT]
                  ][]
                ).map(([key, item]) => {
                  const TopicIcon =
                    item.icon;

                  const active =
                    key === topicKey;

                  return (
                    <Link
                      key={key}
                      href={`/support/${key}`}
                      className={[
                        "group flex items-center gap-3 rounded-[12px] px-2.5 py-2.5 transition",
                        active
                          ? "bg-[#E8ECE8]"
                          : "hover:bg-[#F3F1EB]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "grid h-9 w-9 shrink-0 place-items-center rounded-[11px]",
                          active
                            ? "bg-[#173C2E] text-white"
                            : "bg-[#E8ECE8] text-[#173C2E]",
                        ].join(" ")}
                      >
                        <TopicIcon size={14} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span
                          className={[
                            "block text-[8px] font-black",
                            active
                              ? "text-[#173C2E]"
                              : "text-slate-700",
                          ].join(" ")}
                        >
                          {item.label}
                        </span>

                        <span className="mt-0.5 block text-[7px] font-medium text-slate-400">
                          Support guide
                        </span>
                      </span>

                      <IoChevronForwardOutline
                        size={12}
                        className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5"
                      />
                    </Link>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function GuideStep({
  number,
  text,
}: {
  number: number;
  text: string;
}) {
  return (
    <div className="flex gap-3 rounded-[15px] border border-[#E5E0D6] bg-white p-3.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#E8ECE8] text-[8px] font-black text-[#173C2E]">
        {String(number).padStart(2, "0")}
      </span>

      <div className="min-w-0 pt-1 text-[9px] font-medium leading-4 text-slate-500 sm:text-[10px]">
        {text}
      </div>
    </div>
  );
}