"use client";

import React from "react";
import { useAuth } from "@/app/hooks/useAuth";
import { LeftNavDesktop, LeftRailCompact } from "./MainNav";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

/* Same theme */
const EKARI = {
    bg: "#ffffff",
};

export default function AppShell({
    children,
    rightRail,
    className = "",
    handle,
}: {
    children: React.ReactNode;
    rightRail?: React.ReactNode; // pass your RightRail if you want
    className?: string;
    handle?: string
}) {
    const { user } = useAuth();
    const uid = user?.uid;
    // NEW: if no prop, default to signed-in user's handle
    // NEW: live-subscribe to the user doc to get handle (with the leading @)
    const [myHandle, setMyHandle] = React.useState<string | undefined>(undefined);

    React.useEffect(() => {
        if (!uid) { setMyHandle(undefined); return; }
        const unsub = onSnapshot(doc(db, "users", uid), (s) => {
            const h = (s.data() as any)?.handle as string | undefined;
            setMyHandle(h && h.length ? h : undefined);
        });
        return () => unsub();
    }, [uid]);

    // Prefer explicit prop, else derived from Firestore
    const effectiveHandle = handle ?? myHandle;

    return (
        <div className={`min-h-screen ${className}`} style={{ backgroundColor: EKARI.bg }}>
            <div className="mx-auto max-w-[1400px] flex">
                <LeftRailCompact />
                <LeftNavDesktop uid={uid} handle={effectiveHandle} />

                <main className="flex-1 mt-0 flex justify-center overflow-hidden">
                    {children}
                </main>

                {rightRail ?? null}
            </div>
        </div>
    );
}
