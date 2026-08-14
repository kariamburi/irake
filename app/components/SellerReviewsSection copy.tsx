"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    deleteDoc,
    getFirestore,
    getDoc,
    setDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import {
    IoStar,
    IoStarOutline,
    IoCreateOutline,
    IoTrashOutline,
    IoThumbsUp,
    IoThumbsUpOutline,
    IoCheckmark,
    IoClose,
} from "react-icons/io5";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

type ReviewUser = {
    id: string;
    handle: string;
    name: string;
    photoURL: string | null;
};

type Review = {
    id: string; // doc id = reviewer uid
    userId: string;
    user?: ReviewUser;
    rating: number;
    text?: string | null;
    helpfulCount?: number;
    createdAt?: any;
    updatedAt?: any;
};

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
};

const sellerReviewDocRef = (dbi: any, sellerId: string, reviewUserId: string) =>
    doc(dbi, "users", String(sellerId), "reviews", String(reviewUserId));

const sellerVoteRef = (dbi: any, sellerId: string, reviewId: string, voterId: string) =>
    doc(dbi, "users", String(sellerId), "reviews", String(reviewId), "votes", String(voterId));

function buildNameFromUserDoc(ud: any) {
    const first = String(ud?.firstName || "").trim();
    const sur = String(ud?.surname || ud?.lastName || "").trim();
    const joined = `${first} ${sur}`.trim();
    return (
        joined ||
        String(ud?.displayName || "").trim() ||
        String(ud?.name || "").trim() ||
        String(ud?.handle || "").trim() ||
        "User"
    );
}

async function fetchMyReviewUser(uid: string, dbi: any): Promise<ReviewUser> {
    try {
        const us = await getDoc(doc(dbi, "users", uid));
        const ud = us.exists() ? (us.data() as any) : {};
        const handle = String(ud?.handle || "").trim() || uid;
        return {
            id: uid,
            handle,
            name: buildNameFromUserDoc(ud),
            photoURL: ud?.photoURL || ud?.photo || ud?.imageUrl || null,
        };
    } catch {
        return { id: uid, handle: uid, name: "User", photoURL: null };
    }
}

type Props = { sellerId: string };

function parseDate(ts: any): Date | null {
    try {
        if (ts?.toDate?.() instanceof Date) return ts.toDate();
        if (typeof ts === "number") return new Date(ts);
    } catch { }
    return null;
}

const ReviewRow = React.memo(function ReviewRow({
    r,
    mine,
    onProfile,
    onHelpful,
    helpfulActive,
}: {
    r: Review;
    mine: boolean;
    onProfile: (handle?: string) => void;
    onHelpful: (reviewId: string) => void;
    helpfulActive: boolean;
}) {
    const u = r.user;
    const d = parseDate(r.updatedAt || r.createdAt);

    return (
        <div className="pb-3 border-b border-[color:var(--hair,#E5E7EB)]">
            <div className="flex gap-3">
                {/* avatar */}
                <button
                    type="button"
                    onClick={() => onProfile(u?.handle)}
                    className="shrink-0 rounded-full"
                    title="View profile"
                >
                    <img
                        src={u?.photoURL || "/avatar-placeholder.png"}
                        alt={u?.name || "User"}
                        className="rounded-full h-8 w-8 object-cover bg-[#F3F4F6] border border-[color:var(--hair,#E5E7EB)]"
                    />
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => onProfile(u?.handle)}
                            className="min-w-0 text-left hover:opacity-80"
                            title="View profile"
                        >
                            <p className="font-extrabold text-[color:var(--text,#0F172A)] truncate">
                                {u?.name || "Someone"}
                            </p>
                        </button>

                        <span className="text-[11px] text-[color:var(--dim,#6B7280)]">
                            {d ? d.toLocaleDateString() : ""}
                        </span>
                    </div>

                    <div className="mt-1 flex items-center">
                        {Array.from({ length: 5 }).map((_, i) =>
                            i < (r.rating || 0) ? (
                                <IoStar key={i} className="text-amber-400" size={14} />
                            ) : (
                                <IoStarOutline key={i} className="text-gray-300" size={14} />
                            )
                        )}
                    </div>

                    {!!r.text && (
                        <p className="mt-2 text-sm text-[color:var(--text,#0F172A)]">{r.text}</p>
                    )}

                    <div className="mt-2 flex items-center gap-2">
                        {!mine ? (
                            <button
                                onClick={() => onHelpful(r.id)}
                                className={[
                                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-extrabold transition hover:opacity-90",
                                    helpfulActive
                                        ? "bg-green-50 border-green-600 text-green-700"
                                        : "bg-[#F6F7F7] border-[color:var(--hair,#E5E7EB)] text-[color:var(--text,#0F172A)]",
                                ].join(" ")}
                                title="Mark as helpful"
                            >
                                {helpfulActive ? <IoThumbsUp size={14} /> : <IoThumbsUpOutline size={14} />}
                                Helpful • {r.helpfulCount ?? 0}
                            </button>
                        ) : (
                            <span
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-extrabold opacity-60 cursor-not-allowed bg-[#F6F7F7] border-[color:var(--hair,#E5E7EB)] text-[color:var(--dim,#6B7280)]"
                                title="You can't vote your own review"
                            >
                                <IoThumbsUpOutline size={14} /> Helpful
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default function SellerReviewsSection({ sellerId }: Props) {
    const auth = getAuth();
    const dbi = getFirestore();
    const router = useRouter();
    const [expanded, setExpanded] = useState(false); // collapsed by default

    const [reviews, setReviews] = useState<Review[]>([]);
    const [avgRating, setAvgRating] = useState(0);
    const [reviewCount, setReviewCount] = useState(0);

    // map: reviewId -> true
    const [myHelpful, setMyHelpful] = useState<Record<string, true>>({});
    const helpfulRef = useRef<Record<string, true>>({});

    const [rvVisible, setRvVisible] = useState(false);
    const [rvStars, setRvStars] = useState(5);
    const [rvText, setRvText] = useState("");

    const me = auth.currentUser;
    const isOwner = me?.uid === sellerId;

    // ===== Live reviews (single subscription) =====
    useEffect(() => {
        if (!sellerId) return;

        const qRef = query(
            collection(dbi, "users", String(sellerId), "reviews"),
            orderBy("createdAt", "desc")
        );

        const unsub = onSnapshot(qRef, (snap) => {
            const rows = snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as any),
            })) as Review[];

            setReviews(rows);

            if (rows.length) {
                const total = rows.reduce((s, r) => s + (Number(r.rating) || 0), 0);
                setAvgRating(total / rows.length);
                setReviewCount(rows.length);
            } else {
                setAvgRating(0);
                setReviewCount(0);
            }
        });

        return () => unsub();
    }, [dbi, sellerId]);

    // ===== My helpful votes (per-review docs) =====
    // NOTE: kept simple, but with stable state updates to avoid jitter.
    useEffect(() => {
        const user = auth.currentUser;
        if (!user || !sellerId) return;

        helpfulRef.current = {};
        setMyHelpful({});

        const unsubs: Array<() => void> = [];

        for (const r of reviews) {
            const voteDoc = sellerVoteRef(dbi, sellerId, r.id, user.uid);

            const unsub = onSnapshot(voteDoc, (snap) => {
                const next = { ...helpfulRef.current };
                if (snap.exists()) next[r.id] = true;
                else delete next[r.id];

                helpfulRef.current = next;
                setMyHelpful(next);
            });

            unsubs.push(unsub);
        }

        return () => unsubs.forEach((u) => u());
    }, [dbi, sellerId, reviews, auth]);

    const myReview = useMemo(
        () => (me ? reviews.find((r) => r.userId === me.uid) : undefined),
        [reviews, me]
    );

    const goProfile = useCallback(
        (handle?: string) => {
            const h = String(handle || "").trim();
            if (!h) return;
            router.push(`/${encodeURIComponent(h)}`);
        },
        [router]
    );

    const openReview = () => {
        if (!me) return alert("Please sign in to leave a review.");
        if (isOwner) return alert("You can’t review your own seller profile.");

        if (myReview) {
            setRvStars(myReview.rating || 5);
            setRvText(myReview.text || "");
        } else {
            setRvStars(5);
            setRvText("");
        }
        setRvVisible(true);
    };

    const submitReview = async () => {
        const user = auth.currentUser;
        if (!user) return alert("Please sign in.");
        if (!sellerId) return alert("Missing seller.");

        const rating = Math.max(1, Math.min(5, Math.round(rvStars || 5)));
        const text = rvText.trim() || null;

        try {
            const userSnap = await fetchMyReviewUser(user.uid, dbi);
            const rRef = sellerReviewDocRef(dbi, sellerId, user.uid);

            await runTransaction(dbi, async (tx) => {
                const snap = await tx.get(rRef);
                if (snap.exists()) {
                    tx.update(rRef, {
                        rating,
                        text,
                        user: userSnap,
                        updatedAt: serverTimestamp(),
                    });
                } else {
                    tx.set(rRef, {
                        userId: user.uid,
                        user: userSnap,
                        rating,
                        text,
                        helpfulCount: 0,
                        createdAt: serverTimestamp(),
                        updatedAt: null,
                    });
                }
            });

            setRvVisible(false);
        } catch (e: any) {
            alert(e?.message || "Failed. Try again.");
        }
    };

    const deleteMyReview = async () => {
        const user = auth.currentUser;
        if (!user || !myReview || !sellerId) return;
        try {
            await deleteDoc(sellerReviewDocRef(dbi, sellerId, user.uid));
            setRvVisible(false);
        } catch (e: any) {
            alert(e?.message || "Failed. Try again.");
        }
    };

    const toggleHelpful = async (reviewId: string) => {
        const user = auth.currentUser;
        if (!user) return alert("Please log in first.");
        if (!sellerId) return;
        if (user.uid === reviewId) return;

        const vRef = sellerVoteRef(dbi, sellerId, reviewId, user.uid);

        if (myHelpful[reviewId]) {
            await deleteDoc(vRef);
        } else {
            await setDoc(vRef, {
                userId: user.uid,
                createdAt: serverTimestamp(),
            });
        }
    };

    return (
        <>
            {/* Reviews card */}
            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm mt-4 p-5 border border-[color:var(--hair,#E5E7EB)]">
                <div className="flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={() => setExpanded((v) => !v)}
                        className="flex items-center gap-2 hover:opacity-90"
                        aria-expanded={expanded}
                        aria-controls="seller-reviews-list"
                    >
                        <h3 className="font-black text-[color:var(--text,#0F172A)] text-lg">Reviews</h3>
                        <span className="text-xs font-bold text-[color:var(--dim,#6B7280)]">
                            {expanded ? "Hide" : "Show"}
                        </span>
                        <span
                            className="text-[color:var(--dim,#6B7280)] text-sm"
                            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
                        >
                            ▾
                        </span>
                    </button>

                    {!isOwner && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation(); // ✅ don’t toggle collapse
                                openReview();
                            }}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-extrabold text-white hover:opacity-95"
                            style={{ backgroundColor: EKARI.forest }}
                        >
                            {myReview ? <IoCreateOutline size={16} /> : <IoStarOutline size={16} />}
                            {myReview ? "Edit Review" : "Leave Review"}
                        </button>
                    )}
                </div>


                {reviewCount > 0 && (
                    <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-[color:var(--text,#0F172A)]">
                                {avgRating.toFixed(1)}
                            </span>
                            <div className="flex items-center">
                                {Array.from({ length: 5 }).map((_, i) =>
                                    i < Math.round(avgRating) ? (
                                        <IoStar key={i} className="text-amber-400" size={16} />
                                    ) : (
                                        <IoStarOutline key={i} className="text-gray-300" size={16} />
                                    )
                                )}
                            </div>
                        </div>
                        <div className="text-sm font-semibold text-[color:var(--dim,#6B7280)]">
                            {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
                        </div>
                    </div>
                )}

                {!expanded ? (
                    <p onClick={() => setExpanded((v) => !v)} className="cursor-pointer text-[color:var(--dim,#6B7280)] text-sm mt-3">
                        Tap “Show” to view reviews.
                    </p>
                ) : reviews.length === 0 ? (
                    <p className="text-[color:var(--dim,#6B7280)] text-sm mt-2">No reviews yet.</p>
                ) : (
                    <div id="seller-reviews-list" className="space-y-4 mt-3">
                        {reviews.map((r) => (
                            <ReviewRow
                                key={r.id}
                                r={r}
                                mine={me?.uid === r.userId}
                                onProfile={goProfile}
                                onHelpful={toggleHelpful}
                                helpfulActive={!!myHelpful[r.id]}
                            />
                        ))}
                    </div>
                )}

            </div>

            {/* Review modal */}
            {rvVisible &&
                createPortal(
                    <div className="fixed inset-0 z-50">
                        {/* backdrop */}
                        <button
                            className="absolute inset-0 bg-black/40"
                            onClick={() => setRvVisible(false)}
                            aria-label="Close review"
                        />

                        {/* sheet */}
                        <div
                            className="absolute left-1/2 bottom-0 w-full max-w-2xl -translate-x-1/2 bg-white border-t border-gray-200 rounded-t-2xl h-[80vh] flex flex-col shadow-xl"
                            role="dialog"
                            aria-modal="true"
                        >
                            <div className="w-12 h-1.5 rounded-full bg-gray-300 mx-auto mt-3 mb-2" />

                            <div className="px-5 pb-3 flex items-center justify-between border-b border-gray-200">
                                <h4 className="font-black text-base text-[color:var(--text,#0F172A)]">
                                    {myReview ? "Edit your review" : "Leave a review"}
                                </h4>
                                <button
                                    onClick={() => setRvVisible(false)}
                                    className="w-9 h-9 grid place-items-center rounded-full hover:bg-gray-50"
                                    aria-label="Close"
                                >
                                    <IoClose size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
                                <div>
                                    <div className="text-xs font-bold text-[color:var(--dim,#6B7280)]">
                                        Your rating
                                    </div>
                                    <div className="mt-3 flex items-center gap-3">
                                        {Array.from({ length: 5 }).map((_, i) => {
                                            const idx = i + 1;
                                            const filled = idx <= rvStars;
                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => setRvStars(idx)}
                                                    className="p-1 rounded hover:scale-105 transition"
                                                >
                                                    {filled ? (
                                                        <IoStar size={28} className="text-amber-400" />
                                                    ) : (
                                                        <IoStarOutline size={28} className="text-amber-400" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <div className="text-xs font-bold text-[color:var(--dim,#6B7280)]">
                                        Your review (optional)
                                    </div>
                                    <textarea
                                        value={rvText}
                                        onChange={(e) => setRvText(e.target.value)}
                                        rows={6}
                                        maxLength={800}
                                        placeholder="Share details about quality, delivery, or overall experience…"
                                        className="mt-2 w-full rounded-xl border border-[color:var(--hair,#E5E7EB)] px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#233F39] focus:border-[#233F39]"
                                    />
                                </div>
                            </div>

                            <div className="px-5 py-4 border-t border-gray-200 flex items-center gap-3 bg-white">
                                {myReview && (
                                    <button
                                        onClick={deleteMyReview}
                                        className="inline-flex items-center gap-2 px-4 h-11 rounded-lg bg-red-600 text-white text-sm font-black hover:opacity-90"
                                    >
                                        <IoTrashOutline size={18} /> Delete
                                    </button>
                                )}

                                <button
                                    onClick={() => setRvVisible(false)}
                                    className="px-4 h-11 rounded-lg bg-gray-500 text-white font-black text-sm hover:opacity-90"
                                >
                                    Cancel
                                </button>

                                <button
                                    onClick={submitReview}
                                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 h-11 rounded-lg text-white font-black text-sm hover:opacity-90"
                                    style={{ backgroundColor: EKARI.forest }}
                                >
                                    <IoCheckmark size={18} />
                                    {myReview ? "Save" : "Submit"}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
}
