// utils/muxUpload.ts
import * as UpChunk from "@mux/upchunk";

export async function createMuxDirectUpload(input?: {
    corsOrigin?: string;
    playbackPolicy?: ("public" | "signed")[];
    passthrough?: unknown;
}): Promise<{ uploadUrl: string; uploadId: string }> {
    let res: Response;
    try {
        res = await fetch(
            "https://us-central1-ekarihub-aed5a.cloudfunctions.net/muxCreateUpload",
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(input ?? {}),
            }
        );
    } catch (e: any) {
        // Network / CORS / DNS errors → "Failed to fetch"
        console.error("muxCreateUpload network error", e);
        throw new Error(e?.message || "Network error calling muxCreateUpload");
    }

    let payload: any = null;
    const text = await res.text();
    try {
        payload = text ? JSON.parse(text) : null;
    } catch {
        // ignore JSON parse error, we'll still use text for debugging
    }

    if (!res.ok) {
        const msg =
            payload?.message ||
            payload?.error ||
            `Failed to create Direct Upload (HTTP ${res.status})`;
        console.error("muxCreateUpload HTTP error", res.status, payload || text);
        throw new Error(msg);
    }

    if (!payload?.uploadUrl || !payload?.uploadId) {
        console.error("muxCreateUpload missing fields", payload);
        throw new Error("muxCreateUpload did not return uploadUrl/uploadId");
    }

    return {
        uploadUrl: payload.uploadUrl,
        uploadId: payload.uploadId,
    };
}

export async function uploadVideoToMux(opts: {
    file: File;
    uploadUrl: string;                   // directUpload.url from your API
    onProgress?: (pct: number) => void;  // 0..100
}): Promise<void> {
    const { file, uploadUrl, onProgress } = opts;

    await new Promise<void>((resolve, reject) => {
        const upload = UpChunk.createUpload({
            file,
            endpoint: uploadUrl,    // <-- IMPORTANT: pass the Mux Direct Upload URL
            chunkSize: 5_120,       // KB (5MB). Tweak if you need smaller chunks behind CDNs.
        });

        upload.on("progress", (evt: any) => {
            // evt.detail is a number 0..100
            const pct =
                typeof evt?.detail === "number"
                    ? evt.detail
                    : Number(evt?.detail?.percent ?? evt?.detail?.pct ?? 0);
            onProgress?.(pct);
        });

        upload.on("error", (evt: any) => {
            const msg =
                evt?.detail?.message || evt?.detail || "Upload failed (unknown error)";
            reject(new Error(String(msg)));
        });

        upload.on("success", () => resolve());
    });
}
