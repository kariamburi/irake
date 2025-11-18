// app/hooks/useAdmin.ts
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";

type UseAdminResult = {
    user: any | null;
    isAdmin: boolean;
    loading: boolean;
    error: string | null;
};

export function useAdmin(): UseAdminResult {
    const { user, loading: authLoading } = useAuth();
    const [isAdmin, setIsAdmin] = useState(false);
    const [checking, setChecking] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function check() {
            // No user => definitely not admin
            if (!user) {
                if (!cancelled) {
                    setIsAdmin(false);
                    setChecking(false);
                    setError(null);
                }
                return;
            }

            try {
                setChecking(true);
                setError(null);

                // Read custom claims
                const tokenResult = await user.getIdTokenResult();
                const adminClaim = !!tokenResult.claims?.admin;

                if (!cancelled) {
                    setIsAdmin(adminClaim);
                }
            } catch (err: any) {
                console.error("useAdmin error:", err);
                if (!cancelled) {
                    setIsAdmin(false);
                    setError(err?.message || "Failed to check admin claim");
                }
            } finally {
                if (!cancelled) {
                    setChecking(false);
                }
            }
        }

        check();
        return () => {
            cancelled = true;
        };
    }, [user]);

    return {
        user,
        isAdmin,
        loading: authLoading || checking,
        error,
    };
}
