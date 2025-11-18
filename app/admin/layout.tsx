// app/admin/layout.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/app/hooks/useAuth";
import UserAvatarMenu from "@/app/components/UserAvatarMenu";
import { IoAlertCircleOutline } from "react-icons/io5";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from "next/image";
const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
};

// 👉 Central place to define ALL admin menus
const NAV_ITEMS: { href: string; label: string }[] = [
    { href: "/admin/overview", label: "Overview" },
    { href: "/admin/deeds", label: "Deeds" },
    { href: "/admin/market", label: "Market" },
    { href: "/admin/events", label: "Events" },
    { href: "/admin/discussions", label: "Discussions" },
    { href: "/admin/wallets", label: "Creator earnings" },

    // 🔽 If you had more before, keep/add them here:
    { href: "/admin/support-tickets", label: "Support tickets" },
    { href: "/admin/sounds", label: "Sounds library" },
    { href: "/admin/usermangement", label: "User mangement" },
    // e.g. { href: "/admin/users", label: "Users" },
];

function getAdminTitle(pathname: string): string {
    if (!pathname.startsWith("/admin")) return "Admin";

    if (pathname.startsWith("/admin/overview")) return "Overview";
    if (pathname.startsWith("/admin/deeds")) return "Deeds moderation";
    if (pathname.startsWith("/admin/market")) return "Market listings";
    if (pathname.startsWith("/admin/events")) return "Events";
    if (pathname.startsWith("/admin/discussions")) return "Discussions";
    if (pathname.startsWith("/admin/wallets")) return "Creator earnings";
    if (pathname.startsWith("/admin/support-tickets")) return "Support tickets";
    if (pathname.startsWith("/admin/sounds")) return "Sounds library";
    if (pathname.startsWith("/admin/usermangement")) return "User mangement";
    // add more mappings as you add menus

    return "Admin";
}

// Left navigation using EKARI theme + all nav items
function AdminNav() {
    const pathname = usePathname();

    return (
        <nav className="flex flex-col gap-1 mt-4">
            {NAV_ITEMS.map((item) => {
                const active =
                    pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={[
                            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition",
                            active
                                ? "shadow-sm"
                                : "hover:bg-black/10 hover:text-white",
                        ].join(" ")}
                        style={
                            active
                                ? {
                                    backgroundColor: EKARI.sand,
                                    color: EKARI.forest,
                                }
                                : {
                                    color: "rgba(255,255,255,0.86)",
                                }
                        }
                    >
                        <span>{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
function useUserProfile(uid?: string) {
    const [profile, setProfile] = useState<{ handle?: string; photoURL?: string } | null>(null);

    useEffect(() => {
        if (!uid) { setProfile(null); return; }
        const ref = doc(db, "users", uid);
        const unsub = onSnapshot(ref, (snap) => {
            const data = snap.data() as any | undefined;
            setProfile({
                handle: data?.handle,
                photoURL: data?.photoURL,
            });
        });
        return () => unsub();
    }, [uid]);

    return profile;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const [checking, setChecking] = React.useState(true);
    const [isAdmin, setIsAdmin] = React.useState(false);
    const uid = user?.uid;
    const profile = useUserProfile(uid);
    // Client-side guard: only users with admin claim can stay here
    React.useEffect(() => {
        let cancelled = false;

        async function check() {
            if (!user) {
                setChecking(false);
                setIsAdmin(false);
                router.replace("/login?next=/admin/overview");
                return;
            }
            try {
                const tokenResult = await user.getIdTokenResult();
                const flag = !!(tokenResult.claims as any)?.admin;

                if (!cancelled) {
                    setIsAdmin(flag);
                    setChecking(false);
                    if (!flag) {
                        router.replace("/");
                    }
                }
            } catch (err) {
                console.error("Admin claim check failed:", err);
                if (!cancelled) {
                    setIsAdmin(false);
                    setChecking(false);
                    router.replace("/");
                }
            }
        }

        check();
        return () => {
            cancelled = true;
        };
    }, [user, router]);

    if (checking) {
        return (
            <div
                className="min-h-screen grid place-items-center"
                style={{ backgroundColor: EKARI.hair }}
            >
                <div className="flex flex-col items-center gap-3">
                    <BouncingBallLoader />
                    <div
                        className="text-sm font-semibold"
                        style={{ color: EKARI.dim }}
                    >
                        Checking admin permissions…
                    </div>
                </div>
            </div>
        );
    }

    if (!isAdmin || !user) {
        return (
            <div
                className="min-h-screen grid place-items-center"
                style={{ backgroundColor: EKARI.hair }}
            >
                <div className="flex flex-col items-center gap-3 px-4 text-center">
                    <IoAlertCircleOutline
                        size={32}
                        style={{ color: "#DC2626" }}
                    />
                    <div
                        className="text-base font-bold"
                        style={{ color: EKARI.text }}
                    >
                        Not authorized
                    </div>
                    <p
                        className="text-sm max-w-xs"
                        style={{ color: EKARI.dim }}
                    >
                        You need an admin account to view this area. Please contact the ekarihub
                        team if you believe this is a mistake.
                    </p>
                </div>
            </div>
        );
    }

    const title = getAdminTitle(pathname);

    return (
        <div
            className="flex min-h-screen"
            style={{ backgroundColor: EKARI.hair }}
        >
            {/* Left sidebar */}
            <aside
                className="hidden md:flex w-64 flex-col border-r"
                style={{
                    backgroundColor: EKARI.forest,
                    borderColor: "rgba(0,0,0,0.35)",
                }}
            >
                <div
                    className="px-4 pt-4 pb-3 border-b"
                    style={{ borderColor: "rgba(0,0,0,0.3)" }}
                >
                    <Image
                        src="/ekarihub-logo-green.png"
                        alt="ekarihub"
                        width={100}
                        height={86}
                        onError={(e) => ((e.currentTarget as HTMLImageElement).src = "/ekarihub-logo.png")}
                        priority
                    />
                    <div
                        className="mt-1 text-lg font-extrabold"
                        style={{ color: EKARI.sand }}
                    >
                        Admin
                    </div>
                    <div
                        className="mt-1 text-[11px]"
                        style={{ color: "rgba(255,255,255,0.6)" }}
                    >
                        Internal tools & moderation
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-3 pb-4">
                    <AdminNav />
                </div>
            </aside>

            {/* Right side: top bar + content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* TOP BAR */}
                <header
                    className="h-14 md:h-16 flex items-center justify-between border-b px-3 md:px-6"
                    style={{
                        backgroundColor: EKARI.sand,
                        borderColor: EKARI.hair,
                    }}
                >
                    {/* Title */}
                    <div className="flex flex-col justify-center">
                        <span
                            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                            style={{ color: EKARI.dim }}
                        >
                            Admin dashboard
                        </span>
                        <span
                            className="text-base md:text-lg font-extrabold"
                            style={{ color: EKARI.text }}
                        >
                            {title}
                        </span>
                    </div>

                    {/* Right corner: name + badge + avatar */}
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex flex-col items-end">
                            <span
                                className="text-xs font-semibold max-w-[180px] truncate"
                                style={{ color: EKARI.text }}
                            >
                                {user.displayName || "Admin user"}
                            </span>
                            <span
                                className="text-[11px] font-bold uppercase tracking-wide rounded-full px-2 py-[2px]"
                                style={{
                                    backgroundColor: EKARI.gold,
                                    color: EKARI.sand,
                                }}
                            >
                                Ekari Admin
                            </span>
                        </div>

                        <UserAvatarMenu
                            uid={user.uid}
                            photoURL={profile?.photoURL}
                            // You can pass the actual handle here instead of displayName if you want
                            handle={profile?.handle || null}
                        />
                    </div>
                </header>

                {/* MAIN CONTENT */}
                <main className="flex-1 overflow-y-auto">
                    <div className="max-w-6xl mx-auto w-full px-3 md:px-6 py-4 md:py-6">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
