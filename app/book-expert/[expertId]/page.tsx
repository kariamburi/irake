"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import {
    addDoc,
    collection,
    doc,
    getDoc,
    serverTimestamp,
} from "firebase/firestore";
import {
    IoArrowBack,
    IoCalendarClearOutline,
    IoCheckmarkCircleOutline,
    IoLocationOutline,
    IoTimeOutline,
    IoVideocamOutline,
    IoCallOutline,
    IoChatbubbleEllipsesOutline,
} from "react-icons/io5";

import AppShell from "@/app/components/AppShell";
import { useAuth } from "@/app/hooks/useAuth";
import { db } from "@/lib/firebase";

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    text: "#111827",
    subtext: "#6B7280",
    hair: "#E5E7EB",
    soft: "#F8FAFC",
    success: "#15803D",
    danger: "#B42318",
};

type FeeType = "fixed" | "starting_from" | "free";

type PublicExpertProfile = {
    uid: string;
    handle?: string;
    displayName?: string;
    name?: string;
    photoURL?: string;
    headline?: string;
    consultationMethods?: string[];
    acceptingBookings?: boolean;
    status?: string;
    isDiscoverable?: boolean;
    primaryLocation?: {
        county?: string;
        town?: string;
    };
    pricing?: {
        currency?: string;
        consultationFee?: number;
        feeType?: FeeType;
        consultationDurationMinutes?: number;
        physicalVisitFeeFrom?: number | null;
    };
};

type FormState = {
    consultationMethod: string;
    consultationDate: string;
    consultationTime: string;
    topic: string;
    message: string;
};

const INITIAL_FORM: FormState = {
    consultationMethod: "",
    consultationDate: "",
    consultationTime: "",
    topic: "",
    message: "",
};

function formatMethod(value: string) {
    return value
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function methodIcon(method: string) {
    const normalized = method.toLowerCase();
    if (normalized.includes("video")) return <IoVideocamOutline size={18} />;
    if (normalized.includes("phone") || normalized.includes("call")) {
        return <IoCallOutline size={18} />;
    }
    if (
        normalized.includes("physical") ||
        normalized.includes("office") ||
        normalized.includes("visit") ||
        normalized.includes("in person")
    ) {
        return <IoLocationOutline size={18} />;
    }
    return <IoChatbubbleEllipsesOutline size={18} />;
}

function formatMoney(amount: number, currency = "KES") {
    if (currency === "KES") {
        return `KSh ${Number(amount || 0).toLocaleString("en-KE", {
            maximumFractionDigits: 0,
        })}`;
    }

    return `${currency} ${Number(amount || 0).toLocaleString()}`;
}

function todayInputValue() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60_000)
        .toISOString()
        .slice(0, 10);
}

export default function BookExpertPage() {
    const router = useRouter();
    const params = useParams<{ expertId: string }>();
    const { user } = useAuth();

    const expertId = React.useMemo(() => {
        const raw = params?.expertId || "";
        try {
            return decodeURIComponent(raw);
        } catch {
            return raw;
        }
    }, [params?.expertId]);

    const [expert, setExpert] = React.useState<PublicExpertProfile | null>(null);
    const [form, setForm] = React.useState<FormState>(INITIAL_FORM);
    const [loading, setLoading] = React.useState(true);
    const [submitting, setSubmitting] = React.useState(false);
    const [successId, setSuccessId] = React.useState<string | null>(null);
    const [error, setError] = React.useState("");

    React.useEffect(() => {
        let cancelled = false;

        async function loadExpert() {
            if (!expertId) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError("");

                const snapshot = await getDoc(doc(db, "publicExperts", expertId));
                if (!snapshot.exists()) {
                    if (!cancelled) setExpert(null);
                    return;
                }

                const data = snapshot.data() as Partial<PublicExpertProfile>;
                if (data.status !== "active" || data.isDiscoverable !== true) {
                    if (!cancelled) setExpert(null);
                    return;
                }

                const loadedExpert: PublicExpertProfile = {
                    ...data,
                    uid: data.uid || snapshot.id,
                };

                if (!cancelled) {
                    setExpert(loadedExpert);
                    const firstMethod = loadedExpert.consultationMethods?.[0] || "";
                    setForm((previous) => ({
                        ...previous,
                        consultationMethod:
                            previous.consultationMethod || firstMethod,
                    }));
                }
            } catch (loadError: any) {
                console.error("LOAD_PUBLIC_EXPERT_FAILED", loadError);
                if (!cancelled) {
                    setError(loadError?.message || "Could not load this expert.");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void loadExpert();
        return () => {
            cancelled = true;
        };
    }, [expertId]);

    const expertName =
        expert?.displayName || expert?.name || expert?.handle || "Expert";
    const methods = expert?.consultationMethods || [];
    const currency = expert?.pricing?.currency || "KES";
    const feeType = expert?.pricing?.feeType || "fixed";
    const fee = feeType === "free" ? 0 : Number(expert?.pricing?.consultationFee || 0);
    const duration = Number(expert?.pricing?.consultationDurationMinutes || 0);

    const feeLabel =
        feeType === "free"
            ? "Free"
            : feeType === "starting_from"
                ? `From ${formatMoney(fee, currency)}`
                : formatMoney(fee, currency);

    function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((previous) => ({ ...previous, [key]: value }));
        if (error) setError("");
    }

    function validate() {
        if (!user?.uid) return "Please sign in before requesting a consultation.";
        if (!expert) return "This expert profile is not available.";
        if (user.uid === expert.uid) return "You cannot book your own expert profile.";
        if (expert.acceptingBookings === false) {
            return "This expert is not accepting consultation requests right now.";
        }
        if (!form.consultationMethod) return "Choose a consultation method.";
        if (!form.consultationDate) return "Choose a consultation date.";
        if (!form.consultationTime) return "Choose a consultation time.";
        if (!form.topic.trim()) return "Enter the consultation topic.";
        if (form.topic.trim().length < 3) return "The topic is too short.";
        if (form.message.trim().length > 1000) {
            return "The message must be 1,000 characters or fewer.";
        }

        const requestedAt = new Date(
            `${form.consultationDate}T${form.consultationTime}:00`
        );
        if (Number.isNaN(requestedAt.getTime()) || requestedAt.getTime() <= Date.now()) {
            return "Choose a future date and time.";
        }

        return "";
    }

    async function resolveClientProfile() {
        const fallbackName =
            user?.displayName || user?.email?.split("@")[0] || "Ekarihub member";

        if (!user?.uid) {
            return { clientName: fallbackName, clientPhotoURL: "" };
        }

        try {
            const userSnapshot = await getDoc(doc(db, "users", user.uid));
            if (!userSnapshot.exists()) {
                return {
                    clientName: fallbackName,
                    clientPhotoURL: user.photoURL || "",
                };
            }

            const data = userSnapshot.data() as any;
            const fullName = [data.firstName, data.surname]
                .filter(Boolean)
                .join(" ")
                .trim();

            return {
                clientName:
                    fullName || data.displayName || data.name || fallbackName,
                clientPhotoURL:
                    data.photoURL || data.avatarUrl || user.photoURL || "",
            };
        } catch {
            return {
                clientName: fallbackName,
                clientPhotoURL: user.photoURL || "",
            };
        }
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const validationError = validate();
        if (validationError) {
            setError(validationError);
            if (!user?.uid) {
                const redirect = `/book-expert/${encodeURIComponent(expertId)}`;
                router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
            }
            return;
        }

        if (!user?.uid || !expert) return;

        try {
            setSubmitting(true);
            setError("");

            const client = await resolveClientProfile();
            const booking = await addDoc(collection(db, "expertBookings"), {
                expertId: expert.uid,
                expertName,
                expertHandle: expert.handle || null,
                expertPhotoURL: expert.photoURL || null,

                clientId: user.uid,
                clientName: client.clientName,
                clientPhotoURL: client.clientPhotoURL || null,
                clientEmail: user.email || null,

                consultationMethod: form.consultationMethod,
                consultationDate: form.consultationDate,
                consultationTime: form.consultationTime,
                consultationDurationMinutes: duration || null,
                topic: form.topic.trim(),
                message: form.message.trim(),

                fee,
                feeType,
                currency,

                status: "pending",
                paymentStatus: "unpaid",

                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            setSuccessId(booking.id);
            setForm((previous) => ({
                ...INITIAL_FORM,
                consultationMethod:
                    expert.consultationMethods?.[0] || previous.consultationMethod,
            }));
        } catch (submitError: any) {
            console.error("CREATE_EXPERT_BOOKING_FAILED", submitError);
            setError(
                submitError?.message ||
                "Could not submit your consultation request. Please try again."
            );
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <AppShell>
                <main className="min-h-screen bg-slate-50 px-4 py-8">
                    <div className="mx-auto max-w-4xl animate-pulse rounded-[28px] border bg-white p-6">
                        <div className="h-6 w-44 rounded bg-slate-200" />
                        <div className="mt-6 h-24 rounded-2xl bg-slate-100" />
                        <div className="mt-5 h-80 rounded-2xl bg-slate-100" />
                    </div>
                </main>
            </AppShell>
        );
    }

    if (!expert) {
        return (
            <AppShell>
                <main className="min-h-screen bg-slate-50 px-4 py-10">
                    <div className="mx-auto max-w-xl rounded-[28px] border bg-white p-8 text-center shadow-sm">
                        <h1 className="text-xl font-black" style={{ color: EKARI.text }}>
                            Expert unavailable
                        </h1>
                        <p className="mt-3 text-sm" style={{ color: EKARI.subtext }}>
                            This expert profile is unpublished, paused, or no longer available.
                        </p>
                        <button
                            type="button"
                            onClick={() => router.push("/ekari-experts")}
                            className="mt-6 rounded-2xl px-5 py-3 text-sm font-black text-white"
                            style={{ backgroundColor: EKARI.forest }}
                        >
                            Browse ekariExperts
                        </button>
                    </div>
                </main>
            </AppShell>
        );
    }

    if (successId) {
        return (
            <AppShell>
                <main className="min-h-screen bg-slate-50 w-full px-4 py-10">
                    <div className="mx-auto max-w-xl rounded-[28px] border bg-white p-8 text-center shadow-sm">
                        <IoCheckmarkCircleOutline
                            className="mx-auto"
                            size={58}
                            style={{ color: EKARI.success }}
                        />
                        <h1 className="mt-4 text-2xl font-black" style={{ color: EKARI.text }}>
                            Request submitted
                        </h1>
                        <p className="mt-3 text-sm leading-6" style={{ color: EKARI.subtext }}>
                            Your consultation request has been sent to {expertName}. You will
                            be notified after the expert accepts or declines it.
                        </p>
                        <div className="mt-6 grid gap-3 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => router.push("/account/bookings")}
                                className="rounded-2xl px-4 py-3 text-sm font-black text-white"
                                style={{ backgroundColor: EKARI.forest }}
                            >
                                View my bookings
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push(`/${(expert.handle || "").replace(/^@/, "")}`)}
                                className="rounded-2xl border px-4 py-3 text-sm font-black"
                                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                            >
                                Return to profile
                            </button>
                        </div>
                    </div>
                </main>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <main className="min-h-screen bg-slate-50 px-3 py-5 w-full">
                <div className="mx-auto max-w-5xl">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="mb-4 inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-bold"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                    >
                        <IoArrowBack size={17} /> Back
                    </button>

                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
                        <form
                            onSubmit={handleSubmit}
                            className="rounded-[28px] border bg-white p-5 shadow-sm md:p-7"
                            style={{ borderColor: EKARI.hair }}
                        >
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: EKARI.gold }}>
                                    ekariExperts
                                </p>
                                <h1 className="mt-2 text-2xl font-black md:text-3xl" style={{ color: EKARI.text }}>
                                    Request a consultation
                                </h1>
                                <p className="mt-2 text-sm leading-6" style={{ color: EKARI.subtext }}>
                                    Choose how and when you would like to consult {expertName}.
                                </p>
                            </div>

                            <section className="mt-7">
                                <label className="text-sm font-black" style={{ color: EKARI.text }}>
                                    Consultation method
                                </label>

                                {methods.length > 0 ? (
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        {methods.map((method) => {
                                            const selected = form.consultationMethod === method;
                                            return (
                                                <button
                                                    key={method}
                                                    type="button"
                                                    onClick={() => updateField("consultationMethod", method)}
                                                    className="flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-black transition"
                                                    style={{
                                                        borderColor: selected ? EKARI.gold : EKARI.hair,
                                                        backgroundColor: selected ? "rgba(199,146,87,0.10)" : "white",
                                                        color: EKARI.text,
                                                    }}
                                                >
                                                    <span style={{ color: selected ? EKARI.gold : EKARI.forest }}>
                                                        {methodIcon(method)}
                                                    </span>
                                                    {formatMethod(method)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="mt-3 rounded-2xl border bg-amber-50 p-4 text-sm text-amber-800">
                                        This expert has not configured consultation methods.
                                    </div>
                                )}
                            </section>

                            <section className="mt-7 grid gap-4 sm:grid-cols-2">
                                <label className="block">
                                    <span className="text-sm font-black" style={{ color: EKARI.text }}>
                                        Preferred date
                                    </span>
                                    <div className="relative mt-2">
                                        <IoCalendarClearOutline className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: EKARI.subtext }} />
                                        <input
                                            type="date"
                                            min={todayInputValue()}
                                            value={form.consultationDate}
                                            onChange={(event) => updateField("consultationDate", event.target.value)}
                                            className="h-12 w-full rounded-2xl border bg-white pl-10 pr-3 text-sm outline-none focus:ring-2"
                                            style={{ borderColor: EKARI.hair }}
                                        />
                                    </div>
                                </label>

                                <label className="block">
                                    <span className="text-sm font-black" style={{ color: EKARI.text }}>
                                        Preferred time
                                    </span>
                                    <div className="relative mt-2">
                                        <IoTimeOutline className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: EKARI.subtext }} />
                                        <input
                                            type="time"
                                            value={form.consultationTime}
                                            onChange={(event) => updateField("consultationTime", event.target.value)}
                                            className="h-12 w-full rounded-2xl border bg-white pl-10 pr-3 text-sm outline-none focus:ring-2"
                                            style={{ borderColor: EKARI.hair }}
                                        />
                                    </div>
                                </label>
                            </section>

                            <label className="mt-7 block">
                                <span className="text-sm font-black" style={{ color: EKARI.text }}>
                                    Consultation topic
                                </span>
                                <input
                                    type="text"
                                    maxLength={120}
                                    value={form.topic}
                                    onChange={(event) => updateField("topic", event.target.value)}
                                    placeholder="Example: Dairy cow feeding plan"
                                    className="mt-2 h-12 w-full rounded-2xl border bg-white px-4 text-sm outline-none focus:ring-2"
                                    style={{ borderColor: EKARI.hair }}
                                />
                                <span className="mt-1 block text-right text-[11px]" style={{ color: EKARI.subtext }}>
                                    {form.topic.length}/120
                                </span>
                            </label>

                            <label className="mt-5 block">
                                <span className="text-sm font-black" style={{ color: EKARI.text }}>
                                    Short message
                                </span>
                                <textarea
                                    rows={5}
                                    maxLength={1000}
                                    value={form.message}
                                    onChange={(event) => updateField("message", event.target.value)}
                                    placeholder="Briefly explain what you need help with and any useful background."
                                    className="mt-2 w-full resize-none rounded-2xl border bg-white px-4 py-3 text-sm leading-6 outline-none focus:ring-2"
                                    style={{ borderColor: EKARI.hair }}
                                />
                                <span className="mt-1 block text-right text-[11px]" style={{ color: EKARI.subtext }}>
                                    {form.message.length}/1000
                                </span>
                            </label>

                            {error ? (
                                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                    {error}
                                </div>
                            ) : null}

                            <button
                                type="submit"
                                disabled={submitting || methods.length === 0 || expert.acceptingBookings === false}
                                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                                style={{ background: "linear-gradient(135deg, #233F39, #C79257)" }}
                            >
                                <IoCalendarClearOutline size={18} />
                                {submitting ? "Submitting request…" : "Confirm consultation request"}
                            </button>
                        </form>

                        <aside className="h-fit rounded-[28px] border bg-white p-5 shadow-sm lg:sticky lg:top-5" style={{ borderColor: EKARI.hair }}>
                            <div className="flex items-center gap-3">
                                <img
                                    src={expert.photoURL || "/avatar-placeholder.png"}
                                    alt={expertName}
                                    className="h-16 w-16 rounded-2xl border object-cover"
                                    style={{ borderColor: EKARI.hair }}
                                />
                                <div className="min-w-0">
                                    <h2 className="truncate text-base font-black" style={{ color: EKARI.text }}>
                                        {expertName}
                                    </h2>
                                    {expert.headline ? (
                                        <p className="mt-1 line-clamp-2 text-xs leading-5" style={{ color: EKARI.subtext }}>
                                            {expert.headline}
                                        </p>
                                    ) : null}
                                </div>
                            </div>

                            <div className="mt-5 rounded-2xl p-4" style={{ backgroundColor: "rgba(35,63,57,0.06)" }}>
                                <p className="text-xs font-bold" style={{ color: EKARI.subtext }}>
                                    Consultation fee
                                </p>
                                <p className="mt-1 text-2xl font-black" style={{ color: EKARI.forest }}>
                                    {feeLabel}
                                </p>
                                {duration > 0 ? (
                                    <p className="mt-2 inline-flex items-center gap-1 text-xs" style={{ color: EKARI.subtext }}>
                                        <IoTimeOutline size={14} /> {duration} minutes
                                    </p>
                                ) : null}
                            </div>

                            {expert.primaryLocation?.town || expert.primaryLocation?.county ? (
                                <div className="mt-4 flex items-start gap-2 text-sm" style={{ color: EKARI.subtext }}>
                                    <IoLocationOutline className="mt-0.5 shrink-0" size={17} />
                                    <span>
                                        {[expert.primaryLocation.town, expert.primaryLocation.county]
                                            .filter(Boolean)
                                            .join(", ")}
                                    </span>
                                </div>
                            ) : null}

                            {expert.acceptingBookings === false ? (
                                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                    This expert is currently not accepting new clients.
                                </div>
                            ) : null}

                            <p className="mt-5 text-xs leading-5" style={{ color: EKARI.subtext }}>
                                Submitting this form creates a pending request. The expert must
                                accept it before it becomes an approved consultation.
                            </p>
                        </aside>
                    </div>
                </div>
            </main>
        </AppShell>
    );
}