// app/api/mux/create-upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import Mux from "@mux/mux-node";

const mux = new Mux({
    tokenId: process.env.MUX_TOKEN_ID!,
    tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

export async function POST(req: NextRequest) {
    try {
        const { passthrough } = await req.json().catch(() => ({}));
        const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_ORIGIN || "*";

        const upload = await mux.video.uploads.create({
            cors_origin: origin, // <- IMPORTANT for local dev and prod
            new_asset_settings: {
                playback_policy: ["public"],
                // DO NOT request mp4_support on basic plan
                // mp4_support: "none",
                passthrough: passthrough ? JSON.stringify(passthrough) : undefined,
            },
        });

        return NextResponse.json({ uploadUrl: upload.url, uploadId: upload.id });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || "Failed" }, { status: 400 });
    }
}
