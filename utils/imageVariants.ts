async function fileToImageBitmap(file: File): Promise<ImageBitmap> {
    return await createImageBitmap(file);
}

function canEncodeWebp(): boolean {
    try {
        const c = document.createElement("canvas");
        c.width = 1;
        c.height = 1;
        const url = c.toDataURL("image/webp");
        return url.startsWith("data:image/webp");
    } catch {
        return false;
    }
}

async function resizeBitmapToBlob(opts: {
    bmp: ImageBitmap;
    maxW: number;
    mime: "image/webp" | "image/jpeg";
    quality: number; // 0..1
}): Promise<{ blob: Blob; width: number; height: number }> {
    const { bmp, maxW, mime, quality } = opts;

    const srcW = bmp.width;
    const srcH = bmp.height;

    const scale = srcW > maxW ? maxW / srcW : 1;
    const outW = Math.max(1, Math.round(srcW * scale));
    const outH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas context");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, outW, outH);

    const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
            mime,
            quality
        );
    });

    return { blob, width: outW, height: outH };
}

async function blobToDataUrl(blob: Blob): Promise<string> {
    return await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ""));
        r.onerror = reject;
        r.readAsDataURL(blob);
    });
}

/**
 * TikTok-style: tiny blur + small feed + full (NO original upload)
 */
export async function buildImageVariants(file: File) {
    const bmp = await fileToImageBitmap(file);

    const width = bmp.width;
    const height = bmp.height;

    const useWebp = canEncodeWebp();
    const mime = useWebp ? ("image/webp" as const) : ("image/jpeg" as const);

    const full = await resizeBitmapToBlob({ bmp, maxW: 1440, mime, quality: useWebp ? 0.82 : 0.85 });
    const small = await resizeBitmapToBlob({ bmp, maxW: 720, mime, quality: useWebp ? 0.78 : 0.82 });

    const tiny = await resizeBitmapToBlob({ bmp, maxW: 24, mime: "image/jpeg", quality: 0.6 });
    const tinyDataUrl = await blobToDataUrl(tiny.blob);

    bmp.close?.();

    return { width, height, mime, tinyDataUrl, smallBlob: small.blob, fullBlob: full.blob };
}

