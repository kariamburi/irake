// utils/muxUpload.ts
import { Upload } from "tus-js-client";

export type CreateMuxUploadResponse = {
    uploadUrl: string;
    uploadId: string;
};

export async function createMuxDirectUpload(params?: { passthrough?: any }) {

    const res = await fetch("/api/mux/create-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params ?? {}),
    });

    if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`createMuxDirectUpload failed: ${msg || res.statusText}`);
    }
    return (await res.json()) as CreateMuxUploadResponse;
}

function guessMimeFromName(name: string): string {
    const ext = name.toLowerCase().split("?")[0].split(".").pop() || "";
    switch (ext) {
        case "mp4": return "video/mp4";
        case "m4v": return "video/x-m4v";
        case "mov": return "video/quicktime";
        case "webm": return "video/webm";
        case "mp3": return "audio/mpeg";
        case "m4a": return "audio/mp4";
        case "aac": return "audio/aac";
        case "wav": return "audio/wav";
        case "ogg": return "audio/ogg";
        case "opus": return "audio/opus";
        default: return "application/octet-stream";
    }
}

/** Browser upload to Mux Direct Upload via tus */
export async function uploadVideoToMux(opts: {
    file: File | Blob;
    uploadUrl: string;
    onProgress?: (pct: number) => void;
}) {
    const { file, uploadUrl, onProgress } = opts;

    const asFile = file as File;
    const name = asFile.name || `video-${Date.now()}.mp4`;
    const filetype = asFile.type && asFile.type.length > 0 ? asFile.type : guessMimeFromName(name);

    await new Promise<void>((resolve, reject) => {
        const upload = new Upload(file, {
            uploadUrl,
            metadata: { filename: name, filetype },
            onError: (err) => reject(err),
            onProgress: (sent, total) => {
                if (onProgress && total > 0) onProgress(Math.round((sent / total) * 100));
            },
            onSuccess: () => resolve(),
        });
        upload.start();
    });
}
