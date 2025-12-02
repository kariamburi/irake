"use client";

import React from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/app/hooks/useAuth";
import { LeftNavDesktop, LeftRailCompact } from "./MainNav";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import UserAvatarMenu from "@/app/components/UserAvatarMenu";
import LoginButton from "@/app/components/LoginButton";

/* Ekari theme */
const EKARI = {
    bg: "#FFFFFF",
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    ink: "#111827",
    dim: "#6B7280",
    hair: "#E5E7EB",
    bgSoft: "#F3F4F6",
};

type ProfileState = {
    handle?: string;
    photoURL?: string;
};

export default function AppShell({
    children,
    rightRail,
    className = "",
    handle,
}: {
    children: React.ReactNode;
    rightRail?: React.ReactNode;
    className?: string;
    handle?: string;
}) {
    const { user } = useAuth();
    const uid = user?.uid;

    const [profile, setProfile] = React.useState<ProfileState | null>(null);

    React.useEffect(() => {
        if (!uid) {
            setProfile(null);
            return;
        }

        const unsub = onSnapshot(doc(db, "users", uid), (s) => {
            const data = s.data() as any | undefined;
            if (!data) {
                setProfile(null);
                return;
            }
            const h = (data?.handle as string | undefined) || undefined;
            setProfile({
                handle: h && h.length ? h : undefined,
                photoURL: (data?.photoURL as string | undefined) || undefined,
            });
        });

        return () => unsub();
    }, [uid]);

    const effectiveHandle = handle ?? profile?.handle;

    return (
        <div
            className={`min-h-screen ${className}`}
            style={{
                background: `
          radial-gradient(circle at top left, ${EKARI.forest}10, transparent 55%),
          radial-gradient(circle at bottom right, ${EKARI.gold}14, ${EKARI.bgSoft})
        `,
            }}
        >
            {/* Top glass bar with user/login */}
            {/* 🔝 Global top-right user menu (visible on ALL pages using AppShell) */}
            <div className="fixed top-0 right-3 md:right-4 py-3 z-40">
                {uid ? (
                    <UserAvatarMenu
                        uid={uid}
                        photoURL={profile?.photoURL ?? undefined}
                        handle={profile?.handle}
                    />
                ) : (
                    <LoginButton />
                )}
            </div>

            <div className="fixed inset-x-0 right-3top-0 z-40">

                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="flex items-center justify-end"
                >
                    <div className="flex items-center gap-2 rounded-full bg-white/70 backdrop-blur-md border border-white/40 shadow-sm px-3 py-1.5">
                        {uid ? (
                            <UserAvatarMenu
                                uid={uid}
                                photoURL={profile?.photoURL ?? undefined}
                                handle={profile?.handle}
                            />
                        ) : (
                            <LoginButton />
                        )}
                    </div>
                </motion.div>

            </div>

            {/* Space for fixed header */}


            {/* Main layout */}
            <div className="mx-auto max-w-[1400px] flex pr-10">
                {/* Left rails */}

                <LeftRailCompact />

                <LeftNavDesktop uid={uid} handle={effectiveHandle} />

                {/* Center content */}
                <main className="pl-5 flex-1 flex justify-center">
                    <motion.div
                        className="w-full max-w-4xl"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                    >
                        <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-gray-100 shadow-[0_18px_45px_rgba(0,0,0,0.06)] overflow-hidden">
                            {children}
                        </div>
                    </motion.div>
                </main>

                {/* Right rail */}
                {rightRail && (
                    <aside className="hidden xl:block w-[400px]">
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, delay: 0.05, ease: "easeOut" }}
                            className="rounded-3xl bg-white/80 backdrop-blur-md border border-gray-100 shadow-[0_18px_45px_rgba(0,0,0,0.04)] p-4"
                        >
                            {rightRail}
                        </motion.div>
                    </aside>
                )}
            </div>
        </div>
    );
}
