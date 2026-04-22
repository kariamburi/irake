// app/s/[handle]/page.tsx
import { redirect } from "next/navigation";
import { getAdminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function StoreAliasPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  const raw = handle || "";
  const handleLower = decodeURIComponent(raw).trim().toLowerCase();

  if (!handleLower) redirect("/market");

  try {
    const adminDb = getAdminDb();

    const snap = await adminDb
      .collection("users")
      .where("handle", "==", handleLower)
      .limit(1)
      .get();

    if (snap.empty) redirect("/market");

    const sellerId = snap.docs[0].id;
    redirect(`/store/${encodeURIComponent(sellerId)}`);
  } catch (e) {
    console.error("Store alias resolution failed:", e);
    redirect("/market");
  }
}