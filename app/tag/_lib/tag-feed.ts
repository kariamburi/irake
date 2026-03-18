// app/tag/_lib/tag-feed.ts
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Query } from "firebase-admin/firestore";

export const TAG_PAGE_SIZE = 24;
export const BASE_URL = "https://ekarihub.com";

function initAdmin() {
    if (getApps().length) return getApps()[0];

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error("Missing Firebase Admin environment variables");
    }

    return initializeApp({
        credential: cert({
            projectId,
            clientEmail,
            privateKey,
        }),
    });
}

export function getAdminDb() {
    return getFirestore(initAdmin());
}

export function normalizeTag(raw: string) {
    try {
        return decodeURIComponent(raw).trim();
    } catch {
        return String(raw || "").trim();
    }
}

export function safeText(v: unknown) {
    return String(v ?? "").trim();
}

export function safeDate(value?: string | Date | null) {
    const d = value ? new Date(value) : null;
    return d && !isNaN(d.getTime()) ? d : new Date();
}

export type TagDeed = {
    id: string;
    text: string;
    handle: string;
    mediaUrl?: string | null;
    posterUrl?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

export type TagPageResult = {
    items: TagDeed[];
    total: number;
    totalPages: number;
    page: number;
    hasPrev: boolean;
    hasNext: boolean;
};

function buildTagBaseQuery(tag: string): Query {
    const db = getAdminDb();

    return db
        .collection("deeds")
        .where("visibility", "==", "public")
        .where("status", "==", "ready")
        .where("tags", "array-contains", tag);
}

export async function getPublicDeedsByTagPage(
    tag: string,
    page: number,
    pageSize: number = TAG_PAGE_SIZE
): Promise<TagPageResult> {
    const db = getAdminDb();

    const totalSnap = await buildTagBaseQuery(tag).count().get();
    const total = totalSnap.data().count || 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    if (page < 1 || (total > 0 && page > totalPages)) {
        return {
            items: [],
            total,
            totalPages,
            page,
            hasPrev: page > 1,
            hasNext: false,
        };
    }

    const offset = (page - 1) * pageSize;

    const snap = await buildTagBaseQuery(tag)
        .orderBy("createdAt", "desc")
        .offset(offset)
        .limit(pageSize)
        .get();

    const items = snap.docs
        .map((doc) => {
            const d = doc.data() as any;
            const handle = safeText(d?.authorUsername || d?.authorHandle);
            if (!handle) return null;

            return {
                id: doc.id,
                text: safeText(d?.text),
                handle,
                mediaUrl: d?.mediaUrl || null,
                posterUrl: d?.posterUrl || null,
                createdAt: d?.createdAt?.toDate?.()?.toISOString?.() || null,
                updatedAt:
                    d?.updatedAt?.toDate?.()?.toISOString?.() ||
                    d?.createdAt?.toDate?.()?.toISOString?.() ||
                    null,
            } satisfies TagDeed;
        })
        .filter(Boolean) as TagDeed[];

    return {
        items,
        total,
        totalPages,
        page,
        hasPrev: page > 1,
        hasNext: page < totalPages,
    };
}