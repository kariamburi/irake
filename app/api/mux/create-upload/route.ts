// app/api/mux/create-upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import Mux from "@mux/mux-node";

export const runtime = "nodejs";        // <- important for mux-node
export const dynamic = "force-dynamic";

const mux = new Mux({
    tokenId: process.env.MUX_TOKEN_ID!,
    tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

// Optional: if your uploader can run from multiple frontends
const ORIGIN_ALLOWLIST = new Set(
    [process.env.NEXT_PUBLIC_SITE_URL, "http://localhost:3000"].filter(Boolean) as string[]
);

function pickCorsOrigin(req: NextRequest, requested?: string) {
    const fromBody = requested?.trim();
    const fromHeader = req.headers.get("origin") || undefined;
    const candidate = fromBody || fromHeader || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    // If you want to be strict, enforce allowlist; otherwise just return candidate.
    return ORIGIN_ALLOWLIST.size ? (ORIGIN_ALLOWLIST.has(candidate) ? candidate : "http://localhost:3000") : candidate;
}

// Ensure passthrough ≤ 255 *bytes* in UTF-8
function toPassthrough(input: unknown) {
    const s = typeof input === "string" ? input : JSON.stringify(input ?? {});
    if (Buffer.byteLength(s, "utf8") <= 255) return s;
    // trim by bytes, not chars
    let out = s;
    while (Buffer.byteLength(out, "utf8") > 255) {
        out = out.slice(0, -1);
    }
    return out;
}

// CORS (only if you call this from a different origin)
function corsHeaders(origin: string) {
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "content-type, authorization",
    };
}

export async function OPTIONS(req: NextRequest) {
    const origin = pickCorsOrigin(req);
    return new NextResponse(null, { headers: corsHeaders(origin) });
}

export async function POST(req: NextRequest) {
    try {
        let body: any = {};
        try {
            body = await req.json();
        } catch {
            body = {};
        }

        const origin = pickCorsOrigin(req, body?.corsOrigin);

        const playbackPolicy: ("public" | "signed")[] =
            Array.isArray(body?.playbackPolicy) && body.playbackPolicy.length
                ? body.playbackPolicy
                : ["public"];

        const params: Parameters<typeof mux.video.uploads.create>[0] = {
            cors_origin: origin,
            test: process.env.NODE_ENV !== "production",
            new_asset_settings: {
                playback_policy: playbackPolicy,
            },
        };

        if (body?.passthrough !== undefined) {
            (params.new_asset_settings as any).passthrough = toPassthrough(body.passthrough);
        }

        const upload = await mux.video.uploads.create(params);

        return NextResponse.json(
            { uploadUrl: upload.url, uploadId: upload.id },
            { headers: corsHeaders(origin) }
        );
    } catch (err: any) {
        console.error("create-upload error:", err);
        return NextResponse.json(
            { error: err?.message || "Failed to create Direct Upload" },
            { status: 500 }
        );
    }
}
