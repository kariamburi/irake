"use client";

import { IoChatbubblesOutline, IoSparklesOutline } from "react-icons/io5";
import { DiscussionItem } from "./discussion-thread.types";
import { EKARI, THREAD_MAX_WIDTH, cn, hexToRgba } from "./discussion-thread.utils";

export default function DiscussionTopicCard({
    discussion,
}: {
    discussion: DiscussionItem | null;
}) {
    if (!discussion) return null;

    return (
        <div className={cn("mx-auto w-full", THREAD_MAX_WIDTH, "px-3 pt-3 sm:px-4 sm:pt-4")}>
            <div className="rounded-[24px] border border-black/5 bg-white px-4 py-4 shadow-[0_10px_35px_rgba(0,0,0,0.06)]">
                <div className="flex items-start gap-3">
                    <div
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
                        style={{
                            background: "linear-gradient(135deg, rgba(35,63,57,1), rgba(199,146,87,0.55))",
                        }}
                    >
                        <IoChatbubblesOutline size={18} color="#fff" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <h1
                            className="text-[20px] font-semibold leading-[1.2] tracking-[-0.02em] sm:text-[22px]"
                            style={{ color: EKARI.text }}
                        >
                            {discussion.title}
                        </h1>

                        {!!discussion.body && (
                            <p
                                className="mt-2 whitespace-pre-wrap text-[14px] leading-6 sm:text-[15px]"
                                style={{ color: EKARI.sub }}
                            >
                                {discussion.body}
                            </p>
                        )}

                        <div
                            className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-medium"
                            style={{ color: EKARI.dim }}
                        >
                            <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: hexToRgba(EKARI.gold, 0.9) }}
                            />
                            <span>Answer thoughtfully</span>
                            <span>•</span>
                            <span>Keep it helpful</span>

                            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-semibold text-[#233F39]">
                                <IoSparklesOutline size={13} />
                                ekari Nexus
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}