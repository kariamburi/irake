"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { EKARI } from "../constants/constants";
import { EXECUTIVES } from "../components/executives";
import BackBar from "../components/BackBar";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

export default function AboutHeroPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      <BackBar label="Back to Home" href="/" />
      {/* Header section like Meta hero */}
      <header
        className="py-8 px-6 md:py-12 border-b"
        style={{ borderColor: EKARI.hair }}
      >
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8 md:gap-12 items-center">

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.7 }}
            className="space-y-4"
          >
            <h1
              className="text-4xl md:text-5xl font-black leading-tight"
              style={{ color: EKARI.text }}
            >
              Meet our leadership
            </h1>
            <p className="text-lg md:text-xl" style={{ color: EKARI.dim }}>
              ekarihub’s leaders are guiding our company as mixed reality and AI
              evolve, helping to create the next evolution of agribusiness
              connection.
            </p>

            <button
              onClick={() => router.push("/about/executives")}
              className="mt-2 inline-flex items-center gap-2 rounded-full px-5 py-3 font-extrabold text-white"
              style={{ backgroundColor: EKARI.gold }}
            >
              Get to know our leadership
              <ChevronRight size={18} />
            </button>
          </motion.div>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="relative aspect-[4/4] w-full rounded-3xl overflow-hidden"
          >
            <Image src="/ceo.jpg" alt="Leadership" fill className="object-cover" priority />
          </motion.div>
        </div>
      </header>

      {/* Quick peeks (optional) */}


      <footer className="mt-12 border-t" style={{ borderColor: EKARI.hair }}>
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
          <Image
            src="/ekarihub-logo.png"
            alt="ekarihub"
            width={160}
            height={36}
            className="object-contain"
          />
          <div className="text-sm" style={{ color: EKARI.dim }}>
            © {new Date().getFullYear()} ekarihub
          </div>
        </div>
      </footer>
    </div>
  );
}
