"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/app/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type AuthGuardProps = {
    children: React.ReactNode;
    /** Where to send unauthenticated users */
    redirectTo?: string; // default: "/login"
    /** Optional: require an onboarded profile (checks users/{uid}) */
    requireOnboarded?: boolean;
    /** Where to send users who aren’t onboarded yet */
    onboardRedirectTo?: string; // default: "/getstarted"
    /** Render while checking auth/doc */
    fallback?: React.ReactNode;
};

export default function AuthGuard({
    children,
    redirectTo = "/login",
    requireOnboarded = false,
    onboardRedirectTo = "/getstarted",
    fallback,
}: AuthGuardProps) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const redirected = useRef(false);
    const [mounted, setMounted] = useState(false);
    const [onboardChecked, setOnboardChecked] = useState(!requireOnboarded);
    const [docLoading, setDocLoading] = useState(false);

    // avoid hydration flash
    useEffect(() => setMounted(true), []);

    // If authenticated and requireOnboarded, check Firestore doc once
    useEffect(() => {
        if (!requireOnboarded || loading || !user || redirected.current) return;

        (async () => {
            try {
                setDocLoading(true);
                const snap = await getDoc(doc(db, "users", user.uid));
                const data = snap.data() as
                    | { onboarded?: boolean; handle?: string; username?: string }
                    | undefined;

                // Treat any of these as "onboarded"
                const isOnboarded =
                    !!data?.onboarded ||
                    !!(data?.handle && data.handle.trim()) ||
                    !!(data?.username && data.username.trim());

                if (!isOnboarded) {
                    redirected.current = true;
                    const next = encodeURIComponent(pathname || "/");
                    router.replace(`${onboardRedirectTo}?next=${next}`);
                    return;
                }
                setOnboardChecked(true);
            } catch {
                // if doc fails we’ll allow through (or you could choose to redirect)
                setOnboardChecked(true);
            } finally {
                setDocLoading(false);
            }
        })();
    }, [requireOnboarded, loading, user, router, pathname, onboardRedirectTo]);

    // If unauthenticated, redirect to login (with ?next=…)
    useEffect(() => {
        if (loading || redirected.current) return;
        if (!user) {
            redirected.current = true;
            const next = encodeURIComponent(pathname || "/");
            router.replace(`${redirectTo}?next=${next}`);
        }
    }, [user, loading, router, pathname, redirectTo]);

    if (!mounted) return null;

    const waiting = loading || docLoading || (!user && !redirected.current) || (requireOnboarded && !onboardChecked);
    if (waiting) {
        return (
            fallback ?? (
                <div className="grid min-h-[50vh] place-items-center text-sm text-gray-500">
                    Checking your session…
                </div>
            )
        );
    }

    // If we already triggered a redirect, render nothing to prevent flashes
    if (redirected.current) return null;

    return <>{children}</>;
}

/** Optional: inverse guard for login/register pages.
 * Redirects signed-in users away (e.g., to "/deeds").
 */
export function UnauthOnly({
    children,
    redirectTo = "/deeds",
    fallback,
}: {
    children: React.ReactNode;
    redirectTo?: string;
    fallback?: React.ReactNode;
}) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const redirected = useRef(false);
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (loading || redirected.current) return;
        if (user) {
            redirected.current = true;
            router.replace(redirectTo);
        }
    }, [user, loading, router, redirectTo]);

    if (!mounted) return null;
    if (loading || (user && !redirected.current)) {
        return fallback ?? <div className="grid min-h-[50vh] place-items-center text-sm text-gray-500">Loading…</div>;
    }
    if (redirected.current) return null;
    return <>{children}</>;
}
