// app/deeds/data/deedsFeedWeb.ts
import {
    collection,
    documentId,
    DocumentData,
    getDocs,
    limit,
    orderBy,
    query,
    Query,
    QueryConstraint,
    startAfter,
    where,
    getDoc,
    doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type PhotoItem = {
    url: string;
    previewUrl?: string | null;
};

export type Visibility = "public" | "followers" | "private";

export type Deed = {
    id: string;
    authorId: string;
    authorUsername?: string;
    authorPhotoURL?: string;
    muxPlaybackId?: string;
    posterUrl?: string | null;
    mediaUrl?: string | null;
    mediaType?: "video" | "photo" | "none";
    text?: string;
    createdAt?: any;
    visibility?: Visibility;
    tags?: string[];
    stats?: {
        views: number;
        likes: number;
        saves: number;
        completions?: number;
        watchMs?: number;
        comments?: number;
        shares?: number;
        bookmarks?: number;
    };
    durationMs?: number;
    music?: {
        title?: string;
        artist?: string;
        coverUrl?: string;
        soundId?: string;
        source?: "library" | "uploaded" | "external" | "original";
        url?: string;
    };
    authorBadge?: {
        verificationStatus?: "approved" | "pending" | "rejected" | "none";
        verificationType?: "individual" | "business" | "company" | "organization";
        verificationRoleLabel?: string | null;
        verificationOrganizationName?: string | null;
    };
    media?: any[];
    photoItems?: PhotoItem[]; // add this
    type: "video" | "photo";
    aspectRatio?: string | null;
    videoWidth?: number | null;
    videoHeight?: number | null;
    orientation?: "portrait" | "landscape" | "square" | null;
    countyTag?: string | null;
    countryTag?: string | null;
    status?: string | null;
    aspectRatioValue?: number | null;
};
export type FeedTabKey = "forYou" | "following" | "nearby";

export type FeedCursor = {
    createdAtMs: number;
    id: string;
} | null;

export type FeedPageResult<TCursor = FeedCursor> = {
    items: Deed[];
    cursor: TCursor | null;
    hasMore: boolean;
};

type FetchChannelPageParams = {
    tab: FeedTabKey;
    cursor?: FeedCursor;
    limitCount?: number;
    uid?: string | null;
};

function normalizeString(v: unknown): string | undefined {
    if (typeof v !== "string") return undefined;
    const x = v.trim();
    return x ? x : undefined;
}

function normalizeVisibility(v: unknown): Visibility | undefined {
    if (v === "public" || v === "followers" || v === "private") return v;
    return undefined;
}

function mapTags(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean);
}

function mapStats(raw: any): Deed["stats"] {
    return {
        views: Number(raw?.views ?? 0),
        likes: Number(raw?.likes ?? 0),
        saves: Number(raw?.saves ?? 0),
        completions: raw?.completions != null ? Number(raw.completions) : undefined,
        watchMs: raw?.watchMs != null ? Number(raw.watchMs) : undefined,
        comments: raw?.comments != null ? Number(raw.comments) : undefined,
        shares: raw?.shares != null ? Number(raw.shares) : undefined,
        bookmarks: raw?.bookmarks != null ? Number(raw.bookmarks) : undefined,
    };
}

function detectOrientation(
    width?: number | null,
    height?: number | null,
    aspectRatio?: string | null
): Deed["orientation"] {
    if (typeof width === "number" && typeof height === "number") {
        if (width > height) return "landscape";
        if (height > width) return "portrait";
        return "square";
    }

    if (typeof aspectRatio === "string" && aspectRatio.includes(":")) {
        const [wRaw, hRaw] = aspectRatio.split(":");
        const w = Number(wRaw);
        const h = Number(hRaw);
        if (!Number.isNaN(w) && !Number.isNaN(h)) {
            if (w > h) return "landscape";
            if (h > w) return "portrait";
            return "square";
        }
    }

    return null;
}

function mapPhotoItems(media: any[]): PhotoItem[] {
    return media
        .filter((m) => {
            const mediaType = String(m?.mediaType ?? m?.kind ?? "").toLowerCase();
            return mediaType === "photo" || mediaType === "image" || !!m?.sources || !!m?.url;
        })
        .map((m) => ({
            url: m?.sources?.full ?? m?.url ?? "",
            previewUrl: m?.sources?.small ?? m?.thumbUrl ?? null,
        }))
        .filter((p) => !!p.url);
}

function tsToMs(value: any): number {
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value === "number") return value;
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "string") {
        const ms = Date.parse(value);
        return Number.isNaN(ms) ? 0 : ms;
    }
    return 0;
}

function mapAuthorBadge(raw: any): Deed["authorBadge"] | undefined {
    if (!raw || typeof raw !== "object") return undefined;

    return {
        verificationStatus:
            raw.verificationStatus === "approved" ||
                raw.verificationStatus === "pending" ||
                raw.verificationStatus === "rejected" ||
                raw.verificationStatus === "none"
                ? raw.verificationStatus
                : undefined,
        verificationType:
            raw.verificationType === "individual" ||
                raw.verificationType === "business" ||
                raw.verificationType === "company" ||
                raw.verificationType === "organization"
                ? raw.verificationType
                : undefined,
        verificationRoleLabel:
            raw.verificationRoleLabel != null ? String(raw.verificationRoleLabel) : null,
        verificationOrganizationName:
            raw.verificationOrganizationName != null
                ? String(raw.verificationOrganizationName)
                : null,
    };
}

function mapMusic(raw: any): Deed["music"] | undefined {
    if (!raw || typeof raw !== "object") return undefined;

    const source =
        raw.source === "library" ||
            raw.source === "uploaded" ||
            raw.source === "external" ||
            raw.source === "original"
            ? raw.source
            : undefined;

    return {
        title: normalizeString(raw.title),
        artist: normalizeString(raw.artist),
        coverUrl: normalizeString(raw.coverUrl),
        soundId: normalizeString(raw.soundId),
        url: normalizeString(raw.url),
        source,
    };
}

function mapDeedDoc(
    doc: any,
    opts?: { includeDeleted?: boolean }
): Deed | null {
    const d = typeof doc.data === "function" ? doc.data() : doc;
    if (!d) return null;

    const status = d.status != null ? String(d.status).toLowerCase() : null;
    if (!opts?.includeDeleted && status === "deleted") return null;

    const media = Array.isArray(d.media) ? d.media : [];
    const photoItems = mapPhotoItems(media);
    const aspectRatioValue = parseAspectRatioValue(d.videoWidth, d.videoHeight, d.aspectRatio);

    const muxPlaybackId =
        normalizeString(d.muxPlaybackId) ??
        normalizeString(d.playbackId) ??
        normalizeString(d?.mux?.playbackId);

    const posterUrl =
        normalizeString(d.posterUrl) ??
        normalizeString(d.thumbnailUrl) ??
        normalizeString(d.thumbUrl) ??
        normalizeString(d?.mux?.thumbnailUrl) ??
        normalizeString(media[0]?.thumbUrl);

    const mediaUrl =
        normalizeString(d.mediaUrl) ??
        normalizeString(d.videoUrl);

    const videoWidth =
        d.videoWidth != null ? Number(d.videoWidth) : null;
    const videoHeight =
        d.videoHeight != null ? Number(d.videoHeight) : null;
    const aspectRatio =
        d.aspectRatio != null ? String(d.aspectRatio) : null;

    const hasExplicitVideoMedia = media.some((m: any) => {
        const kind = String(m?.mediaType ?? m?.kind ?? "").toLowerCase();
        return kind === "video";
    });

    const hasExplicitPhotoMedia = media.some((m: any) => {
        const kind = String(m?.mediaType ?? m?.kind ?? "").toLowerCase();
        return kind === "photo" || kind === "image";
    });

    const type: "video" | "photo" =
        muxPlaybackId || mediaUrl || hasExplicitVideoMedia
            ? "video"
            : hasExplicitPhotoMedia || photoItems.length > 0
                ? "photo"
                : "photo";

    return {
        id: String(doc.id ?? d.id ?? ""),
        authorId: String(d.authorId ?? ""),
        authorUsername: normalizeString(d.authorUsername),
        authorPhotoURL: normalizeString(d.authorPhotoURL),
        muxPlaybackId,
        posterUrl: posterUrl ?? null,
        mediaUrl: mediaUrl ?? null,
        mediaType:
            type === "video" ? "video" : photoItems.length ? "photo" : "none",
        text: normalizeString(d.text ?? d.caption ?? d.description),
        createdAt: d.createdAt ?? null,
        visibility: normalizeVisibility(d.visibility),
        tags: mapTags(d.tags),
        stats: mapStats(d.stats),
        durationMs: d.durationMs != null ? Number(d.durationMs) : undefined,
        music: mapMusic(d.music),
        authorBadge: mapAuthorBadge(d.authorBadge),
        media,
        photoItems,
        type,
        aspectRatio,
        videoWidth,
        videoHeight,
        orientation: detectOrientation(videoWidth, videoHeight, aspectRatio),
        countyTag: d.countyTag != null ? String(d.countyTag) : null,
        countryTag: d.countryTag != null ? String(d.countryTag) : null,
        status: status || null,
        aspectRatioValue,
    };
}
async function getFollowingIds(uid: string): Promise<string[]> {
    if (!uid) return [];

    try {
        const snap = await getDocs(
            query(collection(db, "follows"), where("followerId", "==", uid))
        );

        const ids = new Set<string>();
        snap.forEach((docSnap) => {
            const data = docSnap.data();
            if (typeof data?.followingId === "string" && data.followingId.trim()) {
                ids.add(data.followingId.trim());
            }
        });

        return Array.from(ids);
    } catch (error) {
        console.warn("getFollowingIds error:", error);
        return [];
    }
}

async function getUserLocationTags(
    uid: string
): Promise<{ countyTag: string | null; countryTag: string | null }> {
    if (!uid) {
        return { countyTag: null, countryTag: null };
    }

    try {
        const snap = await getDocs(
            query(collection(db, "users"), where(documentId(), "==", uid), limit(1))
        );

        const data = snap.docs[0]?.data();

        const countyTag =
            data?.countyTag != null
                ? String(data.countyTag).trim().toLowerCase()
                : data?.county != null
                    ? String(data.county).trim().toLowerCase()
                    : null;

        const countryTag =
            data?.countryTag != null
                ? String(data.countryTag).trim().toLowerCase()
                : data?.country != null
                    ? String(data.country).trim().toLowerCase()
                    : null;

        return {
            countyTag: countyTag || null,
            countryTag: countryTag || null,
        };
    } catch (error) {
        console.warn("getUserLocationTags error:", error);
        return { countyTag: null, countryTag: null };
    }
}

async function collectValidItems(params: {
    baseQuery: Query<DocumentData>;
    cursor?: FeedCursor;
    limitCount?: number;
    includeDeleted?: boolean;
}): Promise<FeedPageResult<FeedCursor>> {
    const target = Math.max(1, params.limitCount ?? 10);
    const batchSize = Math.max(target * 3, 20);

    const items: Deed[] = [];
    const seen = new Set<string>();

    let workingCursor = params.cursor ?? null;
    let hasMore = true;
    let safety = 0;

    while (items.length < target && hasMore && safety < 6) {
        safety += 1;

        const constraints: QueryConstraint[] = [
            orderBy("createdAt", "desc"),
            orderBy(documentId(), "desc"),
        ];

        if (workingCursor?.createdAtMs != null && workingCursor?.id) {
            constraints.push(
                startAfter(new Date(workingCursor.createdAtMs), workingCursor.id) as unknown as QueryConstraint
            );
        }

        constraints.push(limit(batchSize));

        const snap = await getDocs(query(params.baseQuery, ...constraints));

        if (snap.empty) {
            hasMore = false;
            break;
        }

        const mapped = snap.docs
            .map((doc) => mapDeedDoc(doc, { includeDeleted: !!params.includeDeleted }))
            .filter((x): x is Deed => x !== null);

        for (const item of mapped) {
            if (!seen.has(item.id)) {
                seen.add(item.id);
                items.push(item);
            }
            if (items.length >= target) break;
        }

        const lastDoc = snap.docs[snap.docs.length - 1];
        if (!lastDoc || snap.docs.length < batchSize) {
            hasMore = false;
            break;
        }

        workingCursor = {
            createdAtMs: tsToMs(lastDoc.get("createdAt")),
            id: lastDoc.id,
        };
    }

    const finalItems = items
        .sort((a, b) => {
            const diff = tsToMs(b.createdAt) - tsToMs(a.createdAt);
            if (diff !== 0) return diff;
            return b.id.localeCompare(a.id);
        })
        .slice(0, target);

    const lastItem = finalItems[finalItems.length - 1] ?? null;

    return {
        items: finalItems,
        cursor: lastItem
            ? {
                createdAtMs: tsToMs(lastItem.createdAt),
                id: lastItem.id,
            }
            : params.cursor ?? null,
        hasMore,
    };
}

async function fetchForYouPage(
    cursor: FeedCursor = null,
    limitCount = 10
): Promise<FeedPageResult<FeedCursor>> {
    const baseQuery = query(
        collection(db, "deeds"),
        where("visibility", "==", "public")
    );

    return collectValidItems({
        baseQuery,
        cursor,
        limitCount,
    });
}

async function fetchFollowingPage(
    uid: string,
    cursor: FeedCursor = null,
    limitCount = 10
): Promise<FeedPageResult<FeedCursor>> {
    const followingIds = await getFollowingIds(uid);

    if (!followingIds.length) {
        return { items: [], cursor: null, hasMore: false };
    }

    const chunks: string[][] = [];
    for (let i = 0; i < followingIds.length; i += 10) {
        chunks.push(followingIds.slice(i, i + 10));
    }

    const allItems: Deed[] = [];

    for (const chunk of chunks) {
        const constraints: QueryConstraint[] = [
            where("visibility", "==", "public"),
            where("authorId", "in", chunk),
            orderBy("createdAt", "desc"),
            orderBy(documentId(), "desc"),
            limit(Math.max(limitCount * 2, 20)),
        ];

        if (cursor?.createdAtMs != null && cursor?.id) {
            constraints.splice(
                constraints.length - 1,
                0,
                startAfter(new Date(cursor.createdAtMs), cursor.id) as unknown as QueryConstraint
            );
        }

        const snap = await getDocs(query(collection(db, "deeds"), ...constraints));

        const mapped = snap.docs
            .map((doc) => mapDeedDoc(doc))
            .filter((x): x is Deed => x !== null);

        allItems.push(...mapped);
    }

    allItems.sort((a, b) => {
        const diff = tsToMs(b.createdAt) - tsToMs(a.createdAt);
        if (diff !== 0) return diff;
        return b.id.localeCompare(a.id);
    });

    const deduped: Deed[] = [];
    const seen = new Set<string>();

    for (const item of allItems) {
        if (!seen.has(item.id)) {
            seen.add(item.id);
            deduped.push(item);
        }
        if (deduped.length >= limitCount) break;
    }

    const lastItem = deduped[deduped.length - 1] ?? null;

    return {
        items: deduped,
        cursor: lastItem
            ? {
                createdAtMs: tsToMs(lastItem.createdAt),
                id: lastItem.id,
            }
            : cursor,
        hasMore: deduped.length >= limitCount,
    };
}
function parseAspectRatioValue(
    width?: number | null,
    height?: number | null,
    aspectRatio?: string | null
): number | null {
    if (
        typeof width === "number" &&
        typeof height === "number" &&
        width > 0 &&
        height > 0
    ) {
        return width / height;
    }

    if (typeof aspectRatio === "string" && aspectRatio.includes(":")) {
        const [wRaw, hRaw] = aspectRatio.split(":");
        const w = Number(wRaw);
        const h = Number(hRaw);
        if (!Number.isNaN(w) && !Number.isNaN(h) && w > 0 && h > 0) {
            return w / h;
        }
    }

    return null;
}
async function fetchNearbyPage(
    uid: string,
    cursor: FeedCursor = null,
    limitCount = 10
): Promise<FeedPageResult<FeedCursor>> {
    const { countyTag, countryTag } = await getUserLocationTags(uid);

    if (!countyTag && !countryTag) {
        return { items: [], cursor: null, hasMore: false };
    }

    const allItems: Deed[] = [];

    const runQuery = async (field: "countyTag" | "countryTag", value: string) => {
        const constraints: QueryConstraint[] = [
            where("visibility", "==", "public"),
            where(field, "==", value),
            orderBy("createdAt", "desc"),
            orderBy(documentId(), "desc"),
            limit(Math.max(limitCount * 2, 20)),
        ];

        if (cursor?.createdAtMs != null && cursor?.id) {
            constraints.splice(
                constraints.length - 1,
                0,
                startAfter(new Date(cursor.createdAtMs), cursor.id) as unknown as QueryConstraint
            );
        }

        const snap = await getDocs(query(collection(db, "deeds"), ...constraints));

        const mapped = snap.docs
            .map((doc) => mapDeedDoc(doc))
            .filter((x): x is Deed => x !== null);

        allItems.push(...mapped);
    };

    if (countyTag) await runQuery("countyTag", countyTag);
    if (countryTag) await runQuery("countryTag", countryTag);

    allItems.sort((a, b) => {
        const diff = tsToMs(b.createdAt) - tsToMs(a.createdAt);
        if (diff !== 0) return diff;
        return b.id.localeCompare(a.id);
    });

    const deduped: Deed[] = [];
    const seen = new Set<string>();

    for (const item of allItems) {
        if (!seen.has(item.id)) {
            seen.add(item.id);
            deduped.push(item);
        }
        if (deduped.length >= limitCount) break;
    }

    const lastItem = deduped[deduped.length - 1] ?? null;

    return {
        items: deduped,
        cursor: lastItem
            ? {
                createdAtMs: tsToMs(lastItem.createdAt),
                id: lastItem.id,
            }
            : cursor,
        hasMore: deduped.length >= limitCount,
    };
}

export async function fetchChannelPage({
    tab,
    cursor = null,
    limitCount = 10,
    uid = null,
}: FetchChannelPageParams): Promise<FeedPageResult<FeedCursor>> {
    if (tab === "forYou") {
        return fetchForYouPage(cursor, limitCount);
    }

    if (!uid) {
        return { items: [], cursor: null, hasMore: false };
    }

    if (tab === "following") {
        return fetchFollowingPage(uid, cursor, limitCount);
    }

    if (tab === "nearby") {
        return fetchNearbyPage(uid, cursor, limitCount);
    }

    return { items: [], cursor: null, hasMore: false };
}

export async function fetchAuthorPage(
    authorId: string,
    cursor: FeedCursor = null,
    limitCount = 10,
    uid?: string | null
): Promise<FeedPageResult<FeedCursor>> {
    const cleanAuthorId = String(authorId ?? "").trim();
    if (!cleanAuthorId) {
        return { items: [], cursor: null, hasMore: false };
    }

    const isOwner = !!uid && uid === cleanAuthorId;

    let baseQuery: Query<DocumentData> = query(
        collection(db, "deeds"),
        where("authorId", "==", cleanAuthorId)
    );

    if (!isOwner) {
        baseQuery = query(
            collection(db, "deeds"),
            where("authorId", "==", cleanAuthorId),
            where("visibility", "==", "public")
        );
    }

    return collectValidItems({
        baseQuery,
        cursor,
        limitCount,
        includeDeleted: isOwner,
    });
}
export async function fetchSingleAuthorDeed(
    authorId: string,
    deedId: string,
    uid?: string | null
): Promise<Deed | null> {
    const cleanAuthorId = String(authorId ?? "").trim();
    const cleanDeedId = String(deedId ?? "").trim();

    if (!cleanAuthorId || !cleanDeedId) return null;

    try {
        const snap = await getDoc(doc(db, "deeds", cleanDeedId));
        if (!snap.exists()) return null;

        const mapped = mapDeedDoc(snap, {
            includeDeleted: !!uid && uid === cleanAuthorId,
        });

        if (!mapped) return null;
        if (mapped.authorId !== cleanAuthorId) return null;

        const isOwner = !!uid && uid === cleanAuthorId;

        if (!isOwner) {
            if (mapped.visibility !== "public") return null;
            if (mapped.status === "deleted") return null;
        }

        return mapped;
    } catch (error) {
        console.warn("fetchSingleAuthorDeed error:", error);
        return null;
    }
}

export async function fetchAuthorPageExcluding(
    authorId: string,
    excludeIds: string[] = [],
    cursor: FeedCursor = null,
    limitCount = 10,
    uid?: string | null
): Promise<FeedPageResult<FeedCursor>> {
    const page = await fetchAuthorPage(authorId, cursor, Math.max(limitCount * 2, 20), uid);

    const exclude = new Set(
        excludeIds.map((x) => String(x ?? "").trim()).filter(Boolean)
    );

    const filtered = page.items.filter((item) => !exclude.has(item.id)).slice(0, limitCount);

    let nextCursor = page.cursor;
    let hasMore = page.hasMore;

    return {
        items: filtered,
        cursor: nextCursor,
        hasMore,
    };
}