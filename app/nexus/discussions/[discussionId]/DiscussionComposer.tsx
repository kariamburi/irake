"use client";

import { IoClose, IoSend } from "react-icons/io5";
import { EKARI, THREAD_MAX_WIDTH, cn } from "./discussion-thread.utils";
import { ReplyTarget } from "./discussion-thread.types";

type Props = {
    isDesktop: boolean;
    text: string;
    setText: (value: string) => void;
    posting: boolean;
    replyTarget: ReplyTarget;
    setReplyTarget: (value: ReplyTarget) => void;
    onSubmit: () => void;
};

export default function DiscussionComposer({
    isDesktop,
    text,
    setText,
    posting,
    replyTarget,
    setReplyTarget,
    onSubmit,
}: Props) {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-black/5 bg-white/92 backdrop-blur-xl">
            <div
                className={cn(
                    "mx-auto w-full",
                    THREAD_MAX_WIDTH,
                    "px-3 pb-3 pt-2 sm:px-4",
                )}
                style={{
                    paddingBottom: "max(12px, env(safe-area-inset-bottom))",
                }}
            >
                <div className="rounded-[24px] border border-black/8 bg-white p-2 shadow-[0_-8px_30px_rgba(0,0,0,0.05)]">
                    {replyTarget && (
                        <div className="mb-2 flex items-center gap-2 rounded-full bg-[#F8FAFC] px-3 py-2">
                            <span
                                className="truncate text-[12px] font-medium"
                                style={{ color: EKARI.text }}
                            >
                                Replying to{" "}
                                {replyTarget.replyToHandle
                                    ? `@${String(replyTarget.replyToHandle).replace(/^@/, "")}`
                                    : "comment"}
                            </span>

                            <button
                                onClick={() => setReplyTarget(null)}
                                className="ml-auto grid h-7 w-7 place-items-center rounded-full text-gray-500 hover:bg-gray-100"
                                title="Clear reply target"
                            >
                                <IoClose size={14} />
                            </button>
                        </div>
                    )}

                    <div className="flex items-end gap-2">
                        <div className="flex-1 rounded-[20px] bg-[#F3F4F6] px-4 py-3">
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Write an answer..."
                                className="min-h-[24px] max-h-[160px] w-full resize-none bg-transparent text-[15px] leading-6 text-[#111827] outline-none placeholder:text-gray-400"
                                rows={1}
                            />
                        </div>

                        <button
                            onClick={onSubmit}
                            disabled={!text.trim() || posting}
                            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white transition disabled:opacity-50"
                            style={{
                                background:
                                    "linear-gradient(135deg, rgba(35,63,57,1), rgba(199,146,87,0.85))",
                            }}
                            title="Send"
                            aria-label="Send"
                        >
                            {posting ? (
                                <span className="text-[12px] font-semibold">...</span>
                            ) : (
                                <IoSend size={18} />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}