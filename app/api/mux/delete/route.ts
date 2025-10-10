// app/api/mux/delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import Mux from "@mux/mux-node";

const muxTokenId = process.env.MUX_TOKEN_ID!;
const muxTokenSecret = process.env.MUX_TOKEN_SECRET!;
const mux = new Mux({ tokenId: muxTokenId, tokenSecret: muxTokenSecret });

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const assetId = searchParams.get("assetId");
        if (!assetId) return NextResponse.json({ error: "assetId required" }, { status: 400 });

        await mux.video.assets.delete(assetId);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("Mux delete failed", e);
        return NextResponse.json({ error: e?.message || "Mux delete failed" }, { status: 500 });
    }
}
