"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/app/hooks/useAuth"; // adjust path if different

type AuthGuardProps = {
    children: React.ReactNode;
    redirectTo?: string;       // default: /login
    fallback?: React.ReactNode; // optional loading UI
};

export default function AuthGuard({
    children,
    redirectTo = "/login",
    fallback = null,
}: AuthGuardProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, loading } = useAuth() as { user: { uid?: string } | null; loading?: boolean };

    // Track first render to avoid flicker on hydration
    const [ready, setReady] = useState(false);
    useEffect(() => setReady(true), []);

    useEffect(() => {
        if (!loading && ready) {
            // Not signed in → bounce to /login with a "next" param so we can return after login
            if (!user?.uid) {
                const url = new URL(redirectTo, typeof window !== "undefined" ? window.location.origin : "http://localhost");
                url.searchParams.set("next", pathname || "/");
                router.replace(url.toString());
            }
        }
    }, [user?.uid, loading, ready, redirectTo, pathname, router]);

    // While figuring out auth state, show fallback (or nothing)
    if (!ready || loading) return <>{fallback}</>;

    // If user missing, render nothing because we’re about to redirect
    if (!user?.uid) return null;

    // Authenticated → render protected content
    return <>{children}</>;
}
