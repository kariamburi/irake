// app/s/[handle]/page.tsx
import { redirect } from "next/navigation";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * /s/[handle] -> redirects to /store/[sellerId]
 * Uses users.handleLower (or handle) to resolve sellerId.
 */
export default async function StoreAliasPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  const raw = handle || "";
  const handleLower = decodeURIComponent(raw).trim().toLowerCase();

  if (!handleLower) redirect("/market");

  // If your field is actually "handleLower", use that instead of "handle"
  const q = query(
    collection(db, "users"),
    where("handle", "==", handleLower),
    limit(1)
  );

  const snap = await getDocs(q);

  if (snap.empty) redirect("/market");

  const sellerId = snap.docs[0].id;
  redirect(`/store/${encodeURIComponent(sellerId)}`);
}
