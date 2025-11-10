"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import BackBar from "@/app/components/BackBar";
import { EKARI } from "@/app/constants/constants";
import { EXECUTIVES } from "@/app/components/executives";
import { Footer } from "@/app/components/Footer";
import { Topbar } from "@/app/components/Topbar";


export default function ExecutivesPage() {
  const router = useRouter();

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <Topbar />
      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-2xl md:text-3xl font-black mt-4 mb-6"
        style={{ color: EKARI.text }}
      >
        Executives
      </motion.h2>

      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { staggerChildren: 0.06 } },
        }}
        className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {EXECUTIVES.slice(0, 1).map((e: any) => (
          <motion.button
            key={e.slug}
            variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
            onClick={() => router.push(`/about/executives/${e.slug}`)}
            className="text-left rounded-2xl overflow-hidden border bg-white hover:shadow-md transition"
            style={{ borderColor: EKARI.hair }}
          >
            <div className="relative w-full aspect-[4/3]">
              <Image src={e.photo} alt={e.name} fill className="object-cover" />
            </div>
            <div className="p-4">
              <div className="font-black" style={{ color: EKARI.text }}>
                {e.name}
              </div>
              <div className="text-sm" style={{ color: EKARI.dim }}>
                {e.title}
              </div>
            </div>
          </motion.button>
        ))}
      </motion.div>

      {/* -------------------- FOOTER -------------------- */}
      <Footer />
    </main>
  );
}
