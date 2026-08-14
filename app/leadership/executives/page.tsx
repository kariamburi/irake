"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  IoArrowBackOutline,
  IoArrowForwardOutline,
  IoPeopleOutline,
  IoRibbonOutline,
  IoSparklesOutline,
} from "react-icons/io5";

import { EXECUTIVES } from "@/app/components/executives";
import { Footer } from "@/app/components/Footer";
import { Topbar } from "@/app/components/Topbar";

const EKARI = {
  forest: "#173C2E",
  leaf: "#214C3A",
  gold: "#F39A22",
  page: "#F8F7F2",
  surface: "#FBFAF6",
  border: "#DDD8CC",
  text: "#0F172A",
  dim: "#64748B",
};

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.22,
      ease: EASE_OUT,
    },
  },
};

export default function ExecutivesPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  return (
    <main
      className="min-h-[100svh] w-full max-w-full overflow-x-clip bg-[#F8F7F2] touch-pan-y"
      style={{
        WebkitOverflowScrolling: "touch",
        touchAction: "pan-y",
      }}
    >
      <Topbar />

      {/* ============================================================
          FULL-WIDTH HERO
      ============================================================ */}
      <section className="relative overflow-hidden border-b border-[#DDD8CC] bg-[#173C2E] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.75) 18px 19px)",
          }}
        />

        <div className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full bg-white/[0.035]" />
        <div className="pointer-events-none absolute -bottom-28 left-[32%] h-72 w-72 rounded-full bg-[#F39A22]/[0.08]" />

        <div className="relative mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-7 md:py-14 lg:px-8">
          <motion.div
            initial={
              reduceMotion
                ? { opacity: 1, y: 0 }
                : { opacity: 0, y: 8 }
            }
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.24,
              ease: "easeOut",
            }}
            className="max-w-[760px]"
          >
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/70">
                <IoRibbonOutline
                  size={12}
                  className="text-[#F39A22]"
                />
                Executive team
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/70">
                <IoPeopleOutline
                  size={12}
                  className="text-[#F39A22]"
                />
                Leadership
              </span>
            </div>

            <div className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-[#F39A22]">
              People shaping ekarihub
            </div>

            <h1 className="mt-1 max-w-3xl text-[32px] font-black leading-[1.04] tracking-[-0.045em] sm:text-[40px] lg:text-[50px]">
              Meet our executive team.
            </h1>

            <p className="mt-4 max-w-3xl text-[11px] font-medium leading-5 text-white/60 sm:text-[12px] md:leading-6">
              Explore the leaders responsible for strategy, technology,
              growth, partnerships and the long-term direction of ekarihub.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push("/leadership")}
                className="inline-flex h-10 items-center gap-2 rounded-[13px] border border-white/12 bg-white/[0.06] px-4 text-[9px] font-black text-white/80 transition hover:bg-white/[0.11] active:scale-[0.98]"
              >
                <IoArrowBackOutline size={13} />
                Leadership overview
              </button>

              <button
                type="button"
                onClick={() => router.push("/about")}
                className="inline-flex h-10 items-center gap-2 rounded-[13px] bg-[#F39A22] px-4 text-[9px] font-black text-[#173C2E] transition hover:brightness-105 active:scale-[0.98]"
              >
                About ekarihub
                <IoArrowForwardOutline size={13} />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============================================================
          EXECUTIVE GRID
      ============================================================ */}
      <section className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 md:py-8 lg:px-8">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
              Executive leadership
            </div>

            <h2 className="mt-1 text-[20px] font-black tracking-[-0.03em] text-slate-900 sm:text-[22px]">
              The team behind the vision.
            </h2>

            <p className="mt-1 max-w-2xl text-[10px] font-medium leading-5 text-slate-400">
              Select an executive to learn more about their role, experience
              and contribution to ekarihub&apos;s mission.
            </p>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-[12px] border border-[#DDD8CC] bg-[#FBFAF6] px-3 py-2">
            <IoSparklesOutline
              size={13}
              className="text-[#F39A22]"
            />
            <span className="text-[8px] font-black text-slate-500">
              {EXECUTIVES.length} executive
              {EXECUTIVES.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <motion.div
          initial={reduceMotion ? "show" : "hidden"}
          animate="show"
          variants={container}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {EXECUTIVES.map((executive: any) => (
            <motion.button
              key={executive.slug}
              type="button"
              variants={item}
              onClick={() =>
                router.push(
                  `/leadership/executives/${executive.slug}`
                )
              }
              whileHover={
                reduceMotion
                  ? undefined
                  : { y: -2 }
              }
              className={[
                "group overflow-hidden rounded-[18px] border border-[#DDD8CC]",
                "bg-[#FBFAF6] text-left",
                "shadow-[0_8px_24px_rgba(15,23,42,0.03)]",
                "transition-all duration-200",
                "hover:border-[#CFC7B8] hover:bg-white",
                "hover:shadow-[0_14px_34px_rgba(15,23,42,0.07)]",
                "active:scale-[0.995]",
              ].join(" ")}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#ECE9E2]">
                <Image
                  src={executive.passport}
                  alt={executive.name}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.015]"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />

                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent px-4 pb-3 pt-12">
                  <div className="text-[8px] font-black uppercase tracking-[0.08em] text-[#F39A22]">
                    Executive
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-black text-slate-900">
                    {executive.name}
                  </div>

                  <div className="mt-1 truncate text-[9px] font-medium text-slate-400">
                    {executive.title}
                  </div>
                </div>

                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#E8ECE8] text-[#173C2E] transition group-hover:bg-[#173C2E] group-hover:text-white">
                  <IoArrowForwardOutline size={14} />
                </span>
              </div>
            </motion.button>
          ))}
        </motion.div>

        <div className="mt-6 rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
                Leadership
              </div>

              <h3 className="mt-1 text-[17px] font-black tracking-[-0.03em] text-slate-900">
                See the bigger leadership story.
              </h3>

              <p className="mt-1 text-[9px] font-medium leading-4 text-slate-400">
                Learn more about the leadership principles, purpose and
                direction guiding ekarihub.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/leadership")}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[12px] bg-[#173C2E] px-4 text-[9px] font-black text-white transition hover:bg-[#214C3A] active:scale-[0.98]"
            >
              Leadership overview
              <IoArrowForwardOutline size={13} />
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}