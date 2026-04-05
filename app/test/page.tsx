"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  documentId,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase"; // update this path to your firebase web config

type Deed = {
  id: string;
  authorId?: string;
  visibility?: string;
  text?: string;
  type?: string;
  createdAt?: any;
};

const cleanAuthorId = "t5mOfbKWjwR124uYvc7XzKIgkX73";

export default function TestPage() {
  const [items, setItems] = useState<Deed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const q = query(
          collection(db, "deeds"),
          where("visibility", "==", "public"),
          where("authorId", "==", cleanAuthorId),
          orderBy("createdAt", "desc"),
          orderBy(documentId(), "desc")
        );

        const snap = await getDocs(q);

        if (!alive) return;

        const rows: Deed[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Deed, "id">),
        }));

        setItems(rows);
      } catch (e: any) {
        console.error("fetch deeds error:", e);
        setError(e?.message || "Failed to fetch deeds");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ marginTop: 0 }}>Test deeds query</h1>
      <p style={{ opacity: 0.8 }}>authorId: {cleanAuthorId}</p>

      {loading && <p>Loading...</p>}
      {error && (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#1a1a1a",
            padding: 12,
            borderRadius: 8,
            color: "#ff8a8a",
          }}
        >
          {error}
        </pre>
      )}

      {!loading && !error && items.length === 0 && <p>No deeds found.</p>}

      <div style={{ display: "grid", gap: 12 }}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: 16,
              background: "rgba(255,255,255,0.05)",
            }}
          >
            <div><strong>ID:</strong> {item.id}</div>
            <div><strong>Type:</strong> {item.type || "-"}</div>
            <div><strong>Visibility:</strong> {item.visibility || "-"}</div>
            <div><strong>Author:</strong> {item.authorId || "-"}</div>
            <div><strong>Text:</strong> {item.text || "-"}</div>
            <div>
              <strong>Created:</strong>{" "}
              {formatCreatedAt(item.createdAt)}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function formatCreatedAt(value: any) {
  try {
    if (!value) return "-";

    if (value instanceof Timestamp) {
      return value.toDate().toLocaleString();
    }

    if (typeof value?.toDate === "function") {
      return value.toDate().toLocaleString();
    }

    if (value?.seconds) {
      return new Date(value.seconds * 1000).toLocaleString();
    }

    return String(value);
  } catch {
    return "-";
  }
}