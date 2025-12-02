"use client";

import React from "react";
import { useAuth } from "@/app/hooks/useAuth";
import { LeftNavDesktop, LeftRailCompact } from "./MainNav";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import UserAvatarMenu from "@/app/components/UserAvatarMenu";
import LoginButton from "@/app/components/LoginButton";

/* Same theme */
const EKARI = {
    bg: "#ffffff",
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

    // Prefer explicit prop, else derived from Firestore
    const effectiveHandle = handle ?? profile?.handle;

    return (
        <div
            className={`min-h-screen ${className}`}
            style={{ backgroundColor: EKARI.bg }}
        >
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

            <div className="mx-auto max-w-[1400px] flex pr-10">
                <LeftRailCompact />
                <LeftNavDesktop uid={uid} handle={effectiveHandle} />

                <main className="pl-5 flex-1 w-full mt-0 flex justify-center overflow-hidden">
                    {children}
                </main>

                {rightRail ?? null}
            </div>
        </div>
    );
}
