"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./hooks/useAuth";

const THEME = { forest: "#233F39", gold: "#C79257", white: "#FFFFFF" };

export default function SplashPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const redirectedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    router.prefetch("/deeds");
    router.prefetch("/getstarted");
  }, [router]);

  useEffect(() => {
    if (authLoading || redirectedRef.current) return;

    let next = "/getstarted";

    (async () => {
      try {
        if (user?.uid) {
          const snap = await getDoc(doc(db, "users", user.uid));
          const data = snap.exists() ? (snap.data() as { handle?: string }) : undefined;

          const hasHandle =
            typeof data?.handle === "string" && data.handle.trim().length > 0;

          next = hasHandle ? "/deeds" : "/getstarted";
        }
      } catch (err) {
        console.error("[Splash] Firestore read error:", err);
      }

      timerRef.current = setTimeout(() => {
        if (!redirectedRef.current) {
          redirectedRef.current = true;
          router.replace(next);
        }
      }, 900);
    })();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [authLoading, user?.uid, router]);

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: THEME.forest }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 140, damping: 16, mass: 0.6 }}
      >
        <Image
          src="/ekarihub-logo-green.png"
          alt="ekarihub"
          width={320}
          height={86}
          onError={(e) => ((e.currentTarget as HTMLImageElement).src = "/ekarihub-logo.png")}
          priority
        />
      </motion.div>
    </main>
  );
}
