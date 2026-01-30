// app/api/handle/check/route.ts
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESERVED = new Set([
  "admin",
  "administrator",
  "root",
  "ekari",
  "ekarihub",
  "support",
  "help",
  "api",
  "system",
  "moderator",
  "mod",
]);

const HANDLE_REGEX = /^[a-z0-9._]{3,24}$/;

function normalizeHandleInput(h: string) {
  return (h || "").trim().replace(/^@+/, "").toLowerCase();
}

function errMsg(e: unknown) {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get("handle") || "";
  const normalized = normalizeHandleInput(handle);

  // Optional debug (remove after fixing):
  // console.log("ENV CHECK", {
  //   hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
  //   hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
  //   hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
  // });

  let adminDb;
  try {
    adminDb = getAdminDb();
  } catch (e) {
    return NextResponse.json(
      { ok: false, available: false, reason: "missing_env", message: errMsg(e) },
      { status: 500 }
    );
  }

  try {
    if (!HANDLE_REGEX.test(normalized)) {
      return NextResponse.json(
        {
          ok: true,
          available: false,
          reason: "invalid_format",
          message: "Use 3–24 chars: a–z, 0–9, dot or underscore.",
        },
        { status: 200 }
      );
    }

    if (RESERVED.has(normalized)) {
      return NextResponse.json(
        { ok: true, available: false, reason: "reserved", message: "This handle is reserved." },
        { status: 200 }
      );
    }

    // Check users collection
    let usersSnap;
    try {
      usersSnap = await adminDb
        .collection("users")
        .where("handleLower", "==", normalized)
        .limit(1)
        .get();
    } catch (e) {
      console.error("Firestore users query failed:", errMsg(e));
      return NextResponse.json(
        { ok: false, available: false, reason: "db_error_users", message: errMsg(e) },
        { status: 500 }
      );
    }

    if (!usersSnap.empty) {
      return NextResponse.json({ ok: true, available: false, reason: "taken" }, { status: 200 });
    }

    // Optional: reservations collection
    try {
      const resvDoc = await adminDb.doc(`handles/${normalized}`).get();
      if (resvDoc.exists) {
        return NextResponse.json({ ok: true, available: false, reason: "reserved" }, { status: 200 });
      }
    } catch (e) {
      console.error("Firestore reservation check failed:", errMsg(e));
      // allow through as "available" if reservations collection doesn't exist
    }

    return NextResponse.json({ ok: true, available: true }, { status: 200 });
  } catch (e) {
    console.error("handle-check error:", errMsg(e));
    return NextResponse.json(
      { ok: false, available: false, reason: "server_error", message: errMsg(e) },
      { status: 500 }
    );
  }
}
