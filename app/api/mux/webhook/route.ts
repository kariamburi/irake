// app/api/mux/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Mux from "@mux/mux-node";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const rawBody = await req.text();
    const signature = req.headers.get("mux-signature") ?? "";
    const secret = process.env.MUX_WEBHOOK_SECRET;

    if (!secret) return new NextResponse("Missing MUX_WEBHOOK_SECRET", { status: 500 });
    if (!signature) return new NextResponse("Missing mux-signature", { status: 400 });

    // ---- Verification (typed) ----
    // const isValid = Mux.Webhooks.verifyHeader(rawBody, signature, secret);

    // ---- Verification (compatible cast) ----
    const isValid = (Mux as unknown as {
        Webhooks: { verifyHeader: (b: string, s: string, sec: string) => boolean };
    }).Webhooks.verifyHeader(rawBody, signature, secret);

    if (!isValid) return new NextResponse("Invalid signature", { status: 400 });

    // Only parse after verifying the raw body
    let event: any;
    try {
        event = JSON.parse(rawBody);
    } catch {
        return new NextResponse("Invalid JSON", { status: 400 });
    }

    const { type, data } = event || {};
    if (type === "video.asset.ready" && data) {
        const asset = data as {
            id: string;
            upload_id?: string | null;
            playback_ids?: Array<{ id: string; policy: "public" | "signed" }>;
            passthrough?: string | null;
        };

        const playbackId = asset.playback_ids?.[0]?.id ?? null;

        // recover your Firestore doc id from passthrough
        let deedId: string | undefined;
        if (typeof asset.passthrough === "string" && asset.passthrough) {
            try {
                const pt = JSON.parse(asset.passthrough);
                deedId = pt?.deedId || pt?.docId;
            } catch {
                deedId = asset.passthrough; // plain string convention
            }
        }

        if (deedId && playbackId) {
            await updateDoc(doc(db, "deeds", deedId), {
                muxPlaybackId: playbackId,
                muxUploadId: asset.upload_id ?? null,
                mediaType: "video",
                updatedAtMs: Date.now(),
            });
        }
    }

    return NextResponse.json({ ok: true });
}
