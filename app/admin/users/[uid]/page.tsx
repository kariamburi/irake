"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";
import { onAuthStateChanged, getAuth } from "firebase/auth";
import { db, app } from "@/lib/firebase"; // adjust if your exports differ

type BillingCycle = "monthly" | "yearly";
type SubStatus = "active" | "trialing" | "expired" | "canceled";

type UserDoc = {
  firstName?: string;
  lastName?: string;
  username?: string;
  handle?: string;
  email?: string;
  phone?: string;
  photo?: string;
  imageUrl?: string;
  verified?: boolean;
  isAdmin?: boolean;
  createdAt?: any;
};

type WalletDoc = {
  pendingBalance?: number; // USD minor
  availableBalance?: number; // optional
};

type SellerSubscription = {
  packageId: string;
  billingCycle: BillingCycle;
  status: SubStatus;
  currentPeriodEnd?: any;
  createdAt?: any;
  updatedAt?: any;
};

type PackageDoc = {
  name?: string;
  priceMonthlyUsd?: number;
  priceYearlyUsd?: number;
};

function moneyUsdFromMinor(minor?: number) {
  if (typeof minor !== "number") return "—";
  return `USD ${(minor / 100).toFixed(2)}`;
}

export default function AdminUserDetailsPage() {
  const params = useParams<{ uid: string }>();
  const uid = params?.uid;

  const [authUid, setAuthUid] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  const [loading, setLoading] = useState(true);

  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [walletDoc, setWalletDoc] = useState<WalletDoc | null>(null);
  const [sub, setSub] = useState<SellerSubscription | null>(null);
  const [pkg, setPkg] = useState<PackageDoc | null>(null);

  const [listingsCount, setListingsCount] = useState<number>(0);

  // --- auth + admin check
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(app), async (u) => {
      setCheckingAdmin(true);
      if (!u) {
        setAuthUid(null);
        setIsAdmin(false);
        setCheckingAdmin(false);
        return;
      }
      setAuthUid(u.uid);
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const data = (snap.data() as UserDoc) || {};
        setIsAdmin(!!data.isAdmin);
      } catch {
        setIsAdmin(false);
      } finally {
        setCheckingAdmin(false);
      }
    });
    return () => unsub();
  }, []);

  // --- load data
  useEffect(() => {
    if (checkingAdmin) return;
    if (!authUid || !isAdmin) {
      setLoading(false);
      return;
    }
    if (!uid) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // 1) user
        const uSnap = await getDoc(doc(db, "users", uid));
        const uData = uSnap.exists() ? ((uSnap.data() as UserDoc) || {}) : null;

        // 2) wallet
        const wSnap = await getDoc(doc(db, "wallets", uid));
        const wData = wSnap.exists() ? ((wSnap.data() as WalletDoc) || {}) : null;

        // 3) subscription
        const sSnap = await getDoc(doc(db, "sellerSubscriptions", uid));
        const sData = sSnap.exists() ? ((sSnap.data() as SellerSubscription) || null) : null;

        // 4) package doc for subscription
        let pData: PackageDoc | null = null;
        if (sData?.packageId) {
          const pSnap = await getDoc(doc(db, "packages", sData.packageId));
          pData = pSnap.exists() ? ((pSnap.data() as PackageDoc) || {}) : null;
        }

        // 5) listings count (change collection/name/filters to your schema)
        // Common patterns: "ads" with organizerId or sellerId
        let count = 0;
        try {
          const adsQ = query(
            collection(db, "ads"),
            where("organizerId", "==", uid),
            limit(1000)
          );
          const adsSnap = await getDocs(adsQ);
          count = adsSnap.size;
        } catch {
          // if your field is sellerId/userId etc, update above
          count = 0;
        }

        if (cancelled) return;

        setUserDoc(uData);
        setWalletDoc(wData);
        setSub(sData);
        setPkg(pData);
        setListingsCount(count);
      } catch (e) {
        console.error("Admin user details load error:", e);
        if (!cancelled) {
          setUserDoc(null);
          setWalletDoc(null);
          setSub(null);
          setPkg(null);
          setListingsCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, authUid, isAdmin, checkingAdmin]);

  const displayName = useMemo(() => {
    const first = userDoc?.firstName || "";
    const last = userDoc?.lastName || "";
    return (first + " " + last).trim() || userDoc?.username || userDoc?.handle || "—";
  }, [userDoc]);

  if (checkingAdmin) return <div style={{ padding: 24 }}>Checking access…</div>;
  if (!authUid) return <div style={{ padding: 24 }}>Please sign in.</div>;
  if (!isAdmin) return <div style={{ padding: 24 }}>You don’t have permission to view this page.</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>User details</h1>
          <p style={{ marginTop: 6, color: "#6B7280" }}>
            UID: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{uid}</span>
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Link
            href={`/admin/subscriptions`}
            style={{ border: "1px solid #E5E7EB", borderRadius: 999, padding: "10px 12px", fontWeight: 800, textDecoration: "none", color: "#111827" }}
          >
            ← Back
          </Link>

          <Link
            href={`/admin/payments?uid=${encodeURIComponent(uid)}&type=package`}
            style={{ border: "1px solid #E5E7EB", borderRadius: 999, padding: "10px 12px", fontWeight: 800, textDecoration: "none", color: "#111827" }}
          >
            Payments
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={{ marginTop: 14 }}>Loading user…</div>
      ) : (
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Profile */}
          <div style={{ border: "1px solid #E5E7EB", borderRadius: 16, padding: 14 }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>Profile</h2>

            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              <div><b>Name:</b> {displayName}</div>
              <div><b>Handle:</b> @{userDoc?.handle || userDoc?.username || "—"}</div>
              <div><b>Email:</b> {userDoc?.email || "—"}</div>
              <div><b>Phone:</b> {userDoc?.phone || "—"}</div>
              <div><b>Verified:</b> {userDoc?.verified ? "Yes" : "No"}</div>
            </div>
          </div>

          {/* Subscription */}
          <div style={{ border: "1px solid #E5E7EB", borderRadius: 16, padding: 14 }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>Seller subscription</h2>

            {!sub ? (
              <div style={{ marginTop: 10, color: "#6B7280" }}>No subscription document found.</div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                <div><b>Status:</b> {sub.status}</div>
                <div><b>Billing:</b> {sub.billingCycle}</div>
                <div><b>Package:</b> {pkg?.name || sub.packageId}</div>
                <div><b>Period end:</b> {sub.currentPeriodEnd ? String(sub.currentPeriodEnd?.toDate?.() ?? sub.currentPeriodEnd) : "—"}</div>
              </div>
            )}
          </div>

          {/* Wallet */}
          <div style={{ border: "1px solid #E5E7EB", borderRadius: 16, padding: 14 }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>Wallet</h2>

            {!walletDoc ? (
              <div style={{ marginTop: 10, color: "#6B7280" }}>No wallet document found.</div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                <div><b>Pending:</b> {moneyUsdFromMinor(walletDoc.pendingBalance)}</div>
                {typeof walletDoc.availableBalance === "number" ? (
                  <div><b>Available:</b> {moneyUsdFromMinor(walletDoc.availableBalance)}</div>
                ) : null}
              </div>
            )}
          </div>

          {/* Listings */}
          <div style={{ border: "1px solid #E5E7EB", borderRadius: 16, padding: 14 }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>Listings</h2>
            <div style={{ marginTop: 10 }}>
              <div><b>Total listings:</b> {listingsCount}</div>
              <div style={{ marginTop: 6, color: "#6B7280", fontSize: 12 }}>
                Update the query if your field is <code>sellerId</code> or <code>userId</code> instead of <code>organizerId</code>.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
