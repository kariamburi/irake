"use client";

import AuthGuard from "./AuthGuard";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
    return <AuthGuard requireOnboarded>{children}</AuthGuard>;
}
