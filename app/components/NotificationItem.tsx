/* --- Notification UI helpers --- */
import { motion } from "framer-motion";
import {
    IoHeart,
    IoChatbubbleEllipses,
    IoPersonAdd,
    IoEye,
    IoNotificationsOutline,
} from "react-icons/io5";
import { EKARI } from "../constants/constants";
import { useRouter } from "next/navigation";

const EKARI_UI = {
    primary: EKARI.gold,     // accent
    dark: EKARI.forest,      // deep brand
    hair: EKARI.hair,        // borders
    text: EKARI.text,        // headings
    dim: EKARI.dim,          // subtext
};

/** Map notif type to icon + tint */
function notifMeta(n: Notif) {
    switch (n.type) {
        case "like":
            return {
                icon: <IoHeart size={16} />,
                iconBg: "bg-rose-600",
                ring: "ring-rose-100",
                chip: "bg-rose-50 text-rose-700",
                label: "Like",
            };
        case "comment":
            return {
                icon: <IoChatbubbleEllipses size={16} />,
                iconBg: "bg-sky-600",
                ring: "ring-sky-100",
                chip: "bg-sky-50 text-sky-700",
                label: "Comment",
            };
        case "follow":
            return {
                icon: <IoPersonAdd size={16} />,
                iconBg: "bg-emerald-600",
                ring: "ring-emerald-100",
                chip: "bg-emerald-50 text-emerald-700",
                label: "Follow",
            };
        case "profile_view":
            return {
                icon: <IoEye size={16} />,
                iconBg: "bg-violet-600",
                ring: "ring-violet-100",
                chip: "bg-violet-50 text-violet-700",
                label: "View",
            };
        default:
            return {
                icon: <IoNotificationsOutline size={16} />,
                iconBg: "bg-gray-700",
                ring: "ring-gray-100",
                chip: "bg-gray-50 text-gray-700",
                label: "Activity",
            };
    }
}
type Notif = {
    id: string;
    type?: "like" | "comment" | "follow" | string;
    byName?: string;
    title?: string;
    preview?: string;
    createdAt?: any;
    seen?: boolean;
    // deepLink?: string;
    // byHandle?: string;
    // byId?: string;
    // deedId?: string;
    // listingId?: string;
};

function tsToDate(ts: any): Date | null {
    if (!ts) return null;
    if (typeof ts?.toDate === "function") return ts.toDate();
    if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000);
    if (ts instanceof Date) return ts;
    if (typeof ts === "number") return new Date(ts);
    return null;
}

function shortTime(ts: any) {
    const d = tsToDate(ts);
    if (!d) return "";
    const now = new Date();
    const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();

    if (sameDay) {
        const h = d.getHours();
        const m = d.getMinutes().toString().padStart(2, "0");
        const ampm = h >= 12 ? "PM" : "AM";
        const hh = ((h + 11) % 12) + 1;
        return `${hh}:${m} ${ampm}`;
    }
    const mon = d.toLocaleString(undefined, { month: "short" });
    const day = d.getDate();
    return `${mon} ${day}`;
}

function buildPreview(n: Notif) {
    if (n.type === "like") return `${n.byName || "Someone"} liked your post.`;
    if (n.type === "comment")
        return `${n.byName || "Someone"} commented: ${n.preview || ""}`;
    if (n.type === "follow") return `${n.byName || "Someone"} started following you.`;
    return n.title || "New activity.";
}
/** Safer router.push wrapper */
function pushSafe(router: ReturnType<typeof useRouter>, href?: string) {
    if (!href || typeof href !== "string") return;
    try {
        router.push(href);
    } catch {
        // no-op
    }
}

/** Compute where to navigate for a given notification */
function routeForNotification(n: Notif): string | undefined {
    const anyN = n as any;

    if (anyN.deepLink && typeof anyN.deepLink === "string") {
        return anyN.deepLink;
    }

    if (n.type === "follow") {
        if (anyN.byHandle) return `/u/${anyN.byHandle}`;
        if (anyN.byId) return `/u/${anyN.byId}`;
        return "/followers";
    }

    if (n.type === "comment" || n.type === "like") {
        if (anyN.deedId) return `/deeds/${anyN.deedId}`;
        if (anyN.listingId) return `/market/${anyN.listingId}`;
        return "/activity";
    }

    return "/activity";
}

/** Single modern/clean item */
export function NotificationItem({
    n,
    onOpen,
}: {
    n: Notif;
    onOpen: (href?: string) => void;
}) {
    const href = routeForNotification(n);
    const meta = notifMeta(n);
    const isUnread = n.seen === false;

    return (
        <motion.li
            layout
            role="button"
            tabIndex={0}
            onClick={() => onOpen(href)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(href)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.995 }}
            className={[
                "px-4 py-3 cursor-pointer select-none",
                "bg-white/90 backdrop-blur-sm",
                "transition-all duration-200",
            ].join(" ")}
            style={{
                borderRadius: 12,
                border: `1px solid ${EKARI_UI.hair}`,
            }}
        >
            <div className="flex items-start gap-3">
                {/* Icon bubble */}
                <div
                    className={[
                        "mt-0.5 h-9 w-9 shrink-0 rounded-full grid place-items-center text-white",
                        meta.iconBg,
                        "ring-4",
                        meta.ring,
                    ].join(" ")}
                >
                    {meta.icon}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div
                                className="text-[13.5px] font-semibold leading-5"
                                style={{ color: EKARI_UI.text }}
                            >
                                {buildPreview(n)}
                            </div>

                            {n.type === "comment" && n.preview ? (
                                <div
                                    className="mt-1 text-[13px] line-clamp-2"
                                    style={{ color: EKARI_UI.dim }}
                                >
                                    {n.preview}
                                </div>
                            ) : null}

                            {/* Type chip */}
                            <div className="mt-2 flex items-center gap-2">
                                <span
                                    className={[
                                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold",
                                        meta.chip,
                                    ].join(" ")}
                                >
                                    {meta.label}
                                </span>
                                {isUnread && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-700">
                                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                                        New
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Time */}
                        <div className="pt-0.5 text-xs whitespace-nowrap" style={{ color: EKARI_UI.dim }}>
                            {shortTime(n.createdAt)}
                        </div>
                    </div>
                </div>
            </div>
        </motion.li>
    );
}
