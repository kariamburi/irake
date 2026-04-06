"use client";

import { ArrowLeft } from "lucide-react";
import { IoArrowRedo } from "react-icons/io5";
import { EKARI, THREAD_MAX_WIDTH, cn } from "./discussion-thread.utils";

type Props = {
    title?: string | null;
    onBack: () => void;
    onShare: () => void;
    isMobile: boolean;
};

export default function DiscussionHeader({
    title,
    onBack,
    onShare,
    isMobile,
}: Props) {
    return (
        <div className="sticky top-0 z-40 border-b border-black/5 bg-gray-100">
            <div className={cn("mx-auto w-full", THREAD_MAX_WIDTH, "px-3 sm:px-4")}>
                <div className="flex h-14 items-center gap-3">
                    <button
                        onClick={onBack}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-black/10 bg-white text-[#111827] transition hover:bg-gray-50"
                        aria-label="Go back"
                    >
                        <ArrowLeft size={18} />
                    </button>

                    <div className="min-w-0 flex-1">
                        <div
                            className="truncate text-[15px] font-semibold leading-none"
                            style={{ color: EKARI.text }}
                        >
                            Discussion
                        </div>
                        <div
                            className="mt-1 truncate text-[12px] font-medium"
                            style={{ color: EKARI.dim }}
                        >
                            {title || ""}
                        </div>
                    </div>

                    <button
                        onClick={onShare}
                        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-black/10 bg-white px-3 text-[13px] font-semibold text-[#111827] transition hover:bg-gray-50"
                        aria-label="Share discussion"
                        title="Share"
                    >
                        <IoArrowRedo size={16} />
                        <span className={cn(isMobile ? "hidden" : "inline")}>Share</span>
                    </button>
                </div>
            </div>
        </div>
    );
}