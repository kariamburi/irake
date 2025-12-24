"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { EKARI } from "../constants/constants";
import { EXECUTIVES } from "../components/executives";
import { Footer } from "../components/Footer";
import { Topbar } from "../components/Topbar";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

export default function AboutHeroPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      <Topbar />

      {/* Hero */}
      <header className="py-8 px-6 md:py-12" style={{ borderColor: EKARI.hair }}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <motion.div {...fadeUp} transition={{ duration: 0.7 }} className="space-y-4">
            <h1
              className="text-4xl md:text-5xl font-black leading-tight"
              style={{ color: EKARI.forest }}
            >
              Meet Our Leadership
            </h1>

            <p className="text-lg md:text-xl" style={{ color: EKARI.dim }}>
              At ekarihub, our leaders are more than visionaries - they are architects of the
              next agribusiness revolution. Guided by data, powered by artificial intelligence,
              and inspired by mixed reality and social media, they are transforming how the world
              connects, trades, and grows within the agribusiness ecosystem.
            </p>
            <p className="text-lg md:text-xl" style={{ color: EKARI.dim }}>
              Together, they’re redefining sustainability, scalability, and social impact -
              creating an intelligent, immersive, and borderless network that empowers every
              player in the value chain, from smallholder farmers to global exporters and
              consumers.
            </p>

            <button
              onClick={() => router.push("/leadership/executives")}
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




      <Footer />
    </div>
  );
}