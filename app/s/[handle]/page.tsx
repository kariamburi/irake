// app/s/[handle]/page.tsx
import { redirect } from "next/navigation";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * /s/[handle] -> redirects to /store/[sellerId]
 * Uses users.handleLower to resolve sellerId.
 */
export default async function StoreAliasPage({
  params,
}: {
  params: { handle: string };
}) {
  const raw = params?.handle || "";
  const handleLower = decodeURIComponent(raw).trim().toLowerCase();

  if (!handleLower) redirect("/market");

  // Find user by handleLower
  const q = query(
    collection(db, "users"),
    where("handle", "==", handleLower),
    limit(1)
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    redirect("/market"); // or redirect("/404")
  }

  const sellerId = snap.docs[0].id;
  redirect(`/store/${encodeURIComponent(sellerId)}`);
}
