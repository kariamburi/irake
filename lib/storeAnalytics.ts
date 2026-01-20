// lib/storeAnalytics.ts
import {
    doc,
    setDoc,
    increment,
    serverTimestamp,
    Timestamp,
    runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";
export type StoreTrafficSource = "market" | "search" | "share" | "profile";

function srcField(src?: StoreTrafficSource | null) {
    if (src === "market") return "srcMarketViews";
    if (src === "search") return "srcSearchViews";
    if (src === "share") return "srcShareViews";
    if (src === "profile") return "srcProfileViews";
    return null;
}

function dayKeyFromDate(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`; // YYYYMMDD
}

function dayStartTimestamp(d = new Date()) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return Timestamp.fromDate(x);
}

function storeDailyDocId(sellerId: string, dayKey: string) {
    return `${sellerId}_${dayKey}`;
}

export async function bumpStoreView(sellerId: string, source?: StoreTrafficSource | null) {
    const dayKey = dayKeyFromDate();
    const ref = doc(db, "storeDailyStats", storeDailyDocId(sellerId, dayKey));
    const f = srcField(source);

    await setDoc(
        ref,
        {
            sellerId,
            dayKey,
            dayStart: dayStartTimestamp(),
            updatedAt: serverTimestamp(),

            // ✅ bump
            storeViews: increment(1),

            // ✅ seed fields your rules likely require
            listingClicks: increment(0),
            leadsTotal: increment(0),
            leadsCall: increment(0),
            leadsWhatsApp: increment(0),
            leadsMessage: increment(0),

            srcMarketViews: increment(0),
            srcSearchViews: increment(0),
            srcShareViews: increment(0),
            srcProfileViews: increment(0),

            ...(f ? { [f]: increment(1) } : {}),
        },
        { merge: true }
    );
}


export async function bumpListingView(params: {
    sellerId: string;
    listingId: string;
}) {
    const { sellerId, listingId } = params;

    const dayKey = dayKeyFromDate();
    const dailyRef = doc(db, "storeDailyStats", storeDailyDocId(sellerId, dayKey));

    // Daily rollup (optional: you can also add listingViews7d later if you want)
    await setDoc(
        dailyRef,
        {
            sellerId,
            dayKey,
            dayStart: dayStartTimestamp(),
            updatedAt: serverTimestamp(),

            // required by your rules
            storeViews: increment(0),
            listingClicks: increment(0),
            leadsTotal: increment(0),
            leadsCall: increment(0),
            leadsWhatsApp: increment(0),
            leadsMessage: increment(0),
            srcMarketViews: increment(0),
            srcSearchViews: increment(0),
            srcShareViews: increment(0),
            srcProfileViews: increment(0),

        },
        { merge: true }
    );

    // Listing stats
    const listingRef = doc(db, "marketListings", listingId);
    await setDoc(
        listingRef,
        {
            stats: {
                views: increment(1),
                clicks: increment(0),
                leads: increment(0),
                updatedAt: serverTimestamp(),
            },
        },
        { merge: true }
    );
}

export async function bumpListingClick(params: { sellerId: string; listingId: string }) {
    const { sellerId, listingId } = params;

    const dayKey = dayKeyFromDate();
    const dailyRef = doc(db, "storeDailyStats", storeDailyDocId(sellerId, dayKey));

    await setDoc(
        dailyRef,
        {
            sellerId,
            dayKey,
            dayStart: dayStartTimestamp(),
            updatedAt: serverTimestamp(),

            // ✅ required by rules (seed)
            storeViews: increment(0),

            // ✅ the one we're bumping
            listingClicks: increment(1),

            // ✅ required by rules (seed)
            leadsTotal: increment(0),
            leadsCall: increment(0),
            leadsWhatsApp: increment(0),
            leadsMessage: increment(0),
            srcMarketViews: increment(0),
            srcSearchViews: increment(0),
            srcShareViews: increment(0),
            srcProfileViews: increment(0),

        },
        { merge: true }
    );

    // listing stats (this part should pass because your marketListings rule allows stats patch)
    const listingRef = doc(db, "marketListings", listingId);
    await setDoc(
        listingRef,
        {
            stats: {
                views: increment(0),
                clicks: increment(1),
                leads: increment(0),
                updatedAt: serverTimestamp(),
            },
        },
        { merge: true }
    );
}



function cleanDeviceId(raw?: string | null) {
    const v = (raw || "").trim();
    return v.length >= 16 ? v : null;
}

export async function bumpLead(params: {
    sellerId: string;
    listingId?: string | null;
    kind: "call" | "whatsapp" | "message";
    viewerUid?: string | null;     // pass auth uid if logged in
    deviceId?: string | null;      // pass guest device id if not logged in
}) {
    const { sellerId, listingId, kind, viewerUid, deviceId } = params;

    const dayKey = dayKeyFromDate();
    const dayStart = dayStartTimestamp();
    const dailyRef = doc(db, "storeDailyStats", storeDailyDocId(sellerId, dayKey));

    const listingKey = listingId || "store";
    const viewerKey = viewerUid || cleanDeviceId(deviceId);
    if (!viewerKey) return; // no viewer key -> skip counting

    const leadField =
        kind === "call" ? "leadsCall" : kind === "whatsapp" ? "leadsWhatsApp" : "leadsMessage";

    const eventId = `${dayKey}_${sellerId}_${listingKey}_${kind}_${viewerKey}`;
    const eventRef = doc(db, "leadEvents", eventId);

    await runTransaction(db, async (tx) => {
        const evSnap = await tx.get(eventRef);
        if (evSnap.exists()) return; // ✅ already counted today

        // ✅ create event marker
        tx.set(eventRef, {
            sellerId,
            listingId: listingId || null,
            kind,
            dayKey,
            viewerUid: viewerUid || null,
            deviceId: viewerUid ? null : cleanDeviceId(deviceId),
            createdAt: serverTimestamp(),
        });

        // ✅ update daily rollups (keep full shape for your strict rules)
        tx.set(
            dailyRef,
            {
                sellerId,
                dayKey,
                dayStart,
                updatedAt: serverTimestamp(),

                storeViews: increment(0),
                listingClicks: increment(0),

                leadsTotal: increment(1),
                leadsCall: increment(0),
                leadsWhatsApp: increment(0),
                leadsMessage: increment(0),

                [leadField]: increment(1),
                srcMarketViews: increment(0),
                srcSearchViews: increment(0),
                srcShareViews: increment(0),
                srcProfileViews: increment(0),

            },
            { merge: true }
        );

        // ✅ update listing stats too (optional)
        if (listingId) {
            const listingRef = doc(db, "marketListings", listingId);
            tx.set(
                listingRef,
                {
                    stats: {
                        views: increment(0),
                        clicks: increment(0),
                        leads: increment(1),
                        updatedAt: serverTimestamp(),
                    },
                },
                { merge: true }
            );
        }
    });
}
