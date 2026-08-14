"use client";

import React from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { motion } from "framer-motion";

import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import { LeftNavDesktop, LeftRailCompact } from "./MainNav";

type ProfileState = {
  handle?: string;
  photoURL?: string;
};

type AppShellProps = {
  children: React.ReactNode;
  rightRail?: React.ReactNode;
  className?: string;
  handle?: string;
};

export default function AppShell({
  children,
  rightRail,
  className = "",
  handle,
}: AppShellProps) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [profile, setProfile] = React.useState<ProfileState | null>(null);

  React.useEffect(() => {
    if (!uid) {
      setProfile(null);
      return;
    }

    return onSnapshot(doc(db, "users", uid), (snapshot) => {
      const data = snapshot.data() as ProfileState | undefined;

      setProfile(
        data
          ? {
            handle: data.handle || undefined,
            photoURL: data.photoURL || undefined,
          }
          : null,
      );
    });
  }, [uid]);

  const effectiveHandle = handle ?? profile?.handle;

  return (
    <div
      className={[
        "h-[100svh] w-full overflow-hidden bg-[#0B1D12]",
        className,
      ].join(" ")}
    >
      <div className="flex h-full w-full">
        {/* Compact/mobile rail */}
        <LeftRailCompact />

        {/* Desktop left sidebar */}
        <LeftNavDesktop
          uid={uid}
          handle={effectiveHandle}
          photoURL={
            profile?.photoURL ??
            user?.photoURL ??
            null
          }
        />

        {/* Main application area */}
        <main className="min-w-0 flex-1 overflow-hidden bg-[#0B1D12]">
          <div className="mx-auto flex h-full w-full max-w-[1600px]">
            {/* Deed feed */}
            <motion.div
              className="relative min-w-0 flex-1 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {children}
            </motion.div>

            {/* Right discovery rail */}
            {rightRail ? (
              <aside className="hidden h-full w-[310px] shrink-0 overflow-hidden border-l border-white/10 bg-[#0D1510] 2xl:block 2xl:w-[330px]">
                {rightRail}
              </aside>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}