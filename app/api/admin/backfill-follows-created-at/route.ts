import { NextResponse } from "next/server";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID!,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
            privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
        }),
    });
}

const adminDb = getFirestore();

export async function GET() {
    const snap = await adminDb.collection("follows").get();

    let batch = adminDb.batch();
    let batchCount = 0;
    let updated = 0;
    let skipped = 0;

    for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const createdAt = data.createdAt;

        if (createdAt && typeof createdAt.toDate === "function") {
            skipped++;
            continue;
        }

        let newCreatedAt = Timestamp.now();

        if (typeof createdAt === "number") {
            newCreatedAt = Timestamp.fromMillis(createdAt);
        }

        batch.update(docSnap.ref, {
            createdAt: newCreatedAt,
            createdAtMs: typeof createdAt === "number" ? createdAt : Date.now(),
        });

        updated++;
        batchCount++;

        if (batchCount >= 450) {
            await batch.commit();
            batch = adminDb.batch();
            batchCount = 0;
        }
    }

    if (batchCount > 0) {
        await batch.commit();
    }

    return NextResponse.json({
        ok: true,
        total: snap.size,
        updated,
        skipped,
    });
}