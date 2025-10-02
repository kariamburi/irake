// in feed/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";

export default function FeedPage() {
  return <div>Welcome to the Dashboard</div>;
}
