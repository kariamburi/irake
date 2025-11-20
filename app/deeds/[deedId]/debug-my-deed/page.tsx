// app/deeds/[deedId]/debug-my-deed/page.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app, db } from "@/lib/firebase";

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  hair: "#E5E7EB",
  white: "#FFFFFF",
  text: "#0F172A",
  dim: "#6B7280",
};

type Viewer = {
  id: string;
  handle?: string | null;
  firstName?: string | null;
  surname?: string | null;
  photoURL?: string | null;
  isFollowing: boolean;
};

type DeedLite = {
  id: string;
  authorId?: string;
  authorUsername?: string;
  text?: string;
};

export default function DebugMyDeedPage() {
  const params = useParams();
  const router = useRouter();
  const { deedId } = params as { deedId: string };

  const [uid, setUid] = useState<string | null>(null);
  const [deed, setDeed] = useState<DeedLite | null>(null);
  const [loadingDeed, setLoadingDeed] = useState(true);

  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [indexUrl, setIndexUrl] = useState<string | null>(null);

  // --- auth ---
  useEffect(() => {
    const auth = getAuth(app);
    return onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
    });
  }, []);

  // --- load deed basic info ---
  useEffect(() => {
    if (!deedId) return;
    setLoadingDeed(true);

    const ref = doc(db, "deeds", deedId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const d = snap.data() as any | undefined;
        if (!d) {
          setDeed(null);
        } else {
          setDeed({
            id: snap.id,
            authorId: d.authorId,
            authorUsername: d.authorUsername,
            text: d.text ?? d.caption ?? "",
          });
        }
        setLoadingDeed(false);
      },
      (err) => {
        console.error("Deed snapshot error:", err);
        setErrorMsg(err?.message || "Failed to load deed");
        setLoadingDeed(false);
      }
    );

    return () => unsub();
  }, [deedId]);

  // --- helper: extract index URL from error message ---
  const extractIndexUrl = (msg: string | undefined | null): string | null => {
    if (!msg) return null;
    const match = msg.match(
      /https:\/\/console\.firebase\.google\.com[^\s"']+/i
    );
    return match ? match[0] : null;
  };

  // --- load viewers + show index URL if missing index error ---
  const loadViewers = useCallback(async () => {
    if (!deedId) return;

    setLoadingViewers(true);
    setErrorMsg(null);
    setIndexUrl(null);

    try {
      const q = query(
        collection(db, "views"),
        where("deedId", "==", deedId),
        orderBy("createdAt", "desc"),
        limit(50)
      );

      const snap = await getDocs(q);

      const uniqueUserIds: string[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data() as any;
        if (d.userId && !uniqueUserIds.includes(d.userId)) {
          uniqueUserIds.push(d.userId);
        }
      });

      if (!uniqueUserIds.length) {
        setViewers([]);
        return;
      }

      const allUsers: any[] = [];
      for (let i = 0; i < uniqueUserIds.length; i += 10) {
        const chunk = uniqueUserIds.slice(i, i + 10);
        const uq = query(
          collection(db, "users"),
          where("__name__", "in", chunk)
        );
        const usnap = await getDocs(uq);
        usnap.forEach((u) => {
          allUsers.push({ id: u.id, ...(u.data() as any) });
        });
      }

      const userMap = new Map<string, any>();
      allUsers.forEach((u) => userMap.set(u.id, u));

      const viewerRows: Viewer[] = [];
      await Promise.all(
        uniqueUserIds.map(async (viewerId) => {
          const u = userMap.get(viewerId) || {};
          let isFollowing = false;

          if (uid) {
            const fSnap = await getDoc(
              doc(db, "follows", `${uid}_${viewerId}`)
            );
            isFollowing = fSnap.exists();
          }

          viewerRows.push({
            id: viewerId,
            handle: u.handle ?? null,
            firstName: u.firstName ?? null,
            surname: u.surname ?? null,
            photoURL: u.photoURL ?? null,
            isFollowing,
          });
        })
      );

      setViewers(viewerRows);
    } catch (e: any) {
      console.error("load viewers error:", e);

      const msg = e?.message || "Failed to load viewers";
      setErrorMsg(msg);

      const url = extractIndexUrl(msg);
      if (url) {
        setIndexUrl(url);
        // This will be clickable in the browser devtools console
        console.log(
          "⚠️ Firestore index required. Open this link to create it in Firebase Console:\n",
          url
        );
      }
    } finally {
      setLoadingViewers(false);
    }
  }, [db, deedId, uid]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: "16px",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Top bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            border: `1px solid rgba(255,255,255,0.3)`,
            background: "rgba(0,0,0,0.5)",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          ← Back
        </button>

        <div
          style={{
            padding: "6px 14px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.25)",
            background: "rgba(0,0,0,0.4)",
            fontWeight: 800,
            fontSize: 14,
          }}
        >
          Debug My Deed
        </div>

        <div style={{ width: 72 }} />
      </header>

      {/* Deed summary */}
      <section
        style={{
          borderRadius: 16,
          padding: 16,
          background: "rgba(15,23,42,0.9)",
          border: "1px solid rgba(148,163,184,0.4)",
          marginBottom: 16,
        }}
      >
        {loadingDeed ? (
          <p style={{ color: "#e5e7eb" }}>Loading deed…</p>
        ) : !deed ? (
          <p style={{ color: "#fecaca" }}>Deed not found.</p>
        ) : (
          <>
            <p
              style={{
                fontSize: 12,
                color: "#9ca3af",
                marginBottom: 4,
              }}
            >
              Deed ID:
            </p>
            <code
              style={{
                display: "inline-block",
                padding: "4px 8px",
                borderRadius: 8,
                background: "rgba(15,23,42,0.9)",
                border: "1px solid rgba(75,85,99,0.8)",
                fontSize: 12,
                marginBottom: 8,
              }}
            >
              {deed.id}
            </code>

            <p style={{ marginTop: 8, fontSize: 14, color: "#e5e7eb" }}>
              <strong>Author:</strong>{" "}
              {deed.authorUsername || deed.authorId || "Unknown"}
            </p>

            {deed.text && (
              <p
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  color: "#d1d5db",
                  whiteSpace: "pre-wrap",
                }}
              >
                {deed.text}
              </p>
            )}
          </>
        )}
      </section>

      {/* Actions */}
      <section
        style={{
          borderRadius: 16,
          padding: 16,
          background: "rgba(15,23,42,0.9)",
          border: "1px solid rgba(148,163,184,0.4)",
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 800,
            marginBottom: 8,
            color: "#f9fafb",
          }}
        >
          Viewers & Index Debug
        </h2>
        <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 12 }}>
          Click the button below to run the same Firestore query used on
          mobile. If Firestore needs an index, we&apos;ll log the Firebase
          Console link in DevTools and show it here.
        </p>

        <button
          onClick={loadViewers}
          disabled={loadingViewers}
          style={{
            padding: "10px 16px",
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 14,
            background: EKARI.gold,
            color: "#111827",
            opacity: loadingViewers ? 0.7 : 1,
          }}
        >
          {loadingViewers ? "Loading viewers…" : "Load viewers (trigger query)"}
        </button>

        {errorMsg && (
          <p
            style={{
              marginTop: 12,
              fontSize: 13,
              color: "#fecaca",
              whiteSpace: "pre-wrap",
            }}
          >
            Error: {errorMsg}
          </p>
        )}

        {indexUrl && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "rgba(24, 24, 27, 0.9)",
              border: "1px solid rgba(248, 250, 252, 0.15)",
            }}
          >
            <p
              style={{
                fontSize: 13,
                color: "#fde68a",
                marginBottom: 4,
                fontWeight: 600,
              }}
            >
              Firestore index required
            </p>
            <p style={{ fontSize: 13, color: "#e5e7eb", marginBottom: 4 }}>
              The query needs a composite index. Click this link to open Firebase
              Console and create it:
            </p>
            <a
              href={indexUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 13,
                color: "#93c5fd",
                wordBreak: "break-all",
                textDecoration: "underline",
              }}
            >
              {indexUrl}
            </a>
            <p
              style={{
                marginTop: 6,
                fontSize: 12,
                color: "#9ca3af",
              }}
            >
              The same URL is also printed in the browser console so you can
              click it from DevTools.
            </p>
          </div>
        )}
      </section>

      {/* Viewers list (if query succeeds) */}
      {viewers.length > 0 && (
        <section
          style={{
            borderRadius: 16,
            padding: 16,
            background: "rgba(15,23,42,0.9)",
            border: "1px solid rgba(148,163,184,0.4)",
          }}
        >
          <h3
            style={{
              fontSize: 15,
              fontWeight: 800,
              marginBottom: 8,
              color: "#f9fafb",
            }}
          >
            Viewers ({viewers.length})
          </h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {viewers.map((v) => {
              const displayName =
                v.firstName || v.surname
                  ? `${v.firstName || ""} ${v.surname || ""}`.trim()
                  : v.handle
                    ? `@${v.handle}`
                    : v.id.slice(0, 8);

              return (
                <li
                  key={v.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 0",
                    borderBottom: "1px solid rgba(55,65,81,0.5)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#e5e7eb",
                      }}
                    >
                      {displayName}
                    </div>
                    {v.handle && (
                      <div style={{ fontSize: 12, color: "#9ca3af" }}>
                        @{v.handle}
                      </div>
                    )}
                  </div>
                  {v.isFollowing && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: EKARI.forest,
                        color: "#fff",
                      }}
                    >
                      Following
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
