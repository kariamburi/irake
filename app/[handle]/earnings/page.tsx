// app/[handle]/earnings/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  addDoc,
  collection,
  doc,
  DocumentData,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import { IoArrowBackCircleOutline } from "react-icons/io5";
import AppShell from "@/app/components/AppShell";

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  ink: "#111827",
  dim: "#6B7280",
  hair: "#E5E7EB",
  bgSoft: "#F3F4F6",
};

type Wallet = {
  totalReceived?: number; // minor units
  pendingBalance?: number; // minor units
  totalDonations?: number;
  currency?: string;
};

type Donation = {
  id: string;
  deedId: string;
  paidAmount?: number; // minor units
  paidCurrency?: string;
  paidAt?: any;
};

export default function EarningsPage() {
  const params = useParams<{ handle: string }>();
  // IMPORTANT: use handle as-is from the URL (no extra "@")
  const handle = "@" + params?.handle; // e.g. "@mwangi" if your URL is /@mwangi/earnings

  const { user, loading: authLoading } = useAuth();

  const [ownerUid, setOwnerUid] = useState<string | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [checkingOwnership, setCheckingOwnership] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [minWithdrawMajor, setMinWithdrawMajor] = useState(500); // fallback KSh 500

  // Watch adminSettings/finance for minWithdrawKES
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "adminSettings", "finance"), (snap) => {
      const data = snap.data();
      if (data?.minWithdrawKES) {
        setMinWithdrawMajor(data.minWithdrawKES);
      }
    });

    return () => unsub();
  }, []);

  // 1) Resolve [handle] -> user uid and ensure it's the signed-in user
  useEffect(() => {
    if (!handle) return;
    if (authLoading) return;

    if (!user) {
      setCheckingOwnership(false);
      setForbidden(false);
      setOwnerUid(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setCheckingOwnership(true);
      setForbidden(false);
      setNotFound(false);
      try {
        const usersQuery = query(
          collection(db, "users"),
          where("handle", "==", handle),
          limit(1)
        );

        const snap = await getDocs(usersQuery);
        if (cancelled) return;

        if (snap.empty) {
          setNotFound(true);
          setOwnerUid(null);
          return;
        }

        const docSnap = snap.docs[0];
        const profileData = docSnap.data() as { uid?: string };
        const profileUid = profileData.uid || docSnap.id;

        if (!user || user.uid !== profileUid) {
          setForbidden(true);
          setOwnerUid(null);
          return;
        }

        setOwnerUid(profileUid);
      } catch (err) {
        console.error("Error resolving handle -> uid", err);
        setForbidden(true);
        setOwnerUid(null);
      } finally {
        if (!cancelled) {
          setCheckingOwnership(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [handle, user, authLoading]);

  // 2) Listen to wallet + donations for that ownerUid
  useEffect(() => {
    if (!ownerUid) {
      setWallet(null);
      setDonations([]);
      setLoadingData(false);
      return;
    }

    setLoadingData(true);

    const walletRef = doc(db, "wallets", ownerUid);
    const unsubWallet = onSnapshot(
      walletRef,
      (snap) => {
        setWallet((snap.data() as Wallet) || null);
      },
      () => setWallet(null)
    );

    const donationsQuery = query(
      collection(db, "donations"),
      where("creatorId", "==", ownerUid),
      where("status", "==", "succeeded"),
      orderBy("paidAt", "desc"),
      limit(20)
    );

    const unsubDonations = onSnapshot(
      donationsQuery,
      (qs: QuerySnapshot<DocumentData>) => {
        const items: Donation[] = qs.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setDonations(items);
      },
      (err) => {
        console.error("Error loading donations", err);
        setDonations([]);
      }
    );

    const timeout = setTimeout(() => setLoadingData(false), 300);

    return () => {
      unsubWallet();
      unsubDonations();
      clearTimeout(timeout);
    };
  }, [ownerUid]);

  const totalReceivedMajor = useMemo(
    () => (wallet?.totalReceived != null ? wallet.totalReceived / 100 : 0),
    [wallet?.totalReceived]
  );

  const pendingBalanceMajor = useMemo(
    () => (wallet?.pendingBalance != null ? wallet.pendingBalance / 100 : 0),
    [wallet?.pendingBalance]
  );

  const currency = wallet?.currency || "KES";

  const handleRequestWithdraw = async () => {
    if (!ownerUid || !wallet?.pendingBalance) return;

    // Extra safety: enforce min threshold in code as well
    if (wallet.pendingBalance < minWithdrawMajor * 100) {
      alert(`Minimum withdrawal is KSh ${minWithdrawMajor}.`);
      return;
    }

    const amount = wallet.pendingBalance; // full balance for now

    try {
      const ref = collection(db, "withdrawalRequests");
      await addDoc(ref, {
        creatorId: ownerUid,
        amount,
        currency,
        status: "pending",
        requestedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      alert("Withdrawal request submitted!");
    } catch (err) {
      console.error("Error creating withdrawal request", err);
      alert("We could not submit your withdrawal request. Please try again.");
    }
  };

  const renderDonation = (item: Donation) => {
    const amountMajor = (item.paidAmount || 0) / 100;
    const cur = item.paidCurrency || currency;

    let dateLabel = "";
    if (item.paidAt?.toDate) {
      const d = item.paidAt.toDate() as Date;
      dateLabel = d.toLocaleString();
    } else if (typeof item.paidAt === "string") {
      dateLabel = item.paidAt;
    }

    return (
      <div
        key={item.id}
        className="mt-3 flex items-center gap-3 rounded-2xl border bg-white px-3 py-3 shadow-sm/10"
        style={{ borderColor: EKARI.hair }}
      >
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: EKARI.ink }}>
            Donation for deed {item.deedId}
          </p>
          <p className="mt-0.5 text-sm" style={{ color: EKARI.dim }}>
            {cur} {amountMajor.toFixed(2)}
          </p>
          {dateLabel && (
            <p className="mt-1 text-xs" style={{ color: EKARI.dim }}>
              {dateLabel}
            </p>
          )}
        </div>
        <div className="text-xl">💸</div>
      </div>
    );
  };

  /* ---------- Gated states ---------- */

  if (!handle) {
    return (
      <AppShell>
        <main
          className="min-h-screen w-full px-4 py-6"
          style={{ backgroundColor: EKARI.bgSoft }}
        >
          <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm" style={{ color: EKARI.dim }}>
              Invalid route.
            </p>
          </div>
        </main>
      </AppShell>
    );
  }

  if (authLoading || checkingOwnership) {
    return (
      <AppShell>
        <main
          className="flex w-full min-h-screen items-center justify-center px-4"
          style={{ backgroundColor: EKARI.bgSoft }}
        >
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-white px-6 py-5 shadow-sm">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-800 border-t-transparent" />
            <p className="text-sm" style={{ color: EKARI.dim }}>
              Checking access to this earnings page…
            </p>
          </div>
        </main>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <main
          className="flex w-full min-h-screen items-center justify-center px-4"
          style={{ backgroundColor: EKARI.bgSoft }}
        >
          <div className="mx-auto max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
            <h1
              className="mb-2 text-lg font-extrabold"
              style={{ color: EKARI.ink }}
            >
              Sign in to view earnings
            </h1>
            <p className="text-sm" style={{ color: EKARI.dim }}>
              You need to be signed in to see your ekarihub wallet and donation
              history.
            </p>
          </div>
        </main>
      </AppShell>
    );
  }

  if (notFound) {
    return (
      <AppShell>
        <main
          className="flex w-full min-h-screen items-center justify-center px-4"
          style={{ backgroundColor: EKARI.bgSoft }}
        >
          <div className="mx-auto max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
            <h1
              className="mb-2 text-lg font-extrabold"
              style={{ color: EKARI.ink }}
            >
              Profile not found
            </h1>
            <p className="text-sm" style={{ color: EKARI.dim }}>
              We couldn’t find a creator with handle{" "}
              {/* handle already includes '@' if you use /@mwangi */}
              <span>{handle}</span>.
            </p>
          </div>
        </main>
      </AppShell>
    );
  }

  if (forbidden || !ownerUid) {
    return (
      <AppShell>
        <main
          className="flex w-full min-h-screen items-center justify-center px-4"
          style={{ backgroundColor: EKARI.bgSoft }}
        >
          <div className="mx-auto max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
            <h1
              className="mb-2 text-lg font-extrabold"
              style={{ color: EKARI.ink }}
            >
              Earnings are private
            </h1>
            <p className="text-sm" style={{ color: EKARI.dim }}>
              You can only view earnings for your own handle. This page is
              restricted to the creator who owns{" "}
              <span className="font-semibold">{handle}</span>.
            </p>
          </div>
        </main>
      </AppShell>
    );
  }

  /* ---------- Main content ---------- */

  return (
    <AppShell>
      <main
        className="min-h-screen w-full px-4 py-6"
        style={{ backgroundColor: EKARI.bgSoft }}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-3xl bg-white/60 p-4 shadow-sm backdrop-blur">
          {/* Header with back-to-profile */}
          <header className="border-b border-slate-200 pb-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <Link href={`/${handle}`} className="inline-flex items-center gap-1.5">
                <span
                  className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:shadow-sm"
                  style={{
                    borderColor: EKARI.hair,
                    color: EKARI.ink,
                    backgroundColor: "#F9FAFB",
                  }}
                >
                  <IoArrowBackCircleOutline className="h-4 w-4" />
                  <span>Back to profile</span>
                </span>
              </Link>
            </div>

            <div className="space-y-1">
              <h1
                className="text-xl font-black md:text-2xl"
                style={{ color: EKARI.ink }}
              >
                My Earnings 💸
              </h1>
              <p className="text-xs md:text-sm" style={{ color: EKARI.dim }}>
                Track tips and donations flowing into your ekarihub wallet.
              </p>
            </div>
          </header>

          {/* Summary cards */}
          <section className="flex flex-col gap-3 md:flex-row">
            <div
              className="flex-1 rounded-2xl border px-4 py-3 shadow-sm"
              style={{
                backgroundColor: "#FDF7EC",
                borderColor: "#FCD9A6",
              }}
            >
              <div className="flex items-center justify-between">
                <p
                  className="text-[11px] font-bold uppercase tracking-[0.06em]"
                  style={{ color: EKARI.dim }}
                >
                  Total received
                </p>
                <span className="text-base">💰</span>
              </div>
              <p
                className="mt-1 text-xl font-black"
                style={{ color: EKARI.ink }}
              >
                {currency} {totalReceivedMajor.toFixed(2)}
              </p>
              <p className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                Across {wallet?.totalDonations || 0} donations
              </p>
            </div>

            <div
              className="flex-1 rounded-2xl border bg-white px-4 py-3 shadow-sm"
              style={{ borderColor: EKARI.hair }}
            >
              <div className="flex items-center justify-between">
                <p
                  className="text-[11px] font-bold uppercase tracking-[0.06em]"
                  style={{ color: EKARI.dim }}
                >
                  Pending balance
                </p>
                <span className="text-base">🕒</span>
              </div>
              <p
                className="mt-1 text-xl font-black"
                style={{ color: EKARI.ink }}
              >
                {currency} {pendingBalanceMajor.toFixed(2)}
              </p>
              <p className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                Will be available once withdrawals are enabled
              </p>
            </div>
          </section>

          {/* Withdraw button / message */}
          {wallet?.pendingBalance && wallet.pendingBalance >= minWithdrawMajor * 100 ? (
            <button
              type="button"
              onClick={handleRequestWithdraw}
              className="mt-2 w-full rounded-full bg-emerald-600 text-white py-2 font-semibold hover:bg-emerald-700"
            >
              Withdraw Funds
            </button>
          ) : (
            <p className="mt-2 text-xs text-red-500 font-medium">
              Minimum withdrawal: KSh {minWithdrawMajor}
            </p>
          )}

          {/* Pills */}
          <section className="flex flex-wrap items-center gap-2">
            <div
              className="flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5"
              style={{ borderColor: EKARI.hair }}
            >
              <span className="text-[10px] text-emerald-600">●</span>
              <span
                className="text-[11px] font-bold"
                style={{ color: EKARI.ink }}
              >
                Currency: {currency}
              </span>
            </div>
            <div
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5"
              style={{ backgroundColor: "#F9FAFB", borderColor: "#E5E7EB" }}
            >
              <span
                className="text-[11px] font-semibold"
                style={{ color: EKARI.dim }}
              >
                Tips &amp; donations only
              </span>
            </div>
          </section>

          {/* Recent donations */}
          <section className="mt-1">
            <h2
              className="mb-1 text-sm font-extrabold"
              style={{ color: EKARI.ink }}
            >
              Recent donations
            </h2>

            {loadingData ? (
              <div className="flex items-center gap-2 py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-800 border-t-transparent" />
                <p className="text-xs" style={{ color: EKARI.dim }}>
                  Loading your earnings…
                </p>
              </div>
            ) : donations.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-5 py-6 text-center">
                <p
                  className="mb-1 text-sm font-extrabold"
                  style={{ color: EKARI.ink }}
                >
                  No donations yet
                </p>
                <p
                  className="text-xs md:text-sm"
                  style={{ color: EKARI.dim }}
                >
                  When viewers support your deeds with tips, they’ll appear here
                  in real-time. Keep creating and sharing value. 🌱
                </p>
              </div>
            ) : (
              <div className="pt-1 pb-4">
                {donations.map((d) => renderDonation(d))}
              </div>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}
