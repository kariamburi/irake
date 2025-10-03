// utils/muxUpload.ts
import * as UpChunk from "@mux/upchunk";

export async function createMuxDirectUpload(input?: {
    corsOrigin?: string;
    playbackPolicy?: ("public" | "signed")[];
    passthrough?: unknown;
}): Promise<{ uploadUrl: string; uploadId: string }> {
    const res = await fetch("/api/mux/create-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input ?? {}),
    });
    if (!res.ok) {
        throw new Error(`Failed to create Direct Upload (${res.status})`);
    }
    return res.json();
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
