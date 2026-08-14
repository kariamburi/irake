"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import {
  IoArrowBackOutline,
  IoArrowForwardOutline,
  IoBriefcaseOutline,
  IoOpenOutline,
  IoPeopleOutline,
  IoPersonOutline,
  IoRibbonOutline,
  IoSparklesOutline,
} from "react-icons/io5";

import { getExecBySlug } from "@/app/components/executives";
import { Footer } from "@/app/components/Footer";
import { Topbar } from "@/app/components/Topbar";

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

const EASE_OUT: [number, number, number, number] = [
  0.16, 1, 0.3, 1,
];

export default function ExecProfilePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const slug = params?.slug;
  const exec = getExecBySlug(slug);

  /* =========================================================
     PROFILE NOT FOUND
  ========================================================= */
  if (!exec) {
    return (
      <main
        className={[
          "min-h-[100svh] w-full max-w-full",
          "overflow-x-hidden bg-[#F8F7F2]",
          "touch-pan-y",
        ].join(" ")}
        style={{
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y",
        }}
      >
        <Topbar />

        <section className="relative overflow-hidden bg-[#173C2E] text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.045]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.75) 18px 19px)",
            }}
          />

          <div className="relative mx-auto max-w-[1280px] px-5 py-12 sm:px-7 lg:px-8">
            <div className="max-w-xl">
              <div
                className={[
                  "grid h-12 w-12 place-items-center",
                  "rounded-[14px] bg-white/[0.08]",
                  "text-[#c69258]",
                ].join(" ")}
              >
                <IoPersonOutline size={21} />
              </div>

              <div className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-[#c69258]">
                Executive profile
              </div>

              <h1 className="mt-1 text-[30px] font-black tracking-[-0.04em]">
                Profile not found.
              </h1>

              <p className="mt-2 text-[10px] font-medium leading-5 text-white/55">
                This executive profile may no longer be available
                or the address may be incorrect.
              </p>

              <button
                type="button"
                onClick={() =>
                  router.push("/leadership/executives")
                }
                className={[
                  "mt-5 inline-flex h-10 items-center gap-2",
                  "rounded-[12px] bg-[#c69258] px-4",
                  "text-[9px] font-black text-[#173C2E]",
                ].join(" ")}
              >
                <IoArrowBackOutline size={13} />
                Back to executives
              </button>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    );
  }

  return (
    <main
      className={[
        "min-h-[100svh] w-full max-w-full",
        "overflow-x-hidden bg-[#F8F7F2]",
        "touch-pan-y",
      ].join(" ")}
      style={{
        WebkitOverflowScrolling: "touch",
        touchAction: "pan-y",
      }}
    >
      <Topbar />

      {/* =========================================================
          EXECUTIVE HERO
      ========================================================= */}
      <section
        className={[
          "relative overflow-hidden",
          "border-b border-[#DDD8CC]",
          "bg-[#173C2E] text-white",
        ].join(" ")}
      >
        {/* diagonal texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.75) 18px 19px)",
          }}
        />

        {/* background decorations */}
        <div
          className={[
            "pointer-events-none absolute",
            "-right-24 -top-20",
            "h-72 w-72 rounded-full",
            "bg-white/[0.035]",
          ].join(" ")}
        />

        <div
          className={[
            "pointer-events-none absolute",
            "-bottom-32 left-[30%]",
            "h-80 w-80 rounded-full",
            "bg-[#c69258]/[0.08]",
          ].join(" ")}
        />

        <div
          className={[
            "relative mx-auto grid w-full max-w-[1280px]",
            "gap-8 px-5 py-8",
            "sm:px-7 md:py-10",
            "lg:grid-cols-[340px_minmax(0,1fr)]",
            "lg:items-center lg:gap-12 lg:px-8",
          ].join(" ")}
        >
          {/* ================= PHOTO ================= */}
          <motion.div
            initial={
              reduceMotion
                ? { opacity: 1, y: 0 }
                : { opacity: 0, y: 8 }
            }
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.28,
              ease: EASE_OUT,
            }}
            className={[
              "relative mx-auto w-full max-w-[340px]",
              "overflow-hidden rounded-[22px]",
              "border border-white/10",
              "bg-white/[0.04] p-2",
              "shadow-[0_20px_60px_rgba(0,0,0,0.18)]",
              "lg:mx-0",
            ].join(" ")}
          >
            <div
              className={[
                "relative aspect-[4/5] w-full",
                "overflow-hidden rounded-[17px]",
                "bg-[#214C3A]",
              ].join(" ")}
            >
              <Image
                src={exec.photo}
                alt={exec.name}
                fill
                priority
                sizes="(max-width: 1024px) 90vw, 340px"
                className="object-cover"
              />

              {/* image gradient */}
              <div
                className={[
                  "pointer-events-none absolute inset-x-0 bottom-0",
                  "bg-gradient-to-t",
                  "from-black/65 via-black/15 to-transparent",
                  "px-4 pb-4 pt-20",
                ].join(" ")}
              >
                <div className="text-[8px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                  Executive leadership
                </div>

                <div className="mt-1 text-[11px] font-black text-white">
                  ekarihub
                </div>
              </div>
            </div>
          </motion.div>

          {/* ================= PROFILE INTRO ================= */}
          <motion.div
            initial={
              reduceMotion
                ? { opacity: 1, y: 0 }
                : { opacity: 0, y: 8 }
            }
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.3,
              delay: reduceMotion ? 0 : 0.04,
              ease: EASE_OUT,
            }}
            className="min-w-0"
          >
            <button
              type="button"
              onClick={() =>
                router.push("/leadership/executives")
              }
              className={[
                "mb-5 inline-flex h-9 items-center gap-2",
                "rounded-[11px]",
                "border border-white/10",
                "bg-white/[0.06] px-3",
                "text-[8px] font-black text-white/65",
                "transition hover:bg-white/[0.1]",
              ].join(" ")}
            >
              <IoArrowBackOutline size={12} />
              All executives
            </button>

            <div className="flex flex-wrap gap-2">
              <span
                className={[
                  "inline-flex items-center gap-1.5",
                  "rounded-full",
                  "border border-white/10",
                  "bg-white/[0.06]",
                  "px-3 py-1.5",
                  "text-[8px] font-black uppercase",
                  "tracking-[0.08em] text-white/70",
                ].join(" ")}
              >
                <IoRibbonOutline
                  size={11}
                  className="text-[#c69258]"
                />
                Executive
              </span>

              <span
                className={[
                  "inline-flex items-center gap-1.5",
                  "rounded-full",
                  "border border-white/10",
                  "bg-white/[0.06]",
                  "px-3 py-1.5",
                  "text-[8px] font-black uppercase",
                  "tracking-[0.08em] text-white/70",
                ].join(" ")}
              >
                <IoBriefcaseOutline
                  size={11}
                  className="text-[#c69258]"
                />
                Leadership
              </span>
            </div>

            <div className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-[#c69258]">
              Meet the leadership
            </div>

            <h1
              className={[
                "mt-1 max-w-3xl",
                "text-[32px] font-black",
                "leading-[1.04]",
                "tracking-[-0.045em]",
                "sm:text-[40px] lg:text-[48px]",
              ].join(" ")}
            >
              {exec.name}
            </h1>

            <div
              className={[
                "mt-3 inline-flex items-center gap-2",
                "rounded-[11px]",
                "border border-white/10",
                "bg-white/[0.06]",
                "px-3 py-2",
              ].join(" ")}
            >
              <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-[#c69258]/15 text-[#c69258]">
                <IoBriefcaseOutline size={13} />
              </span>

              <span className="text-[10px] font-black text-white/80">
                {exec.title}
              </span>
            </div>

            <p className="mt-5 max-w-2xl text-[10px] font-medium leading-5 text-white/50 sm:text-[11px]">
              Part of the executive leadership team shaping
              ekarihub&apos;s strategy, growth and long-term impact
              across the agribusiness ecosystem.
            </p>

            {!!exec.links?.length && (
              <div className="mt-6 flex flex-wrap gap-2">
                {exec.links.map((link) => {
                  const external =
                    link.href.startsWith("http");

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      target={
                        external
                          ? "_blank"
                          : undefined
                      }
                      rel={
                        external
                          ? "noopener noreferrer"
                          : undefined
                      }
                      className={[
                        "inline-flex h-9 items-center gap-2",
                        "rounded-[11px]",
                        "border border-white/12",
                        "bg-white/[0.06]",
                        "px-3",
                        "text-[8px] font-black",
                        "text-white/75",
                        "transition",
                        "hover:bg-white/[0.11]",
                      ].join(" ")}
                    >
                      {link.label}

                      {external ? (
                        <IoOpenOutline size={12} />
                      ) : (
                        <IoArrowForwardOutline
                          size={12}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* =========================================================
          PROFILE CONTENT
      ========================================================= */}
      <section
        className={[
          "mx-auto w-full max-w-[1280px]",
          "px-4 py-6",
          "sm:px-6 md:py-8 lg:px-8",
        ].join(" ")}
      >
        <div
          className={[
            "grid gap-5",
            "lg:grid-cols-[minmax(0,1fr)_280px]",
          ].join(" ")}
        >
          {/* =====================================================
              BIOGRAPHY
          ===================================================== */}
          <motion.article
            initial={
              reduceMotion
                ? { opacity: 1, y: 0 }
                : { opacity: 0, y: 6 }
            }
            whileInView={{
              opacity: 1,
              y: 0,
            }}
            viewport={{
              once: true,
              amount: 0.1,
            }}
            transition={{
              duration: 0.22,
              ease: EASE_OUT,
            }}
            className={[
              "rounded-[18px]",
              "border border-[#DDD8CC]",
              "bg-[#FBFAF6]",
              "p-5 sm:p-6",
              "shadow-[0_8px_24px_rgba(15,23,42,0.03)]",
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              <span
                className={[
                  "grid h-10 w-10 shrink-0",
                  "place-items-center",
                  "rounded-[12px]",
                  "bg-[#E8ECE8]",
                  "text-[#173C2E]",
                ].join(" ")}
              >
                <IoPersonOutline size={17} />
              </span>

              <div>
                <div className="text-[8px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                  Executive profile
                </div>

                <h2 className="mt-1 text-[18px] font-black tracking-[-0.03em] text-slate-900">
                  About {exec.name}
                </h2>
              </div>
            </div>

            <div
              className={[
                "mt-5 space-y-4",
                "text-[10px] font-medium",
                "leading-5 text-slate-500",
                "sm:text-[11px] sm:leading-6",
              ].join(" ")}
            >
              {exec.bio.map(
                (
                  paragraph: string,
                  index: number
                ) => (
                  <p key={index}>
                    {paragraph}
                  </p>
                )
              )}
            </div>

            {!!exec.links?.length && (
              <>
                <div className="my-6 h-px bg-[#E8E3D8]" />

                <div>
                  <div className="text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">
                    Connect & learn more
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {exec.links.map((link) => {
                      const external =
                        link.href.startsWith(
                          "http"
                        );

                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          target={
                            external
                              ? "_blank"
                              : undefined
                          }
                          rel={
                            external
                              ? "noopener noreferrer"
                              : undefined
                          }
                          className={[
                            "inline-flex h-9 items-center gap-2",
                            "rounded-[11px]",
                            "border border-[#DDD8CC]",
                            "bg-white px-3",
                            "text-[8px] font-black",
                            "text-[#173C2E]",
                            "transition",
                            "hover:bg-[#EEF3EE]",
                          ].join(" ")}
                        >
                          {link.label}

                          {external ? (
                            <IoOpenOutline
                              size={12}
                            />
                          ) : (
                            <IoArrowForwardOutline
                              size={12}
                            />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </motion.article>

          {/* =====================================================
              RIGHT RAIL
          ===================================================== */}
          <aside className="space-y-4">
            <div
              className={[
                "rounded-[18px]",
                "border border-[#DDD8CC]",
                "bg-[#FBFAF6]",
                "p-4",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <span
                  className={[
                    "grid h-10 w-10 shrink-0",
                    "place-items-center",
                    "rounded-[12px]",
                    "bg-[#FFF2DF]",
                    "text-[#c69258]",
                  ].join(" ")}
                >
                  <IoSparklesOutline size={17} />
                </span>

                <div className="min-w-0">
                  <div className="text-[9px] font-black text-slate-700">
                    Executive leadership
                  </div>

                  <p className="mt-1 text-[8px] font-medium leading-4 text-slate-400">
                    Meet the people helping shape
                    ekarihub&apos;s strategy,
                    technology, partnerships and
                    growth.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/leadership/executives"
                )
              }
              className={[
                "group flex w-full items-center",
                "gap-3 rounded-[18px]",
                "border border-[#DDD8CC]",
                "bg-[#FBFAF6] p-4 text-left",
                "transition hover:bg-white",
              ].join(" ")}
            >
              <span
                className={[
                  "grid h-10 w-10 shrink-0",
                  "place-items-center",
                  "rounded-[12px]",
                  "bg-[#E8ECE8]",
                  "text-[#173C2E]",
                ].join(" ")}
              >
                <IoPeopleOutline size={17} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-[9px] font-black text-slate-700">
                  Executive team
                </span>

                <span className="mt-1 block text-[8px] font-medium text-slate-400">
                  View all executives
                </span>
              </span>

              <IoArrowForwardOutline
                size={13}
                className={[
                  "text-slate-300",
                  "transition-transform",
                  "group-hover:translate-x-0.5",
                ].join(" ")}
              />
            </button>

            <button
              type="button"
              onClick={() =>
                router.push("/leadership")
              }
              className={[
                "group flex w-full items-center",
                "gap-3 rounded-[18px]",
                "bg-[#173C2E] p-4 text-left",
                "text-white",
                "shadow-[0_10px_24px_rgba(23,60,46,0.12)]",
                "transition hover:bg-[#214C3A]",
              ].join(" ")}
            >
              <span
                className={[
                  "grid h-10 w-10 shrink-0",
                  "place-items-center",
                  "rounded-[12px]",
                  "bg-white/10",
                  "text-[#c69258]",
                ].join(" ")}
              >
                <IoRibbonOutline size={17} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-[9px] font-black">
                  Leadership
                </span>

                <span className="mt-1 block text-[8px] font-medium text-white/45">
                  Explore our leadership vision
                </span>
              </span>

              <IoArrowForwardOutline
                size={13}
                className={[
                  "text-white/40",
                  "transition-transform",
                  "group-hover:translate-x-0.5",
                ].join(" ")}
              />
            </button>
          </aside>
        </div>
      </section>

      <Footer />
    </main>
  );
}