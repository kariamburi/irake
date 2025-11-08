"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import BackBar from "@/app/components/BackBar";
import { getExecBySlug } from "@/app/components/executives";
import { EKARI } from "@/app/constants/constants";

export default function ExecProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const exec = getExecBySlug(slug);

  if (!exec) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-8">
        <BackBar label="Back to Executives" href="/about/executives" />
        <p className="mt-8">Profile not found.</p>
      </main>
    );
  }
  const fadeUp = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
  };

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <BackBar label="Back to Executives" href="/about/executives" />

      <div className="mt-6 grid lg:grid-cols-[1fr_1.2fr] gap-8">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="relative aspect-[4/4] w-full rounded-3xl overflow-hidden"
        >
          <Image src={exec.photo}
            alt={exec.name} fill className="object-cover" priority />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl md:text-4xl font-black" style={{ color: EKARI.text }}>
            {exec.name}
          </h1>
          <div className="mt-1 text-lg font-semibold" style={{ color: EKARI.gold }}>
            {exec.title}
          </div>

          <div className="mt-6 space-y-4 leading-relaxed" style={{ color: EKARI.text }}>
            {exec.bio.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {!!exec.links?.length && (
            <div className="mt-6 flex flex-wrap gap-2">
              {exec.links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  target={l.href.startsWith("http") ? "_blank" : undefined}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-extrabold border hover:shadow-sm transition"
                  style={{
                    color: EKARI.forest,
                    borderColor: EKARI.forest,
                    background: EKARI.sand,
                  }}
                >
                  {l.label}
                  <ExternalLink size={14} />
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* -------------------- FOOTER -------------------- */}
      <footer className="mt-6 border-t" style={{ borderColor: EKARI.hair }}>
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
    </main>
  );
}
