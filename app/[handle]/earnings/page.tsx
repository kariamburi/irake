// app/[handle]/earnings/page.tsx
"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
  Timestamp,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, app } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import { IoArrowBackCircleOutline, IoArrowBack } from "react-icons/io5";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import { ConfirmModal } from "@/app/components/ConfirmModal";
import { createPortal } from "react-dom";

const EKARI = {
  forest: "#233F39",
  forest2: "#1B312C",
  gold: "#C79257",
  sand: "#FFFFFF",
  ink: "#111827",
  dim: "#6B7280",
  hair: "#E5E7EB",
  bgSoft: "#F6F7FB",
  card: "#FFFFFF",
};

type Wallet = {
  totalReceived?: number; // USD minor
  pendingBalance?: number; // USD minor
  totalDonations?: number;
};

type Donation = {
  id: string;
  deedId: string;
  paidAmount?: number;
  paidCurrency?: string;
  paidAt?: any;

  creatorShareNetMinor?: number;
  creatorShareGrossMinor?: number;
  platformShareMinor?: number;
  providerFeeMinorEstimated?: number;
  platformSharePercent?: number;
  processingFeePercent?: number;
  usdToKesRateAtDonation?: number;

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
  amountMinor?: number;
  currency?: string;
  source?: "web" | "mobile";
  createdAt?: any;
  completedAt?: any;
  paystackReference?: string;
  gatewayCurrency?: string;
  gatewayAmountMinor?: number;
  creditedUsdMinor?: number;
};

type FinanceSettings = {
  minWithdrawUSD?: number; // major
  usdToKesRate?: number;
  platformSharePercent?: number;
  processingFeePercent?: number;
};

type PreferredCurrency = "USD" | "KES";
type HistoryTab = "donations" | "topups";

/** ✅ Settlement details */
type SettlementMethod = "mpesa" | "bank";
type SettlementDetails = {
  enabled: boolean;
  method: SettlementMethod;
  mpesa: { phone: string; accountName?: string };
  bank: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    branchName?: string;
  };
};

type FeedbackModalState =
  | {
    title: string;
    message: string;
  }
  | null;

/* ---------------- Responsive helpers ---------------- */
function useMediaQuery(queryStr: string) {
  const [matches, setMatches] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia(queryStr);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [queryStr]);
  return matches;
}
function useIsMobile() {
  return useMediaQuery("(max-width: 1023px)");
}

/* ---------------- Small helpers ---------------- */
function normalizePhone(raw: string) {
  const x = String(raw || "").trim().replace(/\s+/g, "");
  if (!x) return "";
  if (x.startsWith("+")) return x;
  return x;
}

function isValidMpesaPhone(raw: string) {
  const x = String(raw || "").trim().replace(/\s+/g, "");
  if (!x) return false;
  const y = x.startsWith("+") ? x.slice(1) : x;
  return /^0[71]\d{8}$/.test(y) || /^254[71]\d{8}$/.test(y);
}

function cleanStr(v: any) {
  return String(v ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
  if (typeof v === "number") return new Date(v);
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function fmtDate(ts: any) {
  if (!ts) return "";
  if (ts.toDate) return (ts.toDate() as Date).toLocaleString();
  const d = toDate(ts);
  return d ? d.toLocaleString() : String(ts);
}

/** Convert user input (display currency, major) → wallet base (USD minor) */
function toUsdMinorFromInput(opts: {
  inputMajor: number;
  displayCurrency: "USD" | "KES";
  usdToKesRate: number;
}) {
  const { inputMajor, displayCurrency, usdToKesRate } = opts;
  if (!Number.isFinite(inputMajor) || inputMajor <= 0) return null;

  const rate = usdToKesRate > 0 ? usdToKesRate : 130;
  const usdMajor =
    displayCurrency === "USD" ? inputMajor : inputMajor / rate;

  const usdMinor = Math.round(usdMajor * 100);
  return usdMinor > 0 ? usdMinor : null;
}

/** Pretty money string */
function fmtMoneyMajor(amountMajor: number, cur: "USD" | "KES") {
  if (!Number.isFinite(amountMajor)) return `${cur} 0`;
  const isKes = cur === "KES";
  return `${cur} ${amountMajor.toLocaleString("en-KE", {
    minimumFractionDigits: isKes ? 0 : 2,
    maximumFractionDigits: isKes ? 0 : 2,
  })}`;
}

/* ---------------- Premium small UI components ---------------- */
function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "emerald" | "amber" | "red" | "blue";
}) {
  const map: Record<string, { bg: string; bd: string; fg: string }> = {
    neutral: { bg: "#F8FAFC", bd: "#E5E7EB", fg: "#334155" },
    emerald: { bg: "rgba(16,185,129,.10)", bd: "rgba(16,185,129,.25)", fg: "#065F46" },
    amber: { bg: "rgba(245,158,11,.12)", bd: "rgba(245,158,11,.25)", fg: "#92400e" },
    red: { bg: "rgba(239,68,68,.12)", bd: "rgba(239,68,68,.25)", fg: "#991B1B" },
    blue: { bg: "rgba(59,130,246,.12)", bd: "rgba(59,130,246,.25)", fg: "#1D4ED8" },
  };
  const t = map[tone] || map.neutral;
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold"
      style={{ background: t.bg, borderColor: t.bd, color: t.fg }}
    >
      {children}
    </span>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border bg-white shadow-[0_12px_30px_rgba(15,23,42,.06)] ${className}`}
      style={{ borderColor: EKARI.hair }}
    >
      {children}
    </div>
  );
}

export default function EarningsPage() {
  const params = useParams<{ handle: string }>();
  const router = useRouter();
  const isMobile = useIsMobile();

  // IMPORTANT: db stores handle WITH @, route param is without @
  const rawHandle = params?.handle?.replace("%40", "@");
  const handle =
    rawHandle && !rawHandle.startsWith("@") ? `@${rawHandle}` : rawHandle;

  const { user, loading: authLoading } = useAuth();

  const [ownerUid, setOwnerUid] = useState<string | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [topups, setTopups] = useState<Topup[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [checkingOwnership, setCheckingOwnership] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Finance + thresholds
  const [minWithdrawUSD, setMinWithdrawUSD] = useState(5);
  const [financeSettings, setFinanceSettings] =
    useState<FinanceSettings | null>(null);

  // Display currency (user preference)
  const [preferredCurrency, setPreferredCurrency] =
    useState<PreferredCurrency>("USD");

  // Settlement details state
  const [settlement, setSettlement] = useState<SettlementDetails>({
    enabled: false,
    method: "mpesa",
    mpesa: { phone: "", accountName: "" },
    bank: { bankName: "", accountName: "", accountNumber: "", branchName: "" },
  });
  const [savingSettlement, setSavingSettlement] = useState(false);
  const [settlementSavedToast, setSettlementSavedToast] = useState<string | null>(
    null
  );

  // History tab
  const [activeTab, setActiveTab] = useState<HistoryTab>("donations");

  // Top-up modal
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState<string>("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupError, setTopupError] = useState<string | null>(null);
  const [topupAnimated, setTopupAnimated] = useState(false);

  // ✅ Withdraw modal (partial withdraw)
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>(""); // major in display currency
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawAnimated, setWithdrawAnimated] = useState(false);

  // Feedback modal
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>(null);

  const goBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(`/${params?.handle || ""}`);
  }, [router, params?.handle]);

  useEffect(() => {
    if (topupOpen) {
      const id = requestAnimationFrame(() => setTopupAnimated(true));
      return () => cancelAnimationFrame(id);
    } else {
      setTopupAnimated(false);
    }
  }, [topupOpen]);

  useEffect(() => {
    if (withdrawOpen) {
      const id = requestAnimationFrame(() => setWithdrawAnimated(true));
      return () => cancelAnimationFrame(id);
    } else {
      setWithdrawAnimated(false);
    }
  }, [withdrawOpen]);

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

  // Resolve [handle] -> uid and check ownership
  useEffect(() => {
    if (!handle || handle === "@") return;
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
        if (!cancelled) setCheckingOwnership(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [handle, user, authLoading]);

  // Once we know ownerUid, load preferences (currency + settlement)
  useEffect(() => {
    if (!ownerUid) return;

    const ref = doc(db, "users", ownerUid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as any;

        const prefCur = String(data.preferredCurrency || "USD").toUpperCase();
        setPreferredCurrency(prefCur === "KES" ? "KES" : "USD");

        const s = data.settlement || {};
        const method =
          String(s.method || "mpesa").toLowerCase() === "bank" ? "bank" : "mpesa";

        setSettlement({
          enabled: !!s.enabled,
          method,
          mpesa: {
            phone: String(s.mpesa?.phone || ""),
            accountName: s.mpesa?.accountName ? String(s.mpesa.accountName) : "",
          },
          bank: {
            bankName: s.bank?.bankName ? String(s.bank.bankName) : "",
            accountName: s.bank?.accountName ? String(s.bank.accountName) : "",
            accountNumber: s.bank?.accountNumber ? String(s.bank.accountNumber) : "",
            branchName: s.bank?.branchName ? String(s.bank.branchName) : "",
          },
        });
      },
      (err) => {
        console.error("Error loading user prefs", err);
      }
    );

    return () => unsub();
  }, [ownerUid]);

  // Listen to wallet + donations + topups
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
      (snap) => setWallet((snap.data() as Wallet) || null),

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
        console.error("Error loading uplifts", err);
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

    const timeout = setTimeout(() => setLoadingData(false), 250);

    return () => {
      unsubWallet();
      unsubDonations();
      unsubTopups();
      clearTimeout(timeout);
    };
  }, [ownerUid]);

  // Base currency
  const baseCurrency: "USD" = "USD";
  const displayCurrency: PreferredCurrency = preferredCurrency;

  const usdToKesRate = useMemo(() => {
    const v = financeSettings?.usdToKesRate;
    return v && v > 0 ? v : 130;
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
  const minThresholdUsdMajor = useMemo(() => minWithdrawUSD, [minWithdrawUSD]);

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

  const handleToggleCurrency = async (next: PreferredCurrency) => {
    if (!ownerUid) return;
    if (next === preferredCurrency) return;

    setPreferredCurrency(next);

    try {
      const userRef = doc(db, "users", ownerUid);
      await updateDoc(userRef, { preferredCurrency: next });
    } catch (err) {
      console.error("Error updating preferredCurrency", err);
    }
  };

  /** Save settlement details (bank is manual deposit; no destinationId) */
  const handleSaveSettlementDetails = async () => {
    if (!ownerUid) return;

    if (settlement.enabled) {
      if (settlement.method === "mpesa") {
        if (!isValidMpesaPhone(settlement.mpesa.phone)) {
          setFeedbackModal({
            title: "Invalid M-Pesa phone",
            message:
              "Enter a valid phone number (07.. / 01.. / 254.. / +254..).",
          });
          return;
        }
      }

      if (settlement.method === "bank") {
        const bankName = cleanStr(settlement.bank.bankName);
        const accNo = cleanStr(settlement.bank.accountNumber);
        const accName = cleanStr(settlement.bank.accountName);

        if (!bankName || !accNo || !accName) {
          setFeedbackModal({
            title: "Bank details required",
            message:
              "For Bank (manual deposit), please fill Bank name, Account number, and Account name.",
          });
          return;
        }
      }
    }

    try {
      setSavingSettlement(true);
      const userRef = doc(db, "users", ownerUid);

      await updateDoc(userRef, {
        settlement: {
          enabled: settlement.enabled,
          method: settlement.method,

          mpesa: {
            phone: normalizePhone(settlement.mpesa.phone),
            accountName: cleanStr(settlement.mpesa.accountName) || null,
          },

          bank: {
            bankName: cleanStr(settlement.bank.bankName) || null,
            accountName: cleanStr(settlement.bank.accountName) || null,
            accountNumber: cleanStr(settlement.bank.accountNumber) || null,
            branchName: cleanStr(settlement.bank.branchName) || null,
            payoutMode: "manual",
          },

          updatedAt: serverTimestamp(),
        },
      });

      setSettlementSavedToast("Saved ✅");
      setTimeout(() => setSettlementSavedToast(null), 1600);
    } catch (err) {
      console.error("Error saving settlement details", err);
      setFeedbackModal({
        title: "Unable to save",
        message: "We couldn’t save your settlement details. Please try again.",
      });
    } finally {
      setSavingSettlement(false);
    }
  };

  /* ---------------- Topup flow ---------------- */
  const openTopupModal = () => {
    if (!ownerUid) {
      setFeedbackModal({
        title: "Sign in required",
        message: "Please sign in to top up your ekarihub wallet.",
      });
      return;
    }
    setTopupAmount("");
    setTopupError(null);
    setTopupOpen(true);
  };

  const handleConfirmTopup = async () => {
    if (!ownerUid) {
      setTopupError("You need to be signed in to top up your wallet.");
      return;
    }
    const raw = topupAmount.trim();
    if (!raw) {
      setTopupError("Please enter an amount to top up.");
      return;
    }
    const amountMajor = Number(raw);
    if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
      setTopupError("Please enter a valid amount.");
      return;
    }

    try {
      setTopupLoading(true);
      setTopupError(null);

      const functions = getFunctions(app, "us-central1");
      const createWalletTopupCheckout = httpsCallable<
        { amount: number; currency: "USD" | "KES"; source?: "web" | "mobile" },
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
        setTopupError("We were unable to start the top-up. Please try again.");
        setTopupLoading(false);
        return;
      }

      setTopupOpen(false);
      setTopupLoading(false);
      window.location.href = url;
    } catch (err) {
      console.error("Top-up error", err);
      setTopupLoading(false);
      setTopupError(
        "We were unable to start the top-up. Please check your connection and try again."
      );
    }
  };

  /* ---------------- Withdraw flow (partial) ---------------- */
  const openWithdrawModal = () => {
    if (!wallet?.pendingBalance || wallet.pendingBalance <= 0) return;

    // Default to full balance (display currency), user can edit
    const fullDisplayMajor =
      displayCurrency === "USD"
        ? pendingBalanceUsdMajor
        : pendingBalanceDisplayMajor;

    setWithdrawAmount(
      fullDisplayMajor.toFixed(displayCurrency === "KES" ? 0 : 2)
    );
    setWithdrawError(null);
    setWithdrawOpen(true);
  };

  const handleRequestWithdraw = async () => {
    if (!ownerUid || !wallet?.pendingBalance) return;

    const raw = withdrawAmount.trim();
    const inputMajor = Number(raw);

    if (!raw) {
      setWithdrawError("Enter an amount to withdraw.");
      return;
    }
    if (!Number.isFinite(inputMajor) || inputMajor <= 0) {
      setWithdrawError("Enter a valid amount.");
      return;
    }

    const requestedUsdMinor = toUsdMinorFromInput({
      inputMajor,
      displayCurrency,
      usdToKesRate,
    });

    if (!requestedUsdMinor) {
      setWithdrawError("Enter a valid amount.");
      return;
    }

    const minUsdMinor = Math.round(minThresholdUsdMajor * 100);
    const availableUsdMinor = wallet.pendingBalance;

    if (requestedUsdMinor < minUsdMinor) {
      setWithdrawError(
        displayCurrency === "USD"
          ? `Minimum withdrawal is USD ${minThresholdUsdMajor.toFixed(2)}.`
          : `Minimum withdrawal is KSh ${minThresholdDisplayMajor.toFixed(
            0
          )} (≈ USD ${minThresholdUsdMajor.toFixed(2)}).`
      );
      return;
    }

    if (requestedUsdMinor > availableUsdMinor) {
      setWithdrawError("Amount exceeds your available wallet balance.");
      return;
    }

    // Require settlement details
    if (settlement.enabled) {
      if (settlement.method === "mpesa") {
        if (!isValidMpesaPhone(settlement.mpesa.phone)) {
          setFeedbackModal({
            title: "Add your M-Pesa details",
            message:
              "Please enter a valid M-Pesa phone number in Settlement details, then Save.",
          });
          return;
        }
      } else {
        const bankName = cleanStr(settlement.bank.bankName);
        const accNo = cleanStr(settlement.bank.accountNumber);
        const accName = cleanStr(settlement.bank.accountName);

        if (!bankName || !accNo || !accName) {
          setFeedbackModal({
            title: "Add your bank details",
            message:
              "For Bank (manual deposit), please fill Bank name, Account number, and Account name in Settlement details, then Save.",
          });
          return;
        }
      }
    } else {
      setFeedbackModal({
        title: "Enable settlement details",
        message:
          "Please enable Settlement details and save your M-Pesa or Bank details before requesting withdrawal.",
      });
      return;
    }

    try {
      setWithdrawSubmitting(true);
      setWithdrawError(null);

      const ref = collection(db, "withdrawalRequests");
      await addDoc(ref, {
        creatorId: ownerUid,

        // ✅ partial allowed
        amount: requestedUsdMinor, // USD minor
        currency: baseCurrency, // "USD"

        status: "pending",
        requestedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),

        // helpful for admin UI
        requestedDisplay: {
          currency: displayCurrency,
          amountMajor: inputMajor,
          usdToKesRateUsed: usdToKesRate,
          availableAtRequestUsdMinor: availableUsdMinor,
        },

        // snapshot at request time
        creatorSettlementSnapshot: {
          enabled: settlement.enabled,
          method: settlement.method,
          mpesa:
            settlement.method === "mpesa"
              ? {
                phone: normalizePhone(settlement.mpesa.phone) || null,
                accountName: cleanStr(settlement.mpesa.accountName) || null,
              }
              : null,
          bank:
            settlement.method === "bank"
              ? {
                bankName: cleanStr(settlement.bank.bankName) || null,
                accountName: cleanStr(settlement.bank.accountName) || null,
                accountNumber: cleanStr(settlement.bank.accountNumber) || null,
                branchName: cleanStr(settlement.bank.branchName) || null,
                payoutMode: "manual",
              }
              : null,
        },
      });

      setWithdrawOpen(false);
      setWithdrawAmount("");

      setFeedbackModal({
        title: "Withdrawal request submitted",
        message:
          "Your withdrawal request has been sent. We’ll review it and notify you once it has been processed.",
      });
    } catch (err) {
      console.error("Error creating withdrawal request", err);
      setWithdrawError(
        "We couldn’t submit your withdrawal request. Please try again."
      );
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  /* ---------------- Render items ---------------- */
  const renderDonation = (item: Donation) => {
    const grossMinor = item.paidAmount || 0;
    const amountMajor = grossMinor / 100;
    const cur = (item.paidCurrency || baseCurrency).toUpperCase() as "USD" | "KES";

    const dateLabel = fmtDate(item.paidAt);

    const netMinor = item.creatorShareNetMinor;
    const platformMinor = item.platformShareMinor;
    const providerMinor = item.providerFeeMinorEstimated;

    let breakdown: React.ReactNode | null = null;
    if (netMinor != null && platformMinor != null) {
      const netMajor = netMinor / 100;
      const platMajor = platformMinor / 100;
      const providerMajor = providerMinor != null ? providerMinor / 100 : null;

      breakdown = (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Pill tone="emerald">You: {fmtMoneyMajor(netMajor, cur)}</Pill>
          <Pill tone="neutral">ekarihub: {fmtMoneyMajor(platMajor, cur)}</Pill>
          {providerMajor != null && (
            <Pill tone="amber">fees(est): {fmtMoneyMajor(providerMajor, cur)}</Pill>
          )}
        </div>
      );
    }

    return (
      <div
        key={item.id}
        className="mt-3 rounded-2xl border bg-white px-3 py-3 hover:bg-slate-50 transition"
        style={{ borderColor: EKARI.hair }}
      >
        <div className="flex items-start gap-3">
          <div
            className="h-10 w-10 rounded-2xl grid place-items-center text-white text-lg shadow-sm"
            style={{
              background:
                "linear-gradient(135deg, rgba(35,63,57,.95), rgba(199,146,87,.95))",
            }}
          >
            💸
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold" style={{ color: EKARI.forest }}>
              <Link
                href={`/${params?.handle}/deed/${item.deedId}`}
                className="hover:underline"
              >
                Uplift for deed{" "}
                <span className="font-mono text-xs break-all">{item.deedId}</span>
              </Link>
            </p>

            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <Pill tone="blue">
                Gross: {fmtMoneyMajor(amountMajor, cur)}
              </Pill>
              {item.grossAmountUsdMinor != null && item.grossAmountUsdMinor > 0 && (
                <Pill tone="neutral">
                  USD canon: {(item.grossAmountUsdMinor / 100).toFixed(2)}
                </Pill>
              )}
            </div>

            {breakdown}

            {dateLabel && (
              <p className="mt-1 text-[11px]" style={{ color: EKARI.dim }}>
                {dateLabel}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTopup = (item: Topup) => {
    const amountMinor = item.gatewayAmountMinor ?? item.amountMinor ?? 0;
    const creditedUsdMinor = item.creditedUsdMinor ?? 0;
    const cur = (item.gatewayCurrency || item.currency || "USD").toUpperCase() as
      | "USD"
      | "KES";

    const amountMajor = amountMinor / 100;
    const creditedUsdMajor = creditedUsdMinor / 100;

    const dateLabel = fmtDate(item.completedAt || item.createdAt);

    const statusTone =
      item.status === "succeeded"
        ? "emerald"
        : item.status === "failed"
          ? "red"
          : "amber";

    return (
      <div
        key={item.id}
        className="mt-3 rounded-2xl border bg-white px-3 py-3 hover:bg-slate-50 transition"
        style={{ borderColor: EKARI.hair }}
      >
        <div className="flex items-start gap-3">
          <div
            className="h-10 w-10 rounded-2xl grid place-items-center text-white text-lg shadow-sm"
            style={{
              background:
                "linear-gradient(135deg, rgba(35,63,57,.95), rgba(59,130,246,.75))",
            }}
          >
            👛
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-extrabold" style={{ color: EKARI.forest }}>
                Wallet top-up
              </p>
              {item.status ? <Pill tone={statusTone as any}>{item.status}</Pill> : null}
            </div>

            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <Pill tone="blue">Paid: {fmtMoneyMajor(amountMajor, cur)}</Pill>
              {creditedUsdMinor > 0 && (
                <Pill tone="emerald">
                  Credited: {fmtMoneyMajor(creditedUsdMajor, "USD")}
                </Pill>
              )}
            </div>

            {item.paystackReference ? (
              <p className="mt-1 text-[11px] font-mono text-slate-400 truncate">
                ref: {item.paystackReference}
              </p>
            ) : null}

            {dateLabel && (
              <p className="mt-1 text-[11px]" style={{ color: EKARI.dim }}>
                {dateLabel}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ---------------- Gated states ---------------- */
  const InvalidRouteBody = (
    <main
      className="min-h-screen w-full px-4 py-6"
      style={{ backgroundColor: EKARI.bgSoft }}
    >
      <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
        <p className="text-sm" style={{ color: EKARI.dim }}>
          Invalid route.
        </p>
      </div>
    </main>
  );

  const CheckingBody = (
    <main
      className="flex w-full min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: EKARI.bgSoft }}
    >
      <div className="flex flex-col items-center gap-2 rounded-3xl bg-white px-6 py-5 shadow-sm border border-slate-200">
        <BouncingBallLoader />
        <p className="text-sm" style={{ color: EKARI.dim }}>
          Checking access to this earnings page…
        </p>
      </div>
    </main>
  );

  const SignInBody = (
    <main
      className="flex w-full min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: EKARI.bgSoft }}
    >
      <div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center shadow-sm border border-slate-200">
        <h1 className="mb-2 text-lg font-extrabold" style={{ color: EKARI.ink }}>
          Sign in to view earnings
        </h1>
        <p className="text-sm" style={{ color: EKARI.dim }}>
          You need to be signed in to see your ekarihub wallet and uplift history.
        </p>
      </div>
    </main>
  );

  const NotFoundBody = (
    <main
      className="flex w-full min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: EKARI.bgSoft }}
    >
      <div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center shadow-sm border border-slate-200">
        <h1 className="mb-2 text-lg font-extrabold" style={{ color: EKARI.ink }}>
          Profile not found
        </h1>
        <p className="text-sm" style={{ color: EKARI.dim }}>
          We couldn’t find a creator with handle{" "}
          <span className="font-semibold">{handle}</span>.
        </p>
      </div>
    </main>
  );

  const ForbiddenBody = (
    <main
      className="flex w-full min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: EKARI.bgSoft }}
    >
      <div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center shadow-sm border border-slate-200">
        <h1 className="mb-2 text-lg font-extrabold" style={{ color: EKARI.ink }}>
          Earnings are private
        </h1>
        <p className="text-sm" style={{ color: EKARI.dim }}>
          You can only view earnings for your own handle. This page is restricted
          to the creator who owns <span className="font-semibold">{handle}</span>.
        </p>
      </div>
    </main>
  );

  // Wrap helper
  const wrap = (body: React.ReactNode, title = "My Earnings") => {
    if (!isMobile) return <AppShell>{body}</AppShell>;

    return (
      <div className="fixed inset-0 flex flex-col bg-white">
        <div className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
          <div
            className="h-14 px-3 flex items-center gap-2"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <button
              onClick={goBack}
              className="h-10 w-10 rounded-full border border-gray-200 grid place-items-center bg-white shadow-sm"
              aria-label="Back"
            >
              <IoArrowBack size={18} />
            </button>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-black" style={{ color: EKARI.ink }}>
                {title}
              </div>
              <div className="truncate text-[11px]" style={{ color: EKARI.dim }}>
                @{String(params?.handle || "").replace(/^@/, "")}
              </div>
            </div>

            <button
              onClick={() => router.push(`/${params?.handle || ""}`)}
              className="h-10 px-3 rounded-full border border-gray-200 text-xs font-extrabold bg-white shadow-sm"
            >
              Profile
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">{body}</div>
        <div style={{ height: "env(safe-area-inset-bottom)" }} />
      </div>
    );
  };

  if (!handle || handle === "@") return wrap(InvalidRouteBody, "Earnings");
  if (authLoading || checkingOwnership) return wrap(CheckingBody, "Earnings");
  if (!user) return wrap(SignInBody, "Earnings");
  if (notFound) return wrap(NotFoundBody, "Earnings");
  if (forbidden || !ownerUid) return wrap(ForbiddenBody, "Earnings");

  /* ---------------- Main body ---------------- */
  const eligibleToWithdraw =
    !!wallet?.pendingBalance &&
    wallet.pendingBalance >= Math.round(minThresholdUsdMajor * 100);

  const MainBody = (
    <main
      className="min-h-screen w-full px-4 py-6"
      style={{
        background:
          "radial-gradient(1200px 500px at 20% -40%, rgba(199,146,87,.18), transparent 55%), radial-gradient(900px 380px at 90% 0%, rgba(35,63,57,.18), transparent 55%), " +
          EKARI.bgSoft,
      }}
    >
      <div className="mx-auto max-w-4xl">
        {/* Premium header */}
        {!isMobile && (
          <div className="mb-4 flex items-center justify-between">
            <Link
              href={`/${params?.handle || ""}`}
              className="inline-flex items-center gap-2 rounded-full border bg-white px-4 h-10 text-xs font-extrabold shadow-sm hover:bg-slate-50"
              style={{ borderColor: EKARI.hair, color: EKARI.ink }}
            >
              <IoArrowBackCircleOutline className="h-5 w-5" />
              Back to profile
            </Link>

            <div className="flex items-center gap-2">
              <Pill tone="neutral">Wallet base: USD</Pill>
              <Pill tone="emerald">Secure payouts</Pill>
            </div>
          </div>
        )}

        <Card className="p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 shadow-sm w-fit mb-2">
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-black text-white"
                  style={{ backgroundColor: EKARI.forest }}
                >
                  ⓔ
                </span>
                <span className="text-[11px] font-semibold tracking-[0.16em] uppercase" style={{ color: EKARI.dim }}>
                  Earnings • Creator wallet
                </span>
              </div>

              <h1 className="text-xl md:text-2xl font-black" style={{ color: EKARI.ink }}>
                My Earnings 💸
              </h1>
              <p className="text-xs md:text-sm mt-1" style={{ color: EKARI.dim }}>
                Track uplifts and topups flowing into your ekarihub wallet.
              </p>
            </div>

            {/* currency toggle */}
            <div className="flex items-center gap-2">
              <div className="rounded-full border bg-white p-1 shadow-sm" style={{ borderColor: EKARI.hair }}>
                <button
                  type="button"
                  onClick={() => handleToggleCurrency("USD")}
                  className={[
                    "px-3 h-9 rounded-full text-xs font-extrabold transition",
                    displayCurrency === "USD" ? "text-white" : "text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                  style={{
                    background: displayCurrency === "USD" ? EKARI.forest : "transparent",
                  }}
                >
                  USD
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleCurrency("KES")}
                  className={[
                    "px-3 h-9 rounded-full text-xs font-extrabold transition",
                    displayCurrency === "KES" ? "text-white" : "text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                  style={{
                    background: displayCurrency === "KES" ? EKARI.forest : "transparent",
                  }}
                >
                  KSh
                </button>
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div
              className="rounded-3xl border p-4 shadow-sm"
              style={{
                borderColor: "rgba(199,146,87,.35)",
                background:
                  "linear-gradient(135deg, rgba(253,247,236,1), rgba(255,255,255,1))",
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-[0.08em]" style={{ color: EKARI.dim }}>
                  Total received
                </p>
                <span className="text-lg">💰</span>
              </div>
              <p className="mt-1 text-2xl font-black" style={{ color: EKARI.ink }}>
                {fmtMoneyMajor(totalReceivedDisplayMajor, displayCurrency)}
              </p>
              <p className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                Across {wallet?.totalDonations || 0} uplifts
              </p>
            </div>

            <div className="rounded-3xl border p-4 bg-white shadow-sm" style={{ borderColor: EKARI.hair }}>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-[0.08em]" style={{ color: EKARI.dim }}>
                  Wallet balance
                </p>
                <span className="text-lg">🕒</span>
              </div>
              <p className="mt-1 text-2xl font-black" style={{ color: EKARI.ink }}>
                {fmtMoneyMajor(pendingBalanceDisplayMajor, displayCurrency)}
              </p>
              <p className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                Base USD balance internally: {fmtMoneyMajor(pendingBalanceUsdMajor, "USD")}
              </p>

              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={openTopupModal}
                  className="rounded-full px-3 h-10 text-xs font-extrabold text-white shadow-sm hover:opacity-95"
                  style={{
                    background: "linear-gradient(135deg, rgba(35,63,57,1), rgba(27,49,44,1))",
                  }}
                >
                  Top up wallet
                </button>

                <div className="text-right">
                  <p className="text-[11px] font-semibold" style={{ color: EKARI.dim }}>
                    Minimum withdraw
                  </p>
                  <p className="text-xs font-black" style={{ color: EKARI.ink }}>
                    {fmtMoneyMajor(minThresholdDisplayMajor, displayCurrency)}
                  </p>
                </div>
              </div>
            </div>

            <div
              className="rounded-3xl border p-4 shadow-sm"
              style={{
                borderColor: EKARI.hair,
                background:
                  "linear-gradient(135deg, rgba(255,255,255,1), rgba(248,250,252,1))",
              }}
            >
              <p className="text-[11px] font-black uppercase tracking-[0.08em]" style={{ color: EKARI.dim }}>
                Revenue split (typical)
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                <Pill tone="emerald">You ~{creatorSharePercentEffective}%</Pill>
                <Pill tone="neutral">ekarihub {platformSharePercentEffective}%</Pill>
              </div>

              <div className="mt-2">
                <Pill tone="amber">Provider fees(est) ~{processingFeePercentEffective}%</Pill>
              </div>

              <p className="mt-2 text-[11px]" style={{ color: EKARI.dim }}>
                This uses finance settings when available, otherwise falls back to the latest uplift.
              </p>
            </div>
          </div>

          {/* Withdraw button / message */}
          <div className="mt-4">
            {eligibleToWithdraw ? (
              <button
                type="button"
                onClick={openWithdrawModal}
                className="w-full rounded-full py-3 text-sm font-black text-white shadow-[0_18px_40px_rgba(16,185,129,.22)] hover:opacity-95"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(16,185,129,1), rgba(35,63,57,1))",
                }}
              >
                Withdraw Funds (choose amount)
              </button>
            ) : (
              <div className="rounded-2xl border px-4 py-3 bg-amber-50" style={{ borderColor: "rgba(245,158,11,.25)" }}>
                <p className="text-xs font-semibold text-amber-900">
                  Minimum withdrawal: {fmtMoneyMajor(minThresholdDisplayMajor, displayCurrency)}
                  {displayCurrency === "KES" && (
                    <> (≈ USD {minThresholdUsdMajor.toFixed(2)})</>
                  )}
                </p>
                <p className="text-[11px] text-amber-900/80 mt-1">
                  Keep earning uplifts or top up your wallet to reach the threshold.
                </p>
              </div>
            )}
          </div>

          {/* Settlement details */}
          <div className="mt-4">
            <Card className="p-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm md:text-base font-black" style={{ color: EKARI.ink }}>
                    Settlement details
                  </h3>
                  <p className="text-xs mt-1" style={{ color: EKARI.dim }}>
                    Enable payouts and set where we should settle withdrawals.
                    <span className="ml-1 font-semibold">
                      M-Pesa is automated · Bank is manual deposit.
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-3 md:mt-0">
                  <button
                    type="button"
                    onClick={() => setSettlement((p) => ({ ...p, enabled: !p.enabled }))}
                    className="rounded-full px-3 h-10 text-xs font-black border shadow-sm"
                    style={{
                      borderColor: EKARI.hair,
                      background: settlement.enabled ? "rgba(16,185,129,.10)" : "#fff",
                      color: settlement.enabled ? "#065F46" : "#334155",
                    }}
                  >
                    {settlement.enabled ? "Enabled" : "Disabled"}
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveSettlementDetails}
                    disabled={savingSettlement}
                    className="rounded-full px-4 h-10 text-xs font-black text-white disabled:opacity-60 shadow-sm"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(35,63,57,1), rgba(27,49,44,1))",
                    }}
                  >
                    {savingSettlement ? "Saving…" : "Save"}
                  </button>

                  {settlementSavedToast && (
                    <span className="text-xs font-black text-emerald-700">
                      {settlementSavedToast}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Preferred method
                  </label>
                  <select
                    value={settlement.method}
                    disabled={!settlement.enabled}
                    onChange={(e) => {
                      const m =
                        (e.target.value as SettlementMethod) === "bank" ? "bank" : "mpesa";
                      setSettlement((p) => ({ ...p, method: m }));
                    }}
                    className="w-full rounded-2xl border px-3 py-2 text-sm disabled:opacity-60 bg-white"
                    style={{ borderColor: EKARI.hair }}
                  >
                    <option value="mpesa">M-Pesa (Automated)</option>
                    <option value="bank">Bank (Manual deposit)</option>
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">
                    This preference helps admin settle your withdrawal correctly.
                  </p>
                </div>

                {settlement.method === "mpesa" ? (
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      M-Pesa phone
                    </label>
                    <input
                      value={settlement.mpesa.phone}
                      disabled={!settlement.enabled}
                      onChange={(e) =>
                        setSettlement((p) => ({
                          ...p,
                          mpesa: { ...p.mpesa, phone: e.target.value },
                        }))
                      }
                      placeholder='e.g. "07xxxxxxxx"'
                      className="w-full rounded-2xl border px-3 py-2 text-sm disabled:opacity-60 bg-white"
                      style={{ borderColor: EKARI.hair }}
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Accepts 07.. / 01.. / 254.. / +254..
                    </p>
                  </div>
                ) : (
                  <div className="rounded-3xl border bg-slate-50 px-3 py-3" style={{ borderColor: EKARI.hair }}>
                    <p className="text-xs font-black text-slate-800">
                      Bank is manual deposit
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600">
                      We’ll use the bank details below to pay you manually after approval.
                    </p>
                  </div>
                )}
              </div>

              {settlement.method === "bank" && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      Bank name <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={settlement.bank.bankName || ""}
                      disabled={!settlement.enabled}
                      onChange={(e) =>
                        setSettlement((p) => ({
                          ...p,
                          bank: { ...p.bank, bankName: e.target.value },
                        }))
                      }
                      placeholder="e.g. Equity / KCB"
                      className="w-full rounded-2xl border px-3 py-2 text-sm disabled:opacity-60 bg-white"
                      style={{ borderColor: EKARI.hair }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      Account number <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={settlement.bank.accountNumber || ""}
                      disabled={!settlement.enabled}
                      onChange={(e) =>
                        setSettlement((p) => ({
                          ...p,
                          bank: { ...p.bank, accountNumber: e.target.value },
                        }))
                      }
                      placeholder="e.g. 0123456789"
                      className="w-full rounded-2xl border px-3 py-2 text-sm disabled:opacity-60 bg-white"
                      style={{ borderColor: EKARI.hair }}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      Account name <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={settlement.bank.accountName || ""}
                      disabled={!settlement.enabled}
                      onChange={(e) =>
                        setSettlement((p) => ({
                          ...p,
                          bank: { ...p.bank, accountName: e.target.value },
                        }))
                      }
                      placeholder="Name as it appears on the bank account"
                      className="w-full rounded-2xl border px-3 py-2 text-sm disabled:opacity-60 bg-white"
                      style={{ borderColor: EKARI.hair }}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      Branch (optional)
                    </label>
                    <input
                      value={settlement.bank.branchName || ""}
                      disabled={!settlement.enabled}
                      onChange={(e) =>
                        setSettlement((p) => ({
                          ...p,
                          bank: { ...p.bank, branchName: e.target.value },
                        }))
                      }
                      placeholder="e.g. Tomboya Street"
                      className="w-full rounded-2xl border px-3 py-2 text-sm disabled:opacity-60 bg-white"
                      style={{ borderColor: EKARI.hair }}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className="rounded-3xl bg-amber-50 border border-amber-200 px-3 py-3">
                      <p className="text-[11px] font-black text-amber-900">
                        Note
                      </p>
                      <p className="text-[11px] text-amber-900/80 mt-1">
                        Ensure your bank details are accurate to avoid payout delays.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* History */}
          <div className="mt-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-black" style={{ color: EKARI.ink }}>
                History
              </h2>

              <div className="inline-flex rounded-full bg-slate-100 p-1 text-[11px] border border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab("donations")}
                  className={`px-3 h-9 rounded-full font-extrabold transition ${activeTab === "donations"
                    ? "bg-white shadow-sm text-emerald-900"
                    : "text-slate-600 hover:bg-white/60"
                    }`}
                >
                  Uplifts
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("topups")}
                  className={`px-3 h-9 rounded-full font-extrabold transition ${activeTab === "topups"
                    ? "bg-white shadow-sm text-emerald-900"
                    : "text-slate-600 hover:bg-white/60"
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
                <div className="mt-3 rounded-3xl bg-slate-50 px-5 py-6 text-center border border-slate-200">
                  <p className="mb-1 text-sm font-black" style={{ color: EKARI.ink }}>
                    No uplifts yet
                  </p>
                  <p className="text-xs md:text-sm" style={{ color: EKARI.dim }}>
                    When viewers support your deeds with tips, they’ll appear here
                    in real-time. Keep creating and sharing value. 🌱
                  </p>
                </div>
              ) : (
                <div className="pt-2 pb-2">{donations.map((d) => renderDonation(d))}</div>
              )
            ) : topups.length === 0 ? (
              <div className="mt-3 rounded-3xl bg-slate-50 px-5 py-6 text-center border border-slate-200">
                <p className="mb-1 text-sm font-black" style={{ color: EKARI.ink }}>
                  No wallet topups yet
                </p>
                <p className="text-xs md:text-sm" style={{ color: EKARI.dim }}>
                  Top up your wallet to see your funding history here.
                </p>
              </div>
            ) : (
              <div className="pt-2 pb-2">{topups.map((t) => renderTopup(t))}</div>
            )}
          </div>
        </Card>
      </div>

      {/* ---------------- Top-up modal ---------------- */}
      {topupOpen &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-center justify-center">
            <div
              className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${topupAnimated ? "opacity-100" : "opacity-0"
                }`}
              onClick={() => !topupLoading && setTopupOpen(false)}
            />

            <div
              className={`relative w-full max-w-md px-5 pb-5 pt-4 rounded-[28px] bg-white shadow-[0_25px_80px_rgba(0,0,0,.25)] transition-all duration-200 transform ${topupAnimated
                ? "opacity-100 scale-100 translate-y-0"
                : "opacity-0 scale-95 translate-y-2"
                }`}
              style={{
                marginBottom: isMobile ? "env(safe-area-inset-bottom)" : undefined,
                width: isMobile ? "92vw" : undefined,
              }}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 shadow-sm w-fit">
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-black text-white"
                      style={{ backgroundColor: EKARI.forest }}
                    >
                      ⓔ
                    </span>
                    <span className="text-[11px] font-semibold tracking-[0.16em] uppercase" style={{ color: EKARI.dim }}>
                      Wallet top-up
                    </span>
                  </div>
                  <h2 className="mt-2 text-[16px] font-black text-gray-900">
                    Add funds to your wallet
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Enter amount in {displayCurrency === "USD" ? "USD" : "Kenyan Shillings"}.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={topupLoading}
                  onClick={() => setTopupOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-xs font-extrabold text-gray-700">
                  Amount ({displayCurrency === "USD" ? "USD" : "KSh"})
                </label>

                <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <span className="text-xs font-extrabold text-gray-500">
                    {displayCurrency === "USD" ? "USD" : "KSh"}
                  </span>
                  <input
                    type="number"
                    min={displayCurrency === "USD" ? 1 : 100}
                    step={displayCurrency === "USD" ? 1 : 50}
                    value={topupAmount}
                    onChange={(e) => {
                      setTopupAmount(e.target.value);
                      if (topupError) setTopupError(null);
                    }}
                    className="flex-1 border-none bg-transparent text-sm outline-none placeholder:text-gray-300"
                    placeholder={displayCurrency === "USD" ? "e.g. 10" : "e.g. 1000"}
                  />
                </div>

                <p className="mt-1 text-[11px] text-gray-400">
                  You’ll be redirected to a secure Paystack page to complete the top-up.
                </p>

                {topupError && (
                  <p className="mt-2 text-[11px] text-red-600">{topupError}</p>
                )}
              </div>

              <button
                type="button"
                onClick={handleConfirmTopup}
                disabled={topupLoading}
                className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-black text-white shadow-sm transition disabled:opacity-60"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(35,63,57,1), rgba(199,146,87,.95))",
                }}
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
                Your wallet balance will update automatically once the payment succeeds.
              </p>
            </div>
          </div>,
          document.body
        )}

      {/* ---------------- Withdraw modal (partial) ---------------- */}
      {withdrawOpen &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center">
            <div
              className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${withdrawAnimated ? "opacity-100" : "opacity-0"
                }`}
              onClick={() => !withdrawSubmitting && setWithdrawOpen(false)}
            />

            <div
              className={`relative w-full max-w-md px-5 pb-5 pt-4 rounded-[28px] bg-white shadow-[0_25px_80px_rgba(0,0,0,.25)] transition-all duration-200 transform ${withdrawAnimated
                ? "opacity-100 scale-100 translate-y-0"
                : "opacity-0 scale-95 translate-y-2"
                }`}
              style={{
                marginBottom: isMobile ? "env(safe-area-inset-bottom)" : undefined,
                width: isMobile ? "92vw" : undefined,
              }}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 shadow-sm w-fit">
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-black text-white"
                      style={{ backgroundColor: EKARI.forest }}
                    >
                      ⓔ
                    </span>
                    <span className="text-[11px] font-semibold tracking-[0.16em] uppercase" style={{ color: EKARI.dim }}>
                      Withdrawal request
                    </span>
                  </div>

                  <h2 className="mt-2 text-[16px] font-black text-gray-900">
                    Choose amount to withdraw
                  </h2>

                  <p className="mt-1 text-xs text-gray-500">
                    Available:{" "}
                    <b>
                      {fmtMoneyMajor(pendingBalanceDisplayMajor, displayCurrency)}
                    </b>{" "}
                    · Minimum:{" "}
                    <b>
                      {fmtMoneyMajor(minThresholdDisplayMajor, displayCurrency)}
                    </b>
                  </p>
                </div>

                <button
                  type="button"
                  disabled={withdrawSubmitting}
                  onClick={() => setWithdrawOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40"
                >
                  ✕
                </button>
              </div>

              <div className="mb-3">
                <label className="mb-1 block text-xs font-extrabold text-gray-700">
                  Amount ({displayCurrency === "USD" ? "USD" : "KSh"})
                </label>

                <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <span className="text-xs font-extrabold text-gray-500">
                    {displayCurrency === "USD" ? "USD" : "KSh"}
                  </span>
                  <input
                    type="number"
                    min={displayCurrency === "USD" ? 0.01 : 1}
                    step={displayCurrency === "USD" ? 0.01 : 1}
                    value={withdrawAmount}
                    onChange={(e) => {
                      setWithdrawAmount(e.target.value);
                      if (withdrawError) setWithdrawError(null);
                    }}
                    className="flex-1 border-none bg-transparent text-sm outline-none placeholder:text-gray-300"
                    placeholder={displayCurrency === "USD" ? "e.g. 10.00" : "e.g. 1500"}
                    disabled={withdrawSubmitting}
                  />
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {[25, 50, 75].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      disabled={withdrawSubmitting}
                      onClick={() => {
                        const v = (pendingBalanceDisplayMajor * pct) / 100;
                        setWithdrawAmount(
                          v.toFixed(displayCurrency === "KES" ? 0 : 2)
                        );
                        setWithdrawError(null);
                      }}
                      className="rounded-full border px-3 h-9 text-[11px] font-extrabold hover:bg-gray-50 disabled:opacity-60"
                      style={{ borderColor: EKARI.hair, color: EKARI.ink }}
                    >
                      {pct}%
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={withdrawSubmitting}
                    onClick={() => {
                      setWithdrawAmount(
                        pendingBalanceDisplayMajor.toFixed(
                          displayCurrency === "KES" ? 0 : 2
                        )
                      );
                      setWithdrawError(null);
                    }}
                    className="rounded-full border px-3 h-9 text-[11px] font-extrabold hover:bg-gray-50 disabled:opacity-60"
                    style={{ borderColor: EKARI.hair, color: EKARI.ink }}
                  >
                    Max
                  </button>
                </div>

                {withdrawError && (
                  <p className="mt-2 text-[11px] text-red-600">{withdrawError}</p>
                )}

                <div className="mt-3 rounded-2xl border px-3 py-2 bg-slate-50" style={{ borderColor: EKARI.hair }}>
                  <p className="text-[11px] text-slate-600">
                    Your wallet is stored in <b>USD</b>. If you enter KSh, we convert using{" "}
                    <b>{usdToKesRate}</b> KES per USD.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRequestWithdraw}
                disabled={withdrawSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-black text-white shadow-sm transition disabled:opacity-60"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(16,185,129,1), rgba(35,63,57,1))",
                }}
              >
                {withdrawSubmitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Submitting…</span>
                  </>
                ) : (
                  <>
                    <span role="img" aria-label="cash">
                      💸
                    </span>
                    <span>Submit withdrawal request</span>
                  </>
                )}
              </button>

              <p className="mt-2 text-center text-[10px] text-gray-500">
                Requests are reviewed before payout. Your saved settlement method will be used.
              </p>
            </div>
          </div>,
          document.body
        )}

      {/* Feedback Modal */}
      <ConfirmModal
        open={!!feedbackModal}
        title={feedbackModal?.title || ""}
        message={feedbackModal?.message || ""}
        confirmText="OK"
        cancelText="Close"
        onConfirm={() => setFeedbackModal(null)}
        onCancel={() => setFeedbackModal(null)}
      />
    </main>
  );

  return wrap(MainBody, "My Earnings");
}