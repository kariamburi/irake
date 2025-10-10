"use client";

import React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export default function LoginButton({ className }: { className?: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const search = useSearchParams();
    const next = pathname + (search?.toString() ? `?${search}` : "");

    const goLogin = () =>
        router.push(`/getstarted?next=${encodeURIComponent(next || "/")}`);

    return (
        <button
            onClick={goLogin}
            aria-label="Log in"
            className={[
                "h-9 rounded-full px-4 text-sm font-semibold",
                "border border-gray-200 bg-white text-[#233F39]",
                "shadow-sm hover:shadow-md transition active:scale-[.98]",
                "focus:outline-none focus:ring-2 focus:ring-[#C79257] focus:ring-offset-1",
                // TikTok-like accent on hover in Ekari gold
                "hover:bg-[#C79257] hover:text-white hover:border-transparent",
                className || "",
            ].join(" ")}
        >
            Log in
        </button>
    );
}
