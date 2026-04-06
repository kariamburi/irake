export const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#111827",
    dim: "#6B7280",
    hair: "#E5E7EB",
    sub: "#4B5563",
};

export const AVATAR_FALLBACK = "/avatar-placeholder.png";
export const PAGE_SIZE = 50;
export const THREAD_MAX_WIDTH = "max-w-[760px]";

export function cn(...xs: (string | false | null | undefined)[]) {
    return xs.filter(Boolean).join(" ");
}

export function hexToRgba(hex: string, alpha: number) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
    if (!m) return hex;
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

export function timeAgoShort(ts: any) {
    const d = typeof ts?.toDate === "function" ? ts.toDate() : null;
    if (!d) return "";
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const dy = Math.floor(h / 24);
    if (dy < 7) return `${dy}d`;
    const w = Math.floor(dy / 7);
    if (w < 5) return `${w}w`;
    const mo = Math.floor(dy / 30);
    if (mo < 12) return `${mo}mo`;
    const y = Math.floor(dy / 365);
    return `${y}y`;
}