// src/lib/repostDeed.ts

import {
    doc,
    runTransaction,
    serverTimestamp,
    increment,
    Timestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export const REPOST_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type RepostDeedResult = {
    repostedAtMs: number;
    repostCount: number;
};

function timestampToMs(value: any): number {
    if (!value) return 0;

    if (typeof value?.toMillis === "function") {
        return value.toMillis();
    }

    if (typeof value?.seconds === "number") {
        return value.seconds * 1000;
    }

    if (typeof value?._seconds === "number") {
        return value._seconds * 1000;
    }

    return 0;
}

export function getRemainingRepostTime(lastRepostedAtMs: number): string {
    const remaining = REPOST_COOLDOWN_MS - (Date.now() - lastRepostedAtMs);

    if (remaining <= 0) return "";

    const hours = Math.ceil(remaining / (60 * 60 * 1000));

    if (hours <= 1) {
        const minutes = Math.max(
            1,
            Math.ceil(remaining / (60 * 1000))
        );

        return `${minutes} minute${minutes === 1 ? "" : "s"}`;
    }

    return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export async function repostDeed(
    deedId: string,
    currentUserId: string
): Promise<RepostDeedResult> {
    const cleanDeedId = String(deedId || "").trim();
    const cleanUserId = String(currentUserId || "").trim();

    if (!cleanDeedId) {
        throw new Error("Missing deed ID.");
    }

    if (!cleanUserId) {
        throw new Error("You must sign in to repost.");
    }

    const deedRef = doc(db, "deeds", cleanDeedId);
    const nowMs = Date.now();

    return runTransaction(db, async (transaction) => {
        const deedSnapshot = await transaction.get(deedRef);

        if (!deedSnapshot.exists()) {
            throw new Error("This deed no longer exists.");
        }

        const deed = deedSnapshot.data() as any;

        if (String(deed?.authorId || "") !== cleanUserId) {
            throw new Error("You can only repost your own deed.");
        }

        if (
            deed?.status &&
            deed.status !== "ready"
        ) {
            throw new Error("Only ready deeds can be reposted.");
        }

        const lastRepostedAtMs =
            typeof deed?.repostedAtMs === "number"
                ? deed.repostedAtMs
                : timestampToMs(deed?.repostedAt);

        if (
            lastRepostedAtMs > 0 &&
            nowMs - lastRepostedAtMs < REPOST_COOLDOWN_MS
        ) {
            const remaining = getRemainingRepostTime(lastRepostedAtMs);

            throw new Error(
                `You can repost this deed again in ${remaining}.`
            );
        }

        /*
         * Preserve the very first publishing time.
         * This only gets populated during the first repost.
         */
        const originalCreatedAt =
            deed?.originalCreatedAt ??
            deed?.createdAt ??
            Timestamp.fromMillis(
                typeof deed?.createdAtMs === "number"
                    ? deed.createdAtMs
                    : nowMs
            );

        const originalCreatedAtMs =
            typeof deed?.originalCreatedAtMs === "number"
                ? deed.originalCreatedAtMs
                : typeof deed?.createdAtMs === "number"
                    ? deed.createdAtMs
                    : timestampToMs(deed?.createdAt) || nowMs;

        const currentRepostCount = Number(deed?.repostCount || 0);

        transaction.update(deedRef, {
            originalCreatedAt,
            originalCreatedAtMs,

            // These fields control recent-feed ordering.
            createdAt: serverTimestamp(),
            createdAtMs: nowMs,

            repostedAt: serverTimestamp(),
            repostedAtMs: nowMs,

            repostCount: increment(1),
            updatedAt: serverTimestamp(),
        });

        return {
            repostedAtMs: nowMs,
            repostCount: currentRepostCount + 1,
        };
    });
}