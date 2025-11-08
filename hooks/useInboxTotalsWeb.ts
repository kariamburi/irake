"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

export function useInboxTotalsWeb(enabled: boolean, uid?: string) {
    const [unreadDM, setUnreadDM] = useState(0);
    const [notifNew, setNotifNew] = useState(0);
    const [followsNew, setFollowsNew] = useState(0);

    useEffect(() => {
        if (!enabled || !uid) {
            setUnreadDM(0);
            setNotifNew(0);
            setFollowsNew(0);
            return;
        }

        const unsubs: Array<() => void> = [];

        // Sum unread across all threads (Bonga)
        unsubs.push(
            onSnapshot(collection(db, "userThreads", uid, "threads"), (snap) => {
                let total = 0;
                snap.forEach((d) => {
                    const v = (d.data() as any)?.unread ?? 0;
                    if (typeof v === "number") total += v;
                });
                setUnreadDM(total);
            })
        );

        // Unseen notifications
        unsubs.push(
            onSnapshot(
                query(collection(db, "users", uid, "notifications"), where("seen", "==", false)),
                (snap) => setNotifNew(snap.size)
            )
        );

        // Unseen followers
        unsubs.push(
            onSnapshot(
                query(collection(db, "users", uid, "followers"), where("seen", "==", false)),
                (snap) => setFollowsNew(snap.size)
            )
        );

        return () => unsubs.forEach((u) => u());
    }, [enabled, uid]);

    return {
        unreadDM,                                     // for Bonga
        notifNew,                                     // unseen notifications
        followsNew,                                   // unseen followers
        notifTotal: Math.min(999, notifNew + followsNew), // for Notifications
    };
}
