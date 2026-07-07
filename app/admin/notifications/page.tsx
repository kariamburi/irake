"use client";

import React, { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
};

export default function AdminNotificationsPage() {
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [sendPush, setSendPush] = useState(true);
    const [sendEmail, setSendEmail] = useState(false);
    const [target, setTarget] = useState<"all" | "captured_source">("all");
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState("");
    const [progress, setProgress] = useState<any>(null);
    const [currentBroadcastId, setCurrentBroadcastId] = useState<string | null>(null);
    async function handleSend(e: React.FormEvent) {
        e.preventDefault();
        setSending(true);
        setError("");
        setResult(null);
        setProgress(null);

        try {
            const fn = httpsCallable(getFunctions(app), "adminCreateBroadcastJob");

            const res: any = await fn({
                title,
                body,
                sendPush,
                sendEmail,
                target,
            });

            const broadcastId = res.data.broadcastId;
            setCurrentBroadcastId(broadcastId);

            const unsub = onSnapshot(doc(db, "adminBroadcasts", broadcastId), (snap) => {
                if (!snap.exists()) return;
                const data = snap.data();
                setProgress(data);

                if (data.status === "completed" || data.status === "failed") {
                    setSending(false);
                    setResult(data);
                    unsub();
                }
            });
        } catch (err: any) {
            console.error(err);
            setError(err?.message || err?.details || err?.code || "Failed to create broadcast job.");
            setSending(false);
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl md:text-2xl font-extrabold" style={{ color: EKARI.text }}>
                    Send Notifications
                </h1>
                <p className="text-sm" style={{ color: EKARI.dim }}>
                    Send in-app notifications, push notifications, or email to ekarihub users.
                </p>
            </div>

            <form
                onSubmit={handleSend}
                className="rounded-2xl border bg-white p-4 md:p-5 space-y-4"
                style={{ borderColor: EKARI.hair }}
            >
                <div>
                    <label className="text-xs font-bold uppercase" style={{ color: EKARI.dim }}>
                        Title
                    </label>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="mt-1 w-full rounded-xl border px-3 py-3 text-sm outline-none"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        placeholder="Example: New ekarihub update"
                    />
                </div>

                <div>
                    <label className="text-xs font-bold uppercase" style={{ color: EKARI.dim }}>
                        Message
                    </label>
                    <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={6}
                        className="mt-1 w-full rounded-xl border px-3 py-3 text-sm outline-none"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        placeholder="Write message to users..."
                    />
                </div>

                <div>
                    <label className="text-xs font-bold uppercase" style={{ color: EKARI.dim }}>
                        Target users
                    </label>

                    <select
                        value={target}
                        onChange={(e) => setTarget(e.target.value as any)}
                        className="mt-1 w-full rounded-xl border px-3 py-3 text-sm outline-none bg-white"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                    >
                        <option value="all">All users</option>
                        <option value="captured_source">Users with captured traffic source</option>
                    </select>
                </div>

                <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-2 text-sm font-bold" style={{ color: EKARI.text }}>
                        <input
                            type="checkbox"
                            checked={sendPush}
                            onChange={(e) => setSendPush(e.target.checked)}
                        />
                        Push notification
                    </label>

                    <label className="flex items-center gap-2 text-sm font-bold" style={{ color: EKARI.text }}>
                        <input
                            type="checkbox"
                            checked={sendEmail}
                            onChange={(e) => setSendEmail(e.target.checked)}
                        />
                        Email
                    </label>
                </div>

                {error && (
                    <div className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                        {error}
                    </div>
                )}

                {result && (
                    <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                        Sent successfully. Users: {result.totalUsers}, in-app: {result.notificationCount}, push:{" "}
                        {result.pushCount}, email queued: {result.emailQueued}
                    </div>
                )}
                {progress && (
                    <div className="rounded-xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
                        <div className="flex justify-between text-sm font-bold">
                            <span>Status: {progress.status}</span>
                            <span>
                                {progress.totalUsers > 0
                                    ? Math.round((progress.processed / progress.totalUsers) * 100)
                                    : 0}
                                %
                            </span>
                        </div>

                        <div className="mt-2 h-3 rounded-full bg-slate-100 overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all"
                                style={{
                                    width: `${progress.totalUsers > 0
                                        ? Math.round((progress.processed / progress.totalUsers) * 100)
                                        : 0
                                        }%`,
                                    backgroundColor: EKARI.forest,
                                }}
                            />
                        </div>

                        <div className="mt-2 text-xs" style={{ color: EKARI.dim }}>
                            Processed {progress.processed || 0} of {progress.totalUsers || 0} users ·
                            In-app {progress.notificationCount || 0} ·
                            Push {progress.pushCount || 0} ·
                            Email queued {progress.emailQueued || 0} ·
                            Failed {progress.failedCount || 0}
                        </div>

                        {currentBroadcastId && (
                            <div className="mt-1 text-[11px]" style={{ color: EKARI.dim }}>
                                Job ID: {currentBroadcastId}
                            </div>
                        )}
                    </div>
                )}
                <button
                    type="submit"
                    disabled={sending || !title.trim() || !body.trim() || (!sendPush && !sendEmail)}
                    className="rounded-xl px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50"
                    style={{ backgroundColor: EKARI.forest }}
                >
                    {sending ? "Sending..." : "Send notification"}
                </button>
            </form>
        </div>
    );
}