/* --- Notification UI helpers --- */
import { motion } from "framer-motion";
import {
    IoHeart,
    IoChatbubbleEllipses,
    IoPersonAdd,
    IoEye,
    IoNotificationsOutline,
    IoCardOutline,
    IoChatboxOutline,
    IoCalendarOutline,
    IoDocumentTextOutline,
    IoCalendarNumberOutline,
    IoCloseCircleOutline,
    IoCheckmarkCircle,
    IoShieldCheckmarkOutline,
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
type Notif = {
    id: string;
    type?:
    | "like"
    | "comment"
    | "follow"
    | "profile_view"
    | "payment_success"
    | "new_deed"
    | "new_event"
    | "new_discussion"
    | "admin_broadcast"
    | "expert_booking_created"
    | "expert_booking_cancelled"
    | "expert_booking_accepted"
    | "expert_booking_declined"
    | "expert_booking_confirmed"
    | "expert_booking_completed"
    | string;
    byName?: string;
    byUserId?: string;
    byPhotoURL?: string | null;
    handle?: string;
    title?: string;
    message?: string;
    preview?: string;
    createdAt?: any;
    seen?: boolean;
    bookingId?: string;
    expertId?: string;
    clientId?: string;
    deedId?: string;
    eventId?: string;
    discussionId?: string;
    deepLink?: string;
    meta?: {
        kind?: string;
        bookingId?: string;
        expertId?: string;
        clientId?: string;
        [key: string]: any;
    };
};


function tsToDate(ts: any): Date | null {
    if (!ts) return null;
    if (typeof ts?.toDate === "function") return ts.toDate();
    if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000);
    if (ts instanceof Date) return ts;
    if (typeof ts === "number") return new Date(ts);
    return null;
}
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

        case "payment_success":
            return {
                icon: <IoCardOutline size={16} />,
                iconBg: "bg-amber-600",
                ring: "ring-amber-100",
                chip: "bg-amber-50 text-amber-700",
                label: "Payment",
            };

        // ✅ NEW: author created content (followers feed)
        case "new_deed":
            return {
                icon: <IoDocumentTextOutline size={16} />,
                iconBg: "bg-indigo-600",
                ring: "ring-indigo-100",
                chip: "bg-indigo-50 text-indigo-700",
                label: "Deed",
            };

        case "new_event":
            return {
                icon: <IoCalendarOutline size={16} />,
                iconBg: "bg-fuchsia-600",
                ring: "ring-fuchsia-100",
                chip: "bg-fuchsia-50 text-fuchsia-700",
                label: "Event",
            };

        case "new_discussion":
            return {
                icon: <IoChatboxOutline size={16} />,
                iconBg: "bg-teal-600",
                ring: "ring-teal-100",
                chip: "bg-teal-50 text-teal-700",
                label: "Discussion",
            };

        case "expert_booking_created":
            return {
                icon: <IoCalendarNumberOutline size={16} />,
                iconBg: "bg-amber-600",
                ring: "ring-amber-100",
                chip: "bg-amber-50 text-amber-700",
                label: "New request",
            };

        case "expert_booking_cancelled":
            return {
                icon: <IoCloseCircleOutline size={16} />,
                iconBg: "bg-rose-600",
                ring: "ring-rose-100",
                chip: "bg-rose-50 text-rose-700",
                label: "Cancelled",
            };

        case "expert_booking_accepted":
            return {
                icon: <IoCheckmarkCircle size={16} />,
                iconBg: "bg-blue-600",
                ring: "ring-blue-100",
                chip: "bg-blue-50 text-blue-700",
                label: "Accepted",
            };

        case "expert_booking_declined":
            return {
                icon: <IoCloseCircleOutline size={16} />,
                iconBg: "bg-red-600",
                ring: "ring-red-100",
                chip: "bg-red-50 text-red-700",
                label: "Declined",
            };

        case "expert_booking_confirmed":
            return {
                icon: <IoShieldCheckmarkOutline size={16} />,
                iconBg: "bg-emerald-600",
                ring: "ring-emerald-100",
                chip: "bg-emerald-50 text-emerald-700",
                label: "Confirmed",
            };

        case "expert_booking_completed":
            return {
                icon: <IoCheckmarkCircle size={16} />,
                iconBg: "bg-green-700",
                ring: "ring-green-100",
                chip: "bg-green-50 text-green-700",
                label: "Completed",
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
    if (n.type === "comment") return `${n.byName || "Someone"} commented: ${n.preview || ""}`;
    if (n.type === "follow") return `${n.byName || "Someone"} started following you.`;
    if (n.type === "profile_view") return `${n.byName || "Someone"} checked out your profile 👀`;
    if (n.type === "new_deed") return `${n.byName || "Someone"} posted a new deed.`;
    if (n.type === "new_event") return `${n.byName || "Someone"} created a new event.`;
    if (n.type === "new_discussion") return `${n.byName || "Someone"} started a new discussion.`;

    if (n.type === "expert_booking_created") {
        return n.preview || n.message || `${n.byName || "A client"} sent you a consultation request.`;
    }
    if (n.type === "expert_booking_cancelled") {
        return n.preview || n.message || "The consultation request was cancelled.";
    }
    if (n.type === "expert_booking_accepted") {
        return n.preview || n.message || "Your consultation request was accepted.";
    }
    if (n.type === "expert_booking_declined") {
        return n.preview || n.message || "Your consultation request was declined.";
    }
    if (n.type === "expert_booking_confirmed") {
        return n.preview || n.message || "Your consultation has been confirmed.";
    }
    if (n.type === "expert_booking_completed") {
        return n.preview || n.message || "Your consultation was marked as completed.";
    }

    if (n.type === "payment_success") {
        if (n.meta?.kind === "expert_consultation") {
            return n.preview || n.message || "Consultation payment successful.";
        }
        return n.preview || n.message || n.title || "Payment successful.";
    }

    if (n.type === "admin_broadcast") {
        return n.message || n.preview || n.title || "System notification";
    }

    return n.message || n.preview || n.title || "New activity.";
}
/** Safer router.push wrapper */

/** Compute where to navigate for a given notification */
function routeForNotification(n: Notif, handle?: string): string | undefined {
    if (n.deepLink && typeof n.deepLink === "string") {
        return n.deepLink;
    }

    const bookingId = n.bookingId || n.meta?.bookingId;

    if (
        n.type === "expert_booking_created" ||
        n.type === "expert_booking_cancelled"
    ) {
        return "/account/expert/bookings";
    }

    if (
        n.type === "expert_booking_accepted" ||
        n.type === "expert_booking_declined" ||
        n.type === "expert_booking_confirmed" ||
        n.type === "expert_booking_completed"
    ) {
        return bookingId
            ? `/account/bookings/${encodeURIComponent(bookingId)}`
            : "/account/bookings";
    }

    if (
        n.type === "payment_success" &&
        n.meta?.kind === "expert_consultation"
    ) {
        return bookingId
            ? `/account/bookings/${encodeURIComponent(bookingId)}`
            : "/account/bookings";
    }

    if (n.type === "follow") {
        return n.handle ? `/${encodeURIComponent(n.handle.replace(/^@/, ""))}` : "/followers";
    }

    if (n.type === "profile_view") {
        return n.handle ? `/${encodeURIComponent(n.handle.replace(/^@/, ""))}` : "/";
    }

    if (n.type === "comment" || n.type === "like") {
        if (n.deedId && n.handle) {
            return `/${encodeURIComponent(n.handle.replace(/^@/, ""))}/deed/${n.deedId}`;
        }
        return "/activity";
    }

    if (n.type === "new_deed") {
        if (n.deedId && n.handle) {
            return `/${encodeURIComponent(n.handle.replace(/^@/, ""))}/deed/${n.deedId}`;
        }
        return "/activity";
    }

    if (n.type === "new_event") {
        return n.eventId ? `/nexus/events/${n.eventId}` : "/nexus/events";
    }

    if (n.type === "new_discussion") {
        return n.discussionId
            ? `/nexus/discussions/${n.discussionId}`
            : "/nexus/discussions";
    }

    if (n.type === "payment_success") {
        const kind = n.meta?.kind || "";

        if (kind === "wallet_topup" || kind === "donation") {
            return handle ? `/${handle.replace(/^@/, "")}/earnings` : "/";
        }
        if (kind === "account_verification") return "/account/verification";
        if (kind === "package_checkout") return "/seller/dashboard";
        return "/";
    }

    return "/activity";
}

/** Single modern/clean item */
export function NotificationItem({
    n,
    handle,
    onOpen,
}: {
    n: Notif;
    handle: string;
    onOpen: (href?: string) => void;
}) {
    const href = routeForNotification(n, handle);
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