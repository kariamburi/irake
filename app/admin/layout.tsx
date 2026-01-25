// app/admin/layout.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/app/hooks/useAuth";
import UserAvatarMenu from "@/app/components/UserAvatarMenu";
import { IoAlertCircleOutline } from "react-icons/io5";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import Link from "next/link";
import Image from "next/image";
import {
    doc,
    onSnapshot,
    collection,
    query,
    where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

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
    { href: "/admin/uplifts", label: "Uplifts" },
    { href: "/admin/earnings", label: "Creator earnings" },
    { href: "/admin/wallets", label: "Creator withdrawals" },
    { href: "/admin/finance", label: "Finance Settings" },
    { href: "/admin/verification", label: "Verification" },
    { href: "/admin/support-tickets", label: "Support tickets" },
    { href: "/admin/sounds", label: "Sounds library" },
    { href: "/admin/usermanagement", label: "User management" },
    { href: "/admin/catalog", label: "Catalog management" },
    { href: "/admin/taxonomies", label: "Taxonomy" },
    { href: "/admin/packages", label: "Packages" },
    { href: "/admin/subscriptions", label: "Subscriptions" },
    { href: "/admin/payments", label: "Payments" },
    { href: "/admin/analytics", label: "Market Analytics" },



];

function getAdminTitle(pathname: string): string {
    if (!pathname.startsWith("/admin")) return "Admin";

    if (pathname.startsWith("/admin/overview")) return "Overview";
    if (pathname.startsWith("/admin/deeds")) return "Deeds moderation";
    if (pathname.startsWith("/admin/market")) return "Market listings";
    if (pathname.startsWith("/admin/events")) return "Events";
    if (pathname.startsWith("/admin/discussions")) return "Discussions";
    if (pathname.startsWith("/admin/uplifts")) return "Uplifts";
    if (pathname.startsWith("/admin/earnings")) return "Creator earnings";
    if (pathname.startsWith("/admin/wallets")) return "Creator withdrawals";
    if (pathname.startsWith("/admin/finance")) return "Finance Settings";
    if (pathname.startsWith("/admin/verification")) return "Verification";
    if (pathname.startsWith("/admin/support-tickets")) return "Support tickets";
    if (pathname.startsWith("/admin/sounds")) return "Sounds library";
    if (pathname.startsWith("/admin/usermanagement")) return "User management";
    if (pathname.startsWith("/admin/catalog")) return "Catalog management";
    if (pathname.startsWith("/admin/taxonomies")) return "Taxonomy";
    if (pathname.startsWith("/admin/packages")) return "Packages";
    if (pathname.startsWith("/admin/subscriptions")) return "Subscriptions";
    if (pathname.startsWith("/admin/payments")) return "Payments";
    if (pathname.startsWith("/admin/analytics")) return "Market Analytics";

    return "Admin";
}

/* ---------- Left nav with badges ---------- */
function AdminNav({
    pendingVerificationCount,
    pendingWithdrawalCount,
}: {
    pendingVerificationCount: number;
    pendingWithdrawalCount: number;
}) {
    const pathname = usePathname();

    return (
        <nav className="flex flex-col gap-1 mt-4">
            {NAV_ITEMS.map((item) => {
                const active =
                    pathname === item.href || pathname.startsWith(item.href + "/");

                let badgeCount = 0;
                if (item.href === "/admin/verification") {
                    badgeCount = pendingVerificationCount;
                } else if (item.href === "/admin/wallets") {
                    badgeCount = pendingWithdrawalCount;
                }

                const showBadge = badgeCount > 0;
                const badgeLabel =
                    badgeCount > 999 ? "999+" : badgeCount > 99 ? "99+" : badgeCount;

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={[
                            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition justify-between",
                            active ? "shadow-sm" : "hover:bg-black/10 hover:text-white",
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
                        <span className="truncate">{item.label}</span>

                        {showBadge && (
                            <span
                                className="ml-2 inline-flex min-w-[22px] h-[20px] items-center justify-center rounded-full text-[11px] font-extrabold px-1.5"
                                style={{
                                    backgroundColor: "#EF4444",
                                    color: "#FFFFFF",
                                    boxShadow: "0 0 0 1px rgba(0,0,0,0.25)",
                                }}
                            >
                                {badgeLabel}
                            </span>
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}

function useUserProfile(uid?: string) {
    const [profile, setProfile] = useState<{ handle?: string; photoURL?: string } | null>(null);

    useEffect(() => {
        if (!uid) {
            setProfile(null);
            return;
        }
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

    // 🔢 counts
    const [pendingVerificationCount, setPendingVerificationCount] = useState(0);
    const [pendingWithdrawalCount, setPendingWithdrawalCount] = useState(0);

    // Client-side guard: only users with admin claim can stay here
    React.useEffect(() => {
        let cancelled = false;

        async function check() {
            const nextPath =
                pathname && pathname.startsWith("/admin") ? pathname : "/admin/overview";

            if (!user) {
                setChecking(false);
                setIsAdmin(false);
                router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
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
    }, [user, router, pathname]);

    /* 🔥 Listen for pending verification + withdrawal requests */
    useEffect(() => {
        if (!isAdmin) return;

        // ✅ Verification: users where verification.status == "pending"
        const verQuery = query(
            collection(db, "users"),
            where("verification.status", "==", "pending")
        );
        const unsubVer = onSnapshot(verQuery, (snap) => {
            setPendingVerificationCount(snap.size);
        });

        // ✅ Withdrawals: withdrawalRequests where status == "pending"
        const wdQuery = query(
            collection(db, "withdrawalRequests"),
            where("status", "==", "pending")
        );
        const unsubWd = onSnapshot(wdQuery, (snap) => {
            setPendingWithdrawalCount(snap.size);
        });

        return () => {
            unsubVer();
            unsubWd();
        };
    }, [isAdmin]);

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
                    <IoAlertCircleOutline size={32} style={{ color: "#DC2626" }} />
                    <div className="text-base font-bold" style={{ color: EKARI.text }}>
                        Not authorized
                    </div>
                    <p className="text-sm max-w-xs" style={{ color: EKARI.dim }}>
                        You need an admin account to view this area. Please contact the ekarihub
                        team if you believe this is a mistake.
                    </p>
                </div>
            </div>
        );
    }

    const title = getAdminTitle(pathname);

    return (
        <div className="flex min-h-screen" style={{ backgroundColor: EKARI.hair }}>
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
                        onError={(e) =>
                            ((e.currentTarget as HTMLImageElement).src = "/ekarihub-logo.png")
                        }
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
                    <AdminNav
                        pendingVerificationCount={pendingVerificationCount}
                        pendingWithdrawalCount={pendingWithdrawalCount}
                    />
                </div>
            </aside>

            {/* Right side */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* TOP BAR */}
                <header
                    className="h-14 md:h-16 flex items-center justify-between border-b px-3 md:px-6"
                    style={{
                        backgroundColor: EKARI.sand,
                        borderColor: EKARI.hair,
                    }}
                >
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
