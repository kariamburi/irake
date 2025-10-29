// app/api/mux/webhook/route.ts
import { NextResponse, type NextRequest } from "next/server";
import Mux from "@mux/mux-node";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mux = new Mux({
    webhookSecret: process.env.MUX_WEBHOOK_SECRET!, // already set
});

// Small helpers
function parsePassthrough(p: any): { deedId?: string; uid?: string } {
    if (!p) return {};
    if (typeof p === "string") {
        try { return JSON.parse(p); } catch { return { deedId: p }; }
    }
    if (typeof p === "object") return p as any;
    return {};
}

function parseGsUrl(gsUrl: string): { bucket: string; path: string } | null {
    // gs://bucket/path/to/file.ext
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
            storage.bucket(parsed.bucket) ||
            storage.bucket(); // fallback to default if same bucket

        await bucket.file(parsed.path).delete({ ignoreNotFound: true });
        return true;
    } catch {
        // swallow errors to avoid webhook retry storms; we'll just mark a failure flag in Firestore below
        return false;
    }
}

export async function POST(req: NextRequest) {
    const raw = await req.text();

    try {
        // 1) Verify Mux signature and parse event
        const event = mux.webhooks.unwrap(raw, req.headers);

        if (event.type === "video.asset.ready") {
            const asset = event.data as any;
            const playbackId: string | undefined = asset?.playback_ids?.[0]?.id;

            // 2) Get deedId from passthrough
            const { deedId } = parsePassthrough(asset?.passthrough);
            if (!deedId || !playbackId) {
                // Nothing to do; return 200 so Mux doesn't retry forever.
                return NextResponse.json({ ok: true, skipped: true });
            }

            // 3) Read deed to decide what to delete
            const deedRef = adminDb.doc(`deeds/${deedId}`);
            const deedSnap = await deedRef.get();
            const deed = deedSnap.data() || {};
            const media = Array.isArray(deed.media) ? deed.media : [];
            const media0 = media[0] || {};
            const mediaType = (deed.mediaType || deed.type || "video") as "video" | "photo" | "text";
            const mix = deed.mix || {};
            const explicitMode = mix.mode as ("video_mix" | "photo_to_video" | undefined);
            const inferredMode = explicitMode || (mediaType === "photo" ? "photo_to_video" : "video_mix");

            // In both modes we expect media[0].url to be the original gs:// to purge:
            // - video_mix: gs://.../raw.mp4
            // - photo_to_video: gs://.../image.jpg
            const originalUrl: string | undefined = media0?.url;

            // 4) Try to delete the original object in Storage
            const purged = await deleteIfGsUrl(originalUrl);

            // 5) Update deed: mark ready, set playback id, record purge outcome
            //    We do NOT try to surgically remove media[0].url (array element paths are brittle).
            //    Instead, record audit fields so clients can ignore the original, and flip mediaType to "video" for photo_to_video.
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
                updates.mediaType = "video"; // downstream UIs can now treat this as a video post
            }

            if (!purged) {
                // optional: capture a soft error flag for later ops cleanup
                updates.originalPurgeError = true;
            }

            await deedRef.set(updates, { merge: true });
        }

        // You can silently accept other event types, or add branches if needed.
        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Mux webhook error:", err);
        // Return 400 to let Mux retry; or 200 if you prefer no retries.
        return new NextResponse("Invalid signature or processing failure", { status: 400 });
    }
}
