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
  updateDoc,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, app } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import { IoArrowBackCircleOutline } from "react-icons/io5";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";

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
  // 🔹 ALWAYS USD minor units (source of truth)
  totalReceived?: number; // USD minor
  pendingBalance?: number; // USD minor (earnings + topups)
  totalDonations?: number;
};

type Donation = {
  id: string;
  deedId: string;
  paidAmount?: number; // gateway minor units (USD or KES)
  paidCurrency?: string;
  paidAt?: any;

  // from webhook (gateway currency)
  creatorShareNetMinor?: number;
  creatorShareGrossMinor?: number;
  platformShareMinor?: number;
  providerFeeMinorEstimated?: number;
  platformSharePercent?: number;
  processingFeePercent?: number;
  usdToKesRateAtDonation?: number;

  // Canonical USD fields
  grossAmountUsdMinor?: number;
  creatorShareNetUsdMinor?: number;
  creatorShareGrossUsdMinor?: number;
  platformShareUsdMinor?: number;
  providerFeeUsdMinorEstimated?: number;
};

type Topup = {
  id: string;
  userId: string;
  status?: "initiated" | "succeeded" | "failed";
  amountMinor?: number; // original gateway amount
  currency?: string; // original gateway currency ("USD" | "KES")
  source?: "web" | "mobile";
  createdAt?: any;
  completedAt?: any;
  paystackReference?: string;
  gatewayCurrency?: string;
  gatewayAmountMinor?: number;
  creditedUsdMinor?: number; // how much actually credited to wallet in USD minor
};

type FinanceSettings = {
  minWithdrawUSD?: number; // base threshold in USD (major)
  usdToKesRate?: number;
  platformSharePercent?: number;
  processingFeePercent?: number;
};

type PreferredCurrency = "USD" | "KES";

type HistoryTab = "donations" | "topups";

export default function EarningsPage() {
  const params = useParams<{ handle: string }>();
  const handle = "@" + params?.handle;

  const { user, loading: authLoading } = useAuth();

  const [ownerUid, setOwnerUid] = useState<string | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [topups, setTopups] = useState<Topup[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [checkingOwnership, setCheckingOwnership] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // 🔹 Finance + thresholds
  const [minWithdrawUSD, setMinWithdrawUSD] = useState(5); // fallback $5
  const [financeSettings, setFinanceSettings] =
    useState<FinanceSettings | null>(null);

  // 🔹 Display currency (user preference)
  const [preferredCurrency, setPreferredCurrency] =
    useState<PreferredCurrency>("USD");

  // 🔹 History tab
  const [activeTab, setActiveTab] = useState<HistoryTab>("donations");

  // 🔹 Top-up modal state
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState<string>("");
  const [topupLoading, setTopupLoading] = useState(false);

  // Watch adminSettings/finance
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "adminSettings", "finance"), (snap) => {
      const data = (snap.data() as FinanceSettings) || {};
      setFinanceSettings(data || null);

      if (typeof data.minWithdrawUSD === "number") {
        setMinWithdrawUSD(data.minWithdrawUSD);
      }
    });

    return () => unsub();
  }, []);

  // 1) Resolve [handle] -> user uid and check ownership
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

  // 1b) Once we know ownerUid, load their preferredCurrency
  useEffect(() => {
    if (!ownerUid) return;

    const ref = doc(db, "users", ownerUid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const pref = (data.preferredCurrency || "USD").toUpperCase();
        if (pref === "KES") {
          setPreferredCurrency("KES");
        } else {
          setPreferredCurrency("USD");
        }
      },
      (err) => {
        console.error("Error loading preferred currency", err);
      }
    );

    return () => unsub();
  }, [ownerUid]);

  // 2) Listen to wallet + donations + topups (wallet is ALWAYS USD internally)
  useEffect(() => {
    if (!ownerUid) {
      setWallet(null);
      setDonations([]);
      setTopups([]);
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

    const topupsQuery = query(
      collection(db, "walletTopups"),
      where("userId", "==", ownerUid),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsubTopups = onSnapshot(
      topupsQuery,
      (qs: QuerySnapshot<DocumentData>) => {
        const items: Topup[] = qs.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setTopups(items);
      },
      (err) => {
        console.error("Error loading walletTopups", err);
        setTopups([]);
      }
    );

    const timeout = setTimeout(() => setLoadingData(false), 300);

    return () => {
      unsubWallet();
      unsubDonations();
      unsubTopups();
      clearTimeout(timeout);
    };
  }, [ownerUid]);

  // 🔹 Base currency is always USD for the wallet
  const baseCurrency: "USD" = "USD";
  const displayCurrency: PreferredCurrency = preferredCurrency;

  const usdToKesRate = useMemo(() => {
    const v = financeSettings?.usdToKesRate;
    return v && v > 0 ? v : 130; // fallback
  }, [financeSettings?.usdToKesRate]);

  // Base (USD) amounts from wallet
  const totalReceivedUsdMajor = useMemo(
    () => (wallet?.totalReceived != null ? wallet.totalReceived / 100 : 0),
    [wallet?.totalReceived]
  );

  const pendingBalanceUsdMajor = useMemo(
    () => (wallet?.pendingBalance != null ? wallet.pendingBalance / 100 : 0),
    [wallet?.pendingBalance]
  );

  // Convert to display currency for UI
  const totalReceivedDisplayMajor = useMemo(() => {
    if (displayCurrency === "USD") return totalReceivedUsdMajor;
    return totalReceivedUsdMajor * usdToKesRate;
  }, [displayCurrency, totalReceivedUsdMajor, usdToKesRate]);

  const pendingBalanceDisplayMajor = useMemo(() => {
    if (displayCurrency === "USD") return pendingBalanceUsdMajor;
    return pendingBalanceUsdMajor * usdToKesRate;
  }, [displayCurrency, pendingBalanceUsdMajor, usdToKesRate]);

  // Threshold in base (USD)
  const minThresholdUsdMajor = useMemo(
    () => minWithdrawUSD,
    [minWithdrawUSD]
  );

  // Threshold in display currency
  const minThresholdDisplayMajor = useMemo(() => {
    if (displayCurrency === "USD") return minThresholdUsdMajor;
    return minThresholdUsdMajor * usdToKesRate;
  }, [displayCurrency, minThresholdUsdMajor, usdToKesRate]);

  const platformSharePercentEffective = useMemo(() => {
    if (typeof financeSettings?.platformSharePercent === "number") {
      return financeSettings.platformSharePercent;
    }
    const first = donations[0];
    if (typeof first?.platformSharePercent === "number") {
      return first.platformSharePercent;
    }
    return 10;
  }, [financeSettings?.platformSharePercent, donations]);

  const processingFeePercentEffective = useMemo(() => {
    if (typeof financeSettings?.processingFeePercent === "number") {
      return financeSettings.processingFeePercent;
    }
    const first = donations[0];
    if (typeof first?.processingFeePercent === "number") {
      return first.processingFeePercent;
    }
    return 2.9;
  }, [financeSettings?.processingFeePercent, donations]);

  const creatorSharePercentEffective = 100 - platformSharePercentEffective;

  const handleRequestWithdraw = async () => {
    if (!ownerUid || !wallet?.pendingBalance) return;

    // 🔹 wallet.pendingBalance is in USD minor units now
    if (wallet.pendingBalance < minThresholdUsdMajor * 100) {
      if (displayCurrency === "USD") {
        alert(
          `Minimum withdrawal is about USD ${minThresholdUsdMajor.toFixed(2)}.`
        );
      } else {
        alert(
          `Minimum withdrawal is about KSh ${minThresholdDisplayMajor.toFixed(
            0
          )} (≈ USD ${minThresholdUsdMajor.toFixed(2)}).`
        );
      }
      return;
    }

    const amount = wallet.pendingBalance; // full balance in USD minor

    try {
      const ref = collection(db, "withdrawalRequests");
      await addDoc(ref, {
        creatorId: ownerUid,
        amount, // USD minor
        currency: baseCurrency, // "USD"
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

  // 🔹 Toggle display currency + persist preferredCurrency to user doc
  const handleToggleCurrency = async (next: PreferredCurrency) => {
    if (!ownerUid) return;
    if (next === preferredCurrency) return;

    setPreferredCurrency(next);

    try {
      const userRef = doc(db, "users", ownerUid);
      await updateDoc(userRef, {
        preferredCurrency: next,
      });
    } catch (err) {
      console.error("Error updating preferredCurrency", err);
    }
  };

  // 🔹 Open modal
  const openTopupModal = () => {
    if (!ownerUid) {
      alert("Please sign in to top up your wallet.");
      return;
    }
    setTopupAmount("");
    setTopupOpen(true);
  };

  // 🔹 Confirm topup -> Cloud Function
  const handleConfirmTopup = async () => {
    if (!ownerUid) {
      alert("Please sign in to top up your wallet.");
      return;
    }
    const raw = topupAmount.trim();
    if (!raw) {
      alert("Please enter an amount.");
      return;
    }
    const amountMajor = Number(raw);
    if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    try {
      setTopupLoading(true);
      const functions = getFunctions(app, "us-central1");
      const createWalletTopupCheckout = httpsCallable<
        {
          amount: number; // minor units
          currency: "USD" | "KES";
          source?: "web" | "mobile";
        },
        { checkoutUrl: string }
      >(functions, "createWalletTopupCheckout");

      const amountMinor = Math.round(amountMajor * 100);

      const res = await createWalletTopupCheckout({
        amount: amountMinor,
        currency: displayCurrency,
        source: "web",
      });

      const url = res.data.checkoutUrl;
      if (!url) {
        alert("Unable to start top-up. Please try again.");
        setTopupLoading(false);
        return;
      }

      // Close modal and redirect to Paystack
      setTopupOpen(false);
      setTopupLoading(false);
      window.location.href = url;
    } catch (err) {
      console.error("Top-up error", err);
      setTopupLoading(false);
      alert("Unable to start top-up. Please try again.");
    }
  };

  const renderDonation = (item: Donation) => {
    // Show gross in gateway currency (what donor saw)
    const grossMinor = item.paidAmount || 0;
    const amountMajor = grossMinor / 100;
    const cur = (item.paidCurrency || baseCurrency).toUpperCase();

    let dateLabel = "";
    if (item.paidAt?.toDate) {
      const d = item.paidAt.toDate() as Date;
      dateLabel = d.toLocaleString();
    } else if (typeof item.paidAt === "string") {
      dateLabel = item.paidAt;
    }

    const netMinor = item.creatorShareNetMinor;
    const platformMinor = item.platformShareMinor;
    const providerMinor = item.providerFeeMinorEstimated;

    let breakdown: React.ReactNode | null = null;
    if (netMinor != null && platformMinor != null) {
      const netMajor = netMinor / 100;
      const platMajor = platformMinor / 100;
      const providerMajor = providerMinor != null ? providerMinor / 100 : null;

      breakdown = (
        <p className="mt-0.5 text-[11px]" style={{ color: EKARI.dim }}>
          You (after fees): {cur} {netMajor.toFixed(2)} · ekariHub: {cur}{" "}
          {platMajor.toFixed(2)}
          {providerMajor != null && (
            <>
              {" "}
              · provider fees (est.): {cur} {providerMajor.toFixed(2)}
            </>
          )}
        </p>
      );
    }

    return (
      <div
        key={item.id}
        className="mt-3 flex items-center gap-3 rounded-2xl border bg-white px-3 py-3 shadow-sm/10"
        style={{ borderColor: EKARI.hair }}
      >
        <div className="flex-1">
          {/* 👇 Deed link */}
          <p className="text-sm font-semibold" style={{ color: EKARI.forest }}>
            <Link
              href={`/${handle}/deed/${item.deedId}`}
              className="hover:text-emerald-800 cursor-pointer"
            >
              Donation for deed{" "}
              <span className="font-mono text-xs break-all">
                {item.deedId}
              </span>
            </Link>
          </p>

          <p className="mt-0.5 text-sm" style={{ color: EKARI.dim }}>
            Gross: {cur} {amountMajor.toFixed(2)}
          </p>
          {breakdown}
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

  const renderTopup = (item: Topup) => {
    const amountMinor = item.gatewayAmountMinor ?? item.amountMinor ?? 0;
    const creditedUsdMinor = item.creditedUsdMinor ?? 0;
    const cur = (item.gatewayCurrency || item.currency || "USD").toUpperCase();

    const amountMajor = amountMinor / 100;
    const creditedUsdMajor = creditedUsdMinor / 100;

    let dateLabel = "";
    if (item.completedAt?.toDate) {
      const d = item.completedAt.toDate() as Date;
      dateLabel = d.toLocaleString();
    } else if (item.createdAt?.toDate) {
      const d = item.createdAt.toDate() as Date;
      dateLabel = d.toLocaleString();
    }

    return (
      <div
        key={item.id}
        className="mt-3 flex items-center gap-3 rounded-2xl border bg-white px-3 py-3 shadow-sm/10"
        style={{ borderColor: EKARI.hair }}
      >
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: EKARI.forest }}>
            Wallet top-up
          </p>
          <p className="mt-0.5 text-sm" style={{ color: EKARI.dim }}>
            Paid: {cur} {amountMajor.toFixed(2)}
          </p>
          {creditedUsdMinor > 0 && (
            <p className="mt-0.5 text-[11px]" style={{ color: EKARI.dim }}>
              Credited to wallet: USD {creditedUsdMajor.toFixed(2)}
            </p>
          )}
          {item.status && (
            <p className="mt-0.5 text-[11px]" style={{ color: EKARI.dim }}>
              Status:{" "}
              <span className="font-semibold capitalize">{item.status}</span>
            </p>
          )}
          {dateLabel && (
            <p className="mt-1 text-xs" style={{ color: EKARI.dim }}>
              {dateLabel}
            </p>
          )}
        </div>
        <div className="text-xl">👛</div>
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

            <BouncingBallLoader />
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
              We couldn’t find a creator with handle <span>{handle}</span>.
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
        style={{ backgroundColor: EKARI.sand }}
      >
        <div className="flex w-full flex-col gap-4 rounded-3xl bg-white p-4 shadow-sm backdrop-blur">
          {/* Header */}
          <header className="border-b border-slate-200 pb-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <Link
                href={`/${handle}`}
                className="inline-flex items-center gap-1.5"
              >
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
                Track tips, topups, and donations flowing into your ekarihub
                wallet.
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
                {displayCurrency}{" "}
                {totalReceivedDisplayMajor.toFixed(
                  displayCurrency === "KES" ? 0 : 2
                )}
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
                  Wallet / pending balance
                </p>
                <span className="text-base">🕒</span>
              </div>
              <p
                className="mt-1 text-xl font-black"
                style={{ color: EKARI.ink }}
              >
                {displayCurrency}{" "}
                {pendingBalanceDisplayMajor.toFixed(
                  displayCurrency === "KES" ? 0 : 2
                )}
              </p>
              <div className="mt-1 flex items-start justify-between gap-2">
                <p className="text-xs" style={{ color: EKARI.dim }}>
                  This is your current ekariHub wallet balance. You can
                  withdraw once you reach the minimum threshold, or use it to
                  donate to other deeds.
                </p>
                <button
                  type="button"
                  onClick={openTopupModal}
                  className="shrink-0 rounded-full bg-emerald-900 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-800"
                >
                  Top up wallet
                </button>
              </div>
            </div>
          </section>

          {/* Withdraw button / message */}
          {wallet?.pendingBalance &&
            wallet.pendingBalance >= minThresholdUsdMajor * 100 ? (
            <button
              type="button"
              onClick={handleRequestWithdraw}
              className="mt-2 w-full rounded-full bg-emerald-900 text-white py-2 font-semibold hover:bg-emerald-800"
            >
              Withdraw Funds
            </button>
          ) : (
            <p className="mt-2 text-xs text-red-500 font-medium">
              Minimum withdrawal: {displayCurrency}{" "}
              {minThresholdDisplayMajor.toFixed(
                displayCurrency === "KES" ? 0 : 2
              )}
              {displayCurrency === "KES" && (
                <> (≈ USD {minThresholdUsdMajor.toFixed(2)})</>
              )}
            </p>
          )}

          {/* Pills */}
          <section className="flex flex-wrap items-center gap-2">
            {/* Display currency pill + toggle */}
            <div
              className="flex items-center gap-2 rounded-full border bg-white px-3 py-1.5"
              style={{ borderColor: EKARI.hair }}
            >
              <span
                className="text-[11px] font-bold"
                style={{ color: EKARI.ink }}
              >
                Display:
              </span>
              <div className="flex rounded-full bg-slate-100 p-0.5">
                <button
                  type="button"
                  onClick={() => handleToggleCurrency("USD")}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-full transition ${displayCurrency === "USD"
                    ? "bg-emerald-900 text-white shadow-sm"
                    : "text-slate-600"
                    }`}

                >
                  USD
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleCurrency("KES")}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-full transition ${displayCurrency === "KES"
                    ? "bg-emerald-900 text-white shadow-sm"
                    : "text-slate-600"
                    }`}
                >
                  KSh
                </button>
              </div>
            </div>

            <div
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5"
              style={{ backgroundColor: "#F9FAFB", borderColor: "#E5E7EB" }}
            >
              <span
                className="text-[11px] font-semibold"
                style={{ color: EKARI.dim }}
              >
                Split: ~{creatorSharePercentEffective}% you ·{" "}
                {platformSharePercentEffective}% ekariHub
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
                Provider fees (est.) ~{processingFeePercentEffective}% from your
                share
              </span>
            </div>
          </section>

          {/* History with tabs */}
          <section className="mt-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2
                className="text-sm font-extrabold"
                style={{ color: EKARI.ink }}
              >
                History
              </h2>
              <div className="inline-flex rounded-full bg-slate-100 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveTab("donations")}
                  className={`px-3 py-1 rounded-full font-semibold transition ${activeTab === "donations"
                    ? "bg-white shadow-sm text-emerald-900"
                    : "text-slate-600"
                    }`}
                >
                  Donations
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("topups")}
                  className={`px-3 py-1 rounded-full font-semibold transition ${activeTab === "topups"
                    ? "bg-white shadow-sm text-emerald-900"
                    : "text-slate-600"
                    }`}
                >
                  Wallet topups
                </button>
              </div>
            </div>

            {loadingData ? (
              <div className="flex items-center gap-2 py-6">
                <BouncingBallLoader />
                <p className="text-xs" style={{ color: EKARI.dim }}>
                  Loading your history…
                </p>
              </div>
            ) : activeTab === "donations" ? (
              donations.length === 0 ? (
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
                    When viewers support your deeds with tips, they’ll appear
                    here in real-time. Keep creating and sharing value. 🌱
                  </p>
                </div>
              ) : (
                <div className="pt-1 pb-4">
                  {donations.map((d) => renderDonation(d))}
                </div>
              )
            ) : // activeTab === "topups"
              topups.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-5 py-6 text-center">
                  <p
                    className="mb-1 text-sm font-extrabold"
                    style={{ color: EKARI.ink }}
                  >
                    No wallet topups yet
                  </p>
                  <p
                    className="text-xs md:text-sm"
                    style={{ color: EKARI.dim }}
                  >
                    Top up your wallet to see your funding history here.
                  </p>
                </div>
              ) : (
                <div className="pt-1 pb-4">
                  {topups.map((t) => renderTopup(t))}
                </div>
              )}
          </section>
        </div>

        {/* 🔹 Top-up modal */}
        {topupOpen && (
          <div className="fixed inset-0 z-[70]">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => !topupLoading && setTopupOpen(false)}
            />
            <div className="absolute inset-0 flex items-center justify-center px-4">
              <div className="w-full max-w-md rounded-3xl bg-white px-5 pb-5 pt-4 shadow-xl">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:#233F39]">
                      Top up your wallet
                    </p>
                    <h2 className="text-[16px] font-extrabold text-gray-900">
                      Add funds to your ekariHub wallet
                    </h2>
                    <p className="mt-1 text-xs text-gray-500">
                      Enter the amount you want to load in{" "}
                      {displayCurrency === "USD" ? "USD" : "Kenyan Shillings"}.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={topupLoading}
                    onClick={() => setTopupOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>

                <div className="mb-4">
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    Amount ({displayCurrency === "USD" ? "USD" : "KSh"})
                  </label>
                  <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2">
                    <span className="text-xs font-semibold text-gray-500">
                      {displayCurrency === "USD" ? "USD" : "KSh"}
                    </span>
                    <input
                      type="number"
                      min={displayCurrency === "USD" ? 1 : 100}
                      step={displayCurrency === "USD" ? 1 : 50}
                      value={topupAmount}
                      onChange={(e) => setTopupAmount(e.target.value)}
                      className="flex-1 border-none bg-transparent text-sm outline-none placeholder:text-gray-300"
                      placeholder={
                        displayCurrency === "USD" ? "e.g. 10" : "e.g. 1000"
                      }
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">
                    You’ll be redirected to a secure Paystack page to complete
                    the top-up.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmTopup}
                  disabled={topupLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[color:#233F39] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1b312d] disabled:opacity-60"
                >
                  {topupLoading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Starting top-up…</span>
                    </>
                  ) : (
                    <>
                      <span role="img" aria-label="wallet">
                        👛
                      </span>
                      <span>Continue</span>
                    </>
                  )}
                </button>

                <p className="mt-2 text-center text-[10px] text-gray-500">
                  Your wallet balance will update automatically once the payment
                  succeeds.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
