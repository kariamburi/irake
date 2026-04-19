"use client";

import React from "react";
import { useAuth } from "@/app/hooks/useAuth";
import { LeftNavDesktop, LeftRailCompact } from "./MainNav";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import UserAvatarMenu from "@/app/components/UserAvatarMenu";
import LoginButton from "@/app/components/LoginButton";
import { motion } from "framer-motion";

/* Same theme */
const EKARI = {
    bg: "#ffffff",
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    ink: "#111827",
    dim: "#6B7280",
    hair: "#E5E7EB",
    bgSoft: "#F6F7F8",
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
                background:
                    "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.82))",
                backdropFilter: "blur(14px)",
                borderBottom: "1px solid rgba(199,146,87,0.18)",
            }}
        >
            {/* Top-right auth / profile action */}
            <div className="fixed right-4 top-4 z-[70] hidden lg:block">
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

            <div className="mx-auto flex min-h-screen w-full max-w-[1720px]">
                <LeftRailCompact />
                <LeftNavDesktop uid={uid} handle={effectiveHandle} />

                {/* Center stage */}
                <main className="min-w-0 flex-1">
                    <div className="flex min-h-screen w-full items-stretch justify-center">
                        <motion.div
                            className="flex w-full min-w-0 justify-center"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                        >
                            {/* TikTok-like stage: no dashboard card shell */}
                            <div className="flex w-full min-w-0 justify-center overflow-visible">
                                {children}
                            </div>
                        </motion.div>
                    </div>
                </main>

                {/* Optional right rail area */}
                {rightRail ? (
                    <motion.aside
                        className="hidden xl:block shrink-0 pr-4 pt-4"
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.22, delay: 0.04, ease: "easeOut" }}
                    >
                        {rightRail}
                    </motion.aside>
                ) : null}
            </div>
        </div>
    );
}