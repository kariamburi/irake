"use client";

import React, { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { IoTimeOutline, IoClose, IoTrashOutline } from "react-icons/io5";

type DeedStatus = "ready" | "processing" | "mixing" | "uploading" | "failed" | "deleted";

type DeedDoc = {
    status?: DeedStatus;
    mixing?: { stage?: string; at?: any };
    authorId?: string;
    caption?: string;
};

function stageLabel(s?: string) {
    if (!s) return "Starting…";
    // humanize your persisted stages from the Functions code
    // keep this list aligned with PERSISTED_STAGES in your Functions file
    const map: Record<string, string> = {
        start: "Starting…",
        "download:raw": "Downloading media…",
        "download:music:ok": "Music ready",
        "probe:music:ok": "Analyzing audio…",
        "synthesize:begin": "Rendering frames…",
        "synthesize:ok": "Frames ready",
        "ffmpeg:run": "Mixing audio & video…",
        "ffmpeg:ok": "Mix complete",
        "mux:create-upload": "Creating upload slot…",
        "mux:url": "Preparing upload…",
        "mux:put": "Uploading to Mux…",
        "mux:put:error": "Upload error",
        done: "Finalizing…",
        error: "Processing error",
    };
    return map[s] ?? s.replace(/[:_]/g, " ");
}

// coarse progress by stage — adjust weights to your pipeline
const STAGE_ORDER = [
    "start",
    "download:raw",
    "download:music:ok",
    "probe:music:ok",
    "synthesize:begin",
    "synthesize:ok",
    "ffmpeg:run",
    "ffmpeg:ok",
    "mux:create-upload",
    "mux:url",
    "mux:put",
    "done",
];

function stageProgress(stage?: string): number {
    if (!stage) return 5;
    const idx = STAGE_ORDER.indexOf(stage);
    if (idx < 0) return 15;
    const pct = Math.min(98, Math.round(((idx + 1) / STAGE_ORDER.length) * 100));
    return pct < 10 ? 10 : pct;
}

export default function DeedProcessingGate({
    deedId,
    onDone,
}: {
    deedId: string | null;
    onDone?: () => void;
}) {
    const [status, setStatus] = useState<DeedStatus | undefined>();
    const [stage, setStage] = useState<string | undefined>();
    const failed = status === "failed";
    const ready = status === "ready";

    useEffect(() => {
        if (!deedId) return;
        const unsub = onSnapshot(doc(db, "deeds", deedId), (snap) => {
            const d = snap.data() as DeedDoc | undefined;
            setStatus((d?.status as DeedStatus) ?? "processing");
            setStage(d?.mixing?.stage);
        });
        return () => unsub();
    }, [deedId]);

    // lock scroll & clicks while gate is visible (until ready/failed)
    useEffect(() => {
        const lock = !ready && !failed && !!deedId;
        if (lock) {
            const prevOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = prevOverflow;
            };
        }
    }, [ready, failed, deedId]);

    // auto-dismiss when ready
    useEffect(() => {
        if (ready) {
            if (typeof window !== "undefined") {
                const pid = sessionStorage.getItem("pendingDeedId");
                if (pid && pid === deedId) sessionStorage.removeItem("pendingDeedId");
            }
            onDone?.();
        }
    }, [ready, deedId, onDone]);

    if (!deedId) return null;

    // show overlay until we reach a terminal state
    if (!ready && !failed) {
        const pct = stageProgress(stage);
        return (
            <div className="fixed inset-0 z-[200] bg-white/80 backdrop-blur-sm">
                <div className="absolute inset-0 grid place-items-center p-4">
                    <div className="w-full max-w-md rounded-2xl border bg-white p-5 shadow-xl">
                        <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <IoTimeOutline className="opacity-70" />
                                <h3 className="text-base font-extrabold text-slate-900">Processing your video…</h3>
                            </div>
                            <span className="text-xs font-semibold rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">
                                {status ?? "processing"}
                            </span>
                        </div>

                        <p className="text-sm text-slate-600">
                            {stageLabel(stage)}<br />
                            We’ll enable playback as soon as processing finishes.
                        </p>

                        <div className="mt-4">
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                    className="h-2 rounded-full bg-sky-600 transition-all"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            <div className="mt-1 text-right text-xs tabular-nums text-slate-500">{pct}%</div>
                        </div>

                        <div className="mt-4 text-[11px] text-slate-500">
                            Tip: You can keep this tab open; we’ll unlock the page automatically.
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // failed state: only allow delete
    if (failed) {
        return <FailedOnlyDelete deedId={deedId} />;
    }

    // ready: gate hidden
    return null;
}

function FailedOnlyDelete({ deedId }: { deedId: string }) {
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);

    const onDelete = async () => {
        try {
            setBusy(true);
            await deleteDoc(doc(db, "deeds", deedId));
            setDone(true);
            if (typeof window !== "undefined") {
                const pid = sessionStorage.getItem("pendingDeedId");
                if (pid && pid === deedId) sessionStorage.removeItem("pendingDeedId");
            }
            // let the host page decide what to do next (e.g., reload or show toast)
            location.reload();
        } catch (e) {
            setBusy(false);
            alert("Could not delete. Please try again.");
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-white/90 backdrop-blur-sm">
            <div className="absolute inset-0 grid place-items-center p-4">
                <div className="w-full max-w-md rounded-2xl border bg-white p-5 shadow-xl">
                    <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-base font-extrabold text-rose-700">Processing failed</h3>
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                            failed
                        </span>
                    </div>
                    <p className="text-sm text-slate-600">
                        We couldn’t process this video. You can delete it and try uploading again.
                    </p>

                    <div className="mt-4 flex items-center justify-end gap-2">
                        <button
                            onClick={onDelete}
                            disabled={busy || done}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                        >
                            <IoTrashOutline /> {busy ? "Deleting…" : "Delete"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
