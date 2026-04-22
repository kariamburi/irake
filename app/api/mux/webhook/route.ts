// app/api/mux/webhook/route.ts
import { NextResponse, type NextRequest } from "next/server";
import Mux from "@mux/mux-node";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mux = new Mux({
    webhookSecret: process.env.MUX_WEBHOOK_SECRET!,
});

// Small helpers
function parsePassthrough(p: any): { deedId?: string; uid?: string } {
    if (!p) return {};
    if (typeof p === "string") {
        try {
            return JSON.parse(p);
        } catch {
            return { deedId: p };
        }
    }
    if (typeof p === "object") return p as any;
    return {};
}

function parseGsUrl(gsUrl: string): { bucket: string; path: string } | null {
    if (!gsUrl.startsWith("gs://")) return null;
    const rest = gsUrl.slice("gs://".length);
    const slash = rest.indexOf("/");
    if (slash === -1) return null;
    return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
}

async function deleteIfGsUrl(gsUrl?: string): Promise<boolean> {
    try {
        if (!gsUrl || !gsUrl.startsWith("gs://")) return false;
        const parsed = parseGsUrl(gsUrl);
        if (!parsed) return false;

        const storage = getStorage();
        const bucket =
            storage.bucket(parsed.bucket) || storage.bucket();

        await bucket.file(parsed.path).delete({ ignoreNotFound: true });
        return true;
    } catch {
        return false;
    }
}

export async function POST(req: NextRequest) {
    const raw = await req.text();

    try {
        const event = mux.webhooks.unwrap(raw, req.headers);

        // 🔴 MOVE Firebase init INSIDE handler
        const adminDb = getAdminDb();

        if (event.type === "video.asset.ready") {
            const asset = event.data as any;
            const playbackId: string | undefined = asset?.playback_ids?.[0]?.id;

            const { deedId } = parsePassthrough(asset?.passthrough);
            if (!deedId || !playbackId) {
                return NextResponse.json({ ok: true, skipped: true });
            }

            const deedRef = adminDb.doc(`deeds/${deedId}`);
            const deedSnap = await deedRef.get();
            const deed = deedSnap.data() || {};
            const media = Array.isArray(deed.media) ? deed.media : [];
            const media0 = media[0] || {};
            const mediaType = (deed.mediaType || deed.type || "video") as
                | "video"
                | "photo"
                | "text";

            const mix = deed.mix || {};
            const explicitMode = mix.mode as
                | "video_mix"
                | "photo_to_video"
                | undefined;

            const inferredMode =
                explicitMode || (mediaType === "photo" ? "photo_to_video" : "video_mix");

            const shouldDeleteOriginal = inferredMode === "video_mix";

            let purged = false;
            let originalUrl: string | undefined = undefined;

            if (shouldDeleteOriginal) {
                originalUrl = media0?.url;
                purged = await deleteIfGsUrl(originalUrl);
            }

            const updates: Record<string, any> = {
                muxPlaybackId: playbackId,
                muxUploadId: asset?.upload_id ?? null,
                status: "ready",
                updatedAt: FieldValue.serverTimestamp(),
                originalPurged: purged === true,
                originalPurgedAt: FieldValue.serverTimestamp(),
                originalUrlWas: originalUrl || null,
            };

            if (inferredMode === "photo_to_video") {
                updates.mediaType = "video";
            }

            if (!purged) {
                updates.originalPurgeError = true;
            }

            await deedRef.set(updates, { merge: true });
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Mux webhook error:", err);
        return new NextResponse("Invalid signature or processing failure", {
            status: 400,
        });
    }
}