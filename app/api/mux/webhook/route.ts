// app/api/mux/webhook/route.ts
import { NextResponse, type NextRequest } from "next/server";
import Mux from "@mux/mux-node";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mux = new Mux({
    webhookSecret: process.env.MUX_WEBHOOK_SECRET!, // you already set this
});

export async function POST(req: NextRequest) {
    const raw = await req.text();

    try {
        // Verifies signature and parses JSON
        const event = mux.webhooks.unwrap(raw, req.headers);

        if (event.type === "video.asset.ready") {
            const asset = event.data as any;
            const playbackId = asset?.playback_ids?.[0]?.id;

            // deedId came from your Direct Upload passthrough
            let deedId: string | undefined;
            if (typeof asset?.passthrough === "string" && asset.passthrough) {
                try {
                    deedId = JSON.parse(asset.passthrough)?.deedId;
                } catch {
                    deedId = asset.passthrough;
                }
            }

            if (deedId && playbackId) {
                // Use Admin SDK so rules don’t apply
                await adminDb.doc(`deeds/${deedId}`).set(
                    {
                        muxPlaybackId: playbackId,
                        status: "ready",
                        muxUploadId: asset?.upload_id ?? null,
                        updatedAt: FieldValue.serverTimestamp(),
                    },
                    { merge: true } // create if missing
                );
            }
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Mux webhook error:", err);
        // You can still 200 to avoid retries, or 400 to retry; choose what you prefer.
        return new NextResponse("Invalid signature or write failure", { status: 400 });
    }
}
