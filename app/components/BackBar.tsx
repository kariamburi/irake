"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { EKARI } from "../constants/constants";

export default function BackBar({
    label,
    href,
}: {
    label: string;
    href?: string; // if omitted we'll just router.back()
}) {
    const router = useRouter();
    return (
        <button
            onClick={() => (href ? router.push(href) : router.back())}
            className="inline-flex items-center gap-2 text-sm font-bold rounded-full px-3 py-2 hover:bg-gray-50 border"
            style={{ color: EKARI.forest, borderColor: EKARI.hair }}
            aria-label={label}
        >
            <ArrowLeft size={16} />
            {label}
        </button>
    );
}
