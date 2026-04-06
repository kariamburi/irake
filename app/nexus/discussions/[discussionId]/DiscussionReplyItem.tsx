"use client";

import Image from "next/image";
import {
    IoCreateOutline,
    IoEllipsisHorizontal,
    IoTimeOutline,
    IoTrashOutline,
} from "react-icons/io5";
import { AVATAR_FALLBACK, EKARI, timeAgoShort } from "./discussion-thread.utils";
import { Reply, UserCacheMap } from "./discussion-thread.types";

type Props = {
    parent: Reply;
    childrenReplies: Reply[];
    uid: string | null;
    userCache: UserCacheMap;
    editingId: string | null;
    editingText: string;
    savingId: string | null;
    deletingId: string | null;
    setEditingText: (value: string) => void;
    startReplyToTop: (parent: Reply) => void;
    startReplyToChild: (parent: Reply, child: Reply) => void;
    startEdit: (reply: Reply) => void;
    cancelEdit: () => void;
    saveEdit: () => void;
    requestDelete: (reply: Reply) => void;
};

function Avatar({ src, size = 40 }: { src?: string | null; size?: number }) {
    return (
        <div
            className="relative overflow-hidden rounded-full bg-gray-200"
            style={{ width: size, height: size }}
        >
            <Image
                src={src || AVATAR_FALLBACK}
                alt="avatar"
                fill
                className="object-cover"
                sizes={`${size}px`}
            />
        </div>
    );
}

export default function DiscussionReplyItem({
    parent,
    childrenReplies,
    uid,
    userCache,
    editingId,
    editingText,
    savingId,
    deletingId,
    setEditingText,
    startReplyToTop,
    startReplyToChild,
    startEdit,
    cancelEdit,
    saveEdit,
    requestDelete,
}: Props) {
    const isOwn = parent.authorId === uid;
    const isEditing = editingId === parent.id;

    const prof = userCache[parent.authorId] || {};
    const name = parent.userName ?? prof.name ?? "User";
    const handle = parent.userHandle ?? prof.handle ?? null;
    const photo = parent.userPhotoURL ?? prof.photoURL ?? null;

    return (
        <div className="rounded-[22px] border border-black/5 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
            <div className="flex items-start gap-3">
                <Avatar src={photo} size={40} />

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-semibold text-[#111827]">
                            {name}
                        </span>
                        {handle && (
                            <span className="truncate text-[13px] font-medium text-gray-500">
                                @{String(handle).replace(/^@/, "")}
                            </span>
                        )}

                        <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-gray-500">
                            <IoTimeOutline size={13} />
                            {timeAgoShort(parent.createdAt) || "—"}
                        </span>
                    </div>

                    {isEditing ? (
                        <div className="mt-2 rounded-2xl bg-[#F3F4F6] p-3">
                            <textarea
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                className="min-h-[80px] w-full resize-none bg-transparent text-[14px] leading-6 text-[#111827] outline-none"
                                placeholder="Edit your answer..."
                                maxLength={400}
                            />
                            <div className="mt-3 flex justify-end gap-2">
                                <button
                                    onClick={cancelEdit}
                                    className="rounded-full border border-black/10 px-3 py-1.5 text-[13px] font-medium text-gray-600 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveEdit}
                                    disabled={savingId === parent.id}
                                    className="rounded-full bg-[#233F39] px-4 py-1.5 text-[13px] font-semibold text-white disabled:opacity-60"
                                >
                                    {savingId === parent.id ? "Saving..." : "Save"}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="mt-1 whitespace-pre-wrap text-[15px] leading-6 text-[#111827]">
                                {parent.body}
                            </div>

                            <div className="mt-3 flex items-center gap-3">
                                <button
                                    onClick={() => startReplyToTop(parent)}
                                    className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-[12px] font-medium text-[#111827] hover:bg-[#EDEFF2]"
                                >
                                    Reply
                                </button>

                                {parent.updatedAt ? (
                                    <span className="text-[12px] font-medium text-gray-400">
                                        edited
                                    </span>
                                ) : null}
                            </div>
                        </>
                    )}
                </div>

                <div className="shrink-0">
                    {isOwn ? (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => startEdit(parent)}
                                className="grid h-9 w-9 place-items-center rounded-full text-gray-500 hover:bg-gray-100"
                                title="Edit"
                                disabled={!!editingId && editingId !== parent.id}
                            >
                                <IoCreateOutline size={18} />
                            </button>

                            <button
                                onClick={() => requestDelete(parent)}
                                className="grid h-9 w-9 place-items-center rounded-full text-gray-500 hover:bg-gray-100"
                                title="Delete"
                            >
                                {deletingId === parent.id ? (
                                    <span className="text-[12px] font-semibold">...</span>
                                ) : (
                                    <IoTrashOutline size={18} />
                                )}
                            </button>
                        </div>
                    ) : (
                        <button
                            className="grid h-9 w-9 place-items-center rounded-full text-gray-500 hover:bg-gray-100"
                            title="More"
                        >
                            <IoEllipsisHorizontal size={18} />
                        </button>
                    )}
                </div>
            </div>

            {childrenReplies.length > 0 && (
                <div className="mt-4 space-y-3 border-l border-gray-200 pl-4">
                    {childrenReplies.map((child) => {
                        const isChildOwn = child.authorId === uid;
                        const isChildEditing = editingId === child.id;

                        const cprof = userCache[child.authorId] || {};
                        const cname = child.userName ?? cprof.name ?? "User";
                        const chandle = child.userHandle ?? cprof.handle ?? null;
                        const cphoto = child.userPhotoURL ?? cprof.photoURL ?? null;

                        return (
                            <div key={child.id} className="rounded-2xl bg-[#F8FAFC] p-3">
                                <div className="flex items-start gap-3">
                                    <Avatar src={cphoto} size={30} />

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="truncate text-[13px] font-semibold text-[#111827]">
                                                {cname}
                                            </span>
                                            {chandle && (
                                                <span className="truncate text-[12px] font-medium text-gray-500">
                                                    @{String(chandle).replace(/^@/, "")}
                                                </span>
                                            )}
                                            <span className="ml-auto text-[12px] font-medium text-gray-500">
                                                {timeAgoShort(child.createdAt) || "—"}
                                            </span>
                                        </div>

                                        {isChildEditing ? (
                                            <div className="mt-2 rounded-xl bg-white p-3">
                                                <textarea
                                                    value={editingText}
                                                    onChange={(e) => setEditingText(e.target.value)}
                                                    className="min-h-[70px] w-full resize-none bg-transparent text-[14px] leading-6 text-[#111827] outline-none"
                                                    placeholder="Edit your answer..."
                                                    maxLength={400}
                                                />
                                                <div className="mt-3 flex justify-end gap-2">
                                                    <button
                                                        onClick={cancelEdit}
                                                        className="rounded-full border border-black/10 px-3 py-1.5 text-[13px] font-medium text-gray-600 hover:bg-gray-50"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={saveEdit}
                                                        disabled={savingId === child.id}
                                                        className="rounded-full bg-[#233F39] px-4 py-1.5 text-[13px] font-semibold text-white disabled:opacity-60"
                                                    >
                                                        {savingId === child.id ? "Saving..." : "Save"}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="mt-1 whitespace-pre-wrap text-[14px] leading-6 text-[#111827]">
                                                    {child.replyToHandle ? (
                                                        <span className="mr-1 font-medium text-[#233F39]">
                                                            @{String(child.replyToHandle).replace(/^@/, "")}
                                                        </span>
                                                    ) : null}
                                                    {child.body}
                                                </div>

                                                <div className="mt-2 flex items-center gap-3">
                                                    <button
                                                        onClick={() => startReplyToChild(parent, child)}
                                                        className="rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-[#111827] hover:bg-gray-100"
                                                    >
                                                        Reply
                                                    </button>

                                                    {child.updatedAt ? (
                                                        <span className="text-[12px] font-medium text-gray-400">
                                                            edited
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {isChildOwn ? (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => startEdit(child)}
                                                className="grid h-8 w-8 place-items-center rounded-full text-gray-500 hover:bg-gray-200"
                                                title="Edit"
                                                disabled={!!editingId && editingId !== child.id}
                                            >
                                                <IoCreateOutline size={16} />
                                            </button>

                                            <button
                                                onClick={() => requestDelete(child)}
                                                className="grid h-8 w-8 place-items-center rounded-full text-gray-500 hover:bg-gray-200"
                                                title="Delete"
                                            >
                                                {deletingId === child.id ? (
                                                    <span className="text-[12px] font-semibold">...</span>
                                                ) : (
                                                    <IoTrashOutline size={16} />
                                                )}
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}