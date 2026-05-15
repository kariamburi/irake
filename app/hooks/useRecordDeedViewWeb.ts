// app/hooks/useRecordDeedViewWeb.ts
"use client";

import { useEffect, useRef } from "react";
import {
    doc,
    runTransaction,
    serverTimestamp,
    increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type Args = {
    deedId?: string;
    authorId?: string | null;
    viewerId?: string | null;
    isActive: boolean;
    shouldLoad?: boolean;
    delayMs?: number;
};

function getOrCreateVisitorId() {
    if (typeof window === "undefined") return "anon";

    const key = "pv:visitorId";
    let id = window.localStorage.getItem(key);

    if (!id) {
        id = `web_${Date.now().toString(36)}_${Math.random()
            .toString(36)
            .slice(2, 12)}`;

        window.localStorage.setItem(key, id);
    }

    return id;
}

export function useRecordDeedViewWeb({
    deedId,
    authorId,
    viewerId,
    isActive,
    shouldLoad = true,
    delayMs = 2500,
}: Args) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!deedId || !isActive || !shouldLoad) return;

        // Do not count owner's own views
        if (viewerId && authorId && viewerId === authorId) return;

        timerRef.current = setTimeout(async () => {
            try {
                const today = new Date().toISOString().slice(0, 10);
                const visitorId = viewerId || getOrCreateVisitorId();

                const localKey = `deed_view:${deedId}:${visitorId}:${today}`;
                const already = window.localStorage.getItem(localKey);
                if (already) return;

                const deedRef = doc(db, "deeds", deedId);
                const viewRef = doc(
                    db,
                    "deedViews",
                    `${deedId}_${visitorId}_${today}`
                );

                await runTransaction(db, async (tx) => {
                    const viewSnap = await tx.get(viewRef);

                    if (viewSnap.exists()) return;

                    const viewPayload: any = {
                        deedId,
                        authorId: authorId || null,
                        viewerId: viewerId || null,
                        ymd: today,
                        source: "web",
                        createdAt: serverTimestamp(),
                    };

                    // Important: only guest users should write deviceId.
                    // Signed-in users must NOT send deviceId:null.
                    if (!viewerId) {
                        viewPayload.deviceId = visitorId;
                    }

                    tx.set(viewRef, viewPayload);

                    tx.update(deedRef, {
                        "stats.views": increment(1),
                        "stats.updatedAt": serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });
                });

                window.localStorage.setItem(localKey, "1");
            } catch (e) {
                console.warn("record web deed view failed", e);
            }
        }, delayMs);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [deedId, authorId, viewerId, isActive, shouldLoad, delayMs]);
}