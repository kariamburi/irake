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
import {
  IoArrowBack,
  IoCashOutline,
  IoWalletOutline,
  IoTrendingUpOutline,
  IoSwapHorizontalOutline,
  IoShieldCheckmarkOutline,
  IoInformationCircleOutline,
  IoPhonePortraitOutline,
  IoBusinessOutline,
  IoAddOutline,
  IoRemoveOutline,
  IoCheckmarkCircleOutline,
} from "react-icons/io5";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import { ConfirmModal } from "@/app/components/ConfirmModal";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

const EKARI = {
  forest: "#173C2E",
  forest2: "#214C3A",
  gold: "#c69258",
  sand: "#F8F7F2",
  paper: "#FBFAF6",
  ink: "#111827",
  dim: "#64748B",
  hair: "#DDD8CC",
  bgSoft: "#F8F7F2",
  card: "#FBFAF6",
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
      className={[
        "rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6]",
        "shadow-[0_10px_28px_rgba(15,23,42,0.025)]",
        className,
      ].join(" ")}
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
        className="mt-3 rounded-[16px] border border-[#DDD8CC] bg-[#FBFAF6] px-3.5 py-3.5 transition hover:bg-[#F8F7F2]"
        style={{ borderColor: EKARI.hair }}
      >
        <div className="flex items-start gap-3">
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#173C2E] text-white text-lg shadow-sm"
            style={{
              background:
                "linear-gradient(135deg, #173C2E, #c69258)",
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
        className="mt-3 rounded-[16px] border border-[#DDD8CC] bg-[#FBFAF6] px-3.5 py-3.5 transition hover:bg-[#F8F7F2]"
        style={{ borderColor: EKARI.hair }}
      >
        <div className="flex items-start gap-3">
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#173C2E] text-white text-lg shadow-sm"
            style={{
              background:
                "linear-gradient(135deg, #173C2E, #3B82F6)",
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

  const ShellState = ({
    title,
    message,
    tone = "neutral",
  }: {
    title: string;
    message: string;
    tone?: "neutral" | "danger";
  }) => {
    const body = (
      <main className="grid min-h-[100svh] place-items-center bg-[#F8F7F2] px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] p-7 text-center shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
        >
          <div
            className={[
              "mx-auto grid h-14 w-14 place-items-center rounded-full",
              tone === "danger"
                ? "bg-rose-50 text-rose-600"
                : "bg-[#E8ECE8] text-[#173C2E]",
            ].join(" ")}
          >
            {tone === "danger" ? (
              <IoInformationCircleOutline size={25} />
            ) : (
              <IoWalletOutline size={25} />
            )}
          </div>

          <h1 className="mt-4 text-[18px] font-black text-slate-900">
            {title}
          </h1>

          <p className="mt-2 text-[12px] font-medium leading-5 text-slate-500">
            {message}
          </p>
        </motion.div>
      </main>
    );

    return isMobile ? body : <AppShell>{body}</AppShell>;
  };

  if (!handle || handle === "@") {
    return (
      <ShellState
        title="Invalid earnings route"
        message="The creator handle in this earnings URL is not valid."
        tone="danger"
      />
    );
  }

  if (authLoading || checkingOwnership) {
    const body = (
      <main className="grid min-h-[100svh] place-items-center bg-[#F8F7F2]">
        <div className="text-center">
          <BouncingBallLoader />
          <p className="mt-3 text-[11px] font-semibold text-slate-400">
            Checking access to earnings…
          </p>
        </div>
      </main>
    );

    return isMobile ? body : <AppShell>{body}</AppShell>;
  }

  if (!user) {
    return (
      <ShellState
        title="Sign in to view earnings"
        message="You need to be signed in to see your ekarihub wallet, uplifts and payout settings."
      />
    );
  }

  if (notFound) {
    return (
      <ShellState
        title="Profile not found"
        message={`We couldn’t find a creator with handle ${handle}.`}
        tone="danger"
      />
    );
  }

  if (forbidden || !ownerUid) {
    return (
      <ShellState
        title="Earnings are private"
        message={`You can only view earnings for your own creator handle. This page is restricted to the owner of ${handle}.`}
        tone="danger"
      />
    );
  }

  const eligibleToWithdraw =
    !!wallet?.pendingBalance &&
    wallet.pendingBalance >=
    Math.round(minThresholdUsdMajor * 100);

  const settlementReady =
    settlement.enabled &&
    (settlement.method === "mpesa"
      ? isValidMpesaPhone(settlement.mpesa.phone)
      : !!cleanStr(settlement.bank.bankName) &&
      !!cleanStr(settlement.bank.accountNumber) &&
      !!cleanStr(settlement.bank.accountName));

  const Header = (
    <motion.header
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="relative shrink-0 overflow-hidden bg-[#173C2E] text-white"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.6) 18px 19px)",
        }}
      />

      <div className="relative mx-auto max-w-[1180px] px-4 py-5 md:px-6 md:py-6">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={goBack}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[0.06] text-white transition hover:bg-white/[0.11] active:scale-95"
            aria-label="Back"
          >
            <IoArrowBack size={19} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#c69258]">
              Creator wallet
            </div>

            <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-[24px] font-black tracking-[-0.035em] md:text-[28px]">
                  My earnings
                </h1>

                <p className="mt-1 max-w-2xl text-[11px] font-medium leading-5 text-white/50 md:text-[12px]">
                  Track uplifts, wallet activity, settlement details and withdrawal eligibility.
                </p>
              </div>

              <div className="inline-flex rounded-xl border border-white/15 bg-white/[0.06] p-1">
                {(["USD", "KES"] as PreferredCurrency[]).map((currency) => {
                  const active = displayCurrency === currency;

                  return (
                    <button
                      key={currency}
                      type="button"
                      onClick={() => handleToggleCurrency(currency)}
                      className={[
                        "rounded-lg px-3 py-2 text-[10px] font-black transition",
                        active
                          ? "bg-white text-[#173C2E]"
                          : "text-white/55 hover:text-white",
                      ].join(" ")}
                    >
                      {currency === "KES" ? "KSh" : "USD"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[9px] font-semibold text-white/35">
              <span>Wallet base: USD</span>
              <span>•</span>
              <span>Secure creator payouts</span>
              <span>•</span>
              <span>{handle}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  );

  const Summary = (
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryCard
        icon={<IoTrendingUpOutline size={18} />}
        label="Total received"
        value={fmtMoneyMajor(totalReceivedDisplayMajor, displayCurrency)}
        hint={`Across ${wallet?.totalDonations || 0} uplifts`}
      />

      <SummaryCard
        icon={<IoWalletOutline size={18} />}
        label="Available wallet"
        value={fmtMoneyMajor(pendingBalanceDisplayMajor, displayCurrency)}
        hint={`Base balance ${fmtMoneyMajor(pendingBalanceUsdMajor, "USD")}`}
      />

      <SummaryCard
        icon={<IoSwapHorizontalOutline size={18} />}
        label="Minimum withdrawal"
        value={fmtMoneyMajor(minThresholdDisplayMajor, displayCurrency)}
        hint={
          displayCurrency === "KES"
            ? `≈ USD ${minThresholdUsdMajor.toFixed(2)}`
            : "Configured by finance settings"
        }
      />
    </div>
  );

  const HistoryPanel = (
    <motion.section
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: 0.04 }}
      className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.025)] sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
            Wallet activity
          </div>

          <h2 className="mt-1 text-[16px] font-black text-slate-900">
            Earnings history
          </h2>

          <p className="mt-1 text-[10px] font-medium text-slate-400">
            Review uplifts received and wallet top-ups.
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-[#D9D3C7] bg-[#F8F7F2] p-1">
          {(["donations", "topups"] as HistoryTab[]).map((tab) => {
            const active = activeTab === tab;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={[
                  "rounded-lg px-3 py-2 text-[10px] font-black transition",
                  active
                    ? "bg-[#173C2E] text-white"
                    : "text-slate-500 hover:bg-white",
                ].join(" ")}
              >
                {tab === "donations" ? "Uplifts" : "Top-ups"}
              </button>
            );
          })}
        </div>
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className="mt-3"
      >
        {activeTab === "donations" ? (
          donations.length ? (
            donations.map(renderDonation)
          ) : (
            <EmptyHistory
              icon={<IoTrendingUpOutline size={22} />}
              title="No uplifts yet"
              text="When members uplift your deeds, successful payments will appear here."
            />
          )
        ) : topups.length ? (
          topups.map(renderTopup)
        ) : (
          <EmptyHistory
            icon={<IoWalletOutline size={22} />}
            title="No wallet top-ups"
            text="Top-ups you complete through Paystack will appear here."
          />
        )}
      </motion.div>
    </motion.section>
  );

  const SettlementPanel = (
    <motion.section
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: 0.06 }}
      className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.025)] sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
            Payout destination
          </div>

          <h2 className="mt-1 text-[16px] font-black text-slate-900">
            Settlement details
          </h2>

          <p className="mt-1 max-w-xl text-[10px] font-medium leading-4 text-slate-400">
            Choose where approved withdrawal requests should be paid. M-Pesa is automated; bank settlements are processed manually.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setSettlement((current) => ({
                ...current,
                enabled: !current.enabled,
              }))
            }
            className={[
              "h-9 rounded-xl border px-3 text-[10px] font-black transition",
              settlement.enabled
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-[#D9D3C7] bg-white text-slate-500",
            ].join(" ")}
          >
            {settlement.enabled ? "Enabled" : "Disabled"}
          </button>

          <button
            type="button"
            onClick={handleSaveSettlementDetails}
            disabled={savingSettlement}
            className="h-9 rounded-xl bg-[#173C2E] px-4 text-[10px] font-black text-white transition hover:bg-[#214C3A] disabled:opacity-60"
          >
            {savingSettlement ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {settlementSavedToast ? (
          <motion.div
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-[10px] font-black text-emerald-700"
          >
            {settlementSavedToast}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-black text-slate-600">
            Preferred payout method
          </span>

          <select
            value={settlement.method}
            disabled={!settlement.enabled}
            onChange={(event) =>
              setSettlement((current) => ({
                ...current,
                method:
                  event.target.value === "bank"
                    ? "bank"
                    : "mpesa",
              }))
            }
            className="mt-1.5 h-11 w-full rounded-xl border border-[#D9D3C7] bg-white px-3 text-[11px] font-semibold text-slate-700 outline-none transition focus:border-[#173C2E]/45 disabled:opacity-50"
          >
            <option value="mpesa">M-Pesa (Automated)</option>
            <option value="bank">Bank (Manual deposit)</option>
          </select>
        </label>

        {settlement.method === "mpesa" ? (
          <label className="block">
            <span className="text-[10px] font-black text-slate-600">
              M-Pesa phone
            </span>

            <input
              value={settlement.mpesa.phone}
              disabled={!settlement.enabled}
              onChange={(event) =>
                setSettlement((current) => ({
                  ...current,
                  mpesa: {
                    ...current.mpesa,
                    phone: event.target.value,
                  },
                }))
              }
              placeholder="07xxxxxxxx"
              className="mt-1.5 h-11 w-full rounded-xl border border-[#D9D3C7] bg-white px-3 text-[11px] font-semibold text-slate-700 outline-none transition focus:border-[#173C2E]/45 disabled:opacity-50"
            />
          </label>
        ) : (
          <div className="rounded-[14px] border border-[#DDD8CC] bg-[#F3F1EB] px-3 py-3">
            <div className="flex items-start gap-2.5">
              <IoBusinessOutline
                size={16}
                className="mt-0.5 shrink-0 text-[#173C2E]"
              />

              <div>
                <div className="text-[10px] font-black text-slate-700">
                  Manual bank deposit
                </div>

                <p className="mt-1 text-[9px] font-medium leading-4 text-slate-400">
                  Approved withdrawals will use the bank details below.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {settlement.method === "bank" ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            {
              label: "Bank name",
              value: settlement.bank.bankName || "",
              key: "bankName",
              placeholder: "e.g. Equity / KCB",
            },
            {
              label: "Account number",
              value: settlement.bank.accountNumber || "",
              key: "accountNumber",
              placeholder: "0123456789",
            },
            {
              label: "Account name",
              value: settlement.bank.accountName || "",
              key: "accountName",
              placeholder: "Name on the bank account",
            },
            {
              label: "Branch (optional)",
              value: settlement.bank.branchName || "",
              key: "branchName",
              placeholder: "Branch name",
            },
          ].map((field) => (
            <label key={field.key} className="block">
              <span className="text-[10px] font-black text-slate-600">
                {field.label}
              </span>

              <input
                value={field.value}
                disabled={!settlement.enabled}
                onChange={(event) =>
                  setSettlement((current) => ({
                    ...current,
                    bank: {
                      ...current.bank,
                      [field.key]: event.target.value,
                    },
                  }))
                }
                placeholder={field.placeholder}
                className="mt-1.5 h-11 w-full rounded-xl border border-[#D9D3C7] bg-white px-3 text-[11px] font-semibold text-slate-700 outline-none transition focus:border-[#173C2E]/45 disabled:opacity-50"
              />
            </label>
          ))}
        </div>
      ) : null}
    </motion.section>
  );

  const RightRail = (
    <motion.aside
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.24, delay: 0.04, ease: "easeOut" }}
      className="hidden space-y-3 xl:sticky xl:top-4 xl:block"
    >
      <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
        <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
          Wallet balance
        </div>

        <div className="mt-1 text-[25px] font-black tracking-[-0.04em] text-[#173C2E]">
          {fmtMoneyMajor(pendingBalanceDisplayMajor, displayCurrency)}
        </div>

        <p className="mt-1 text-[9px] font-medium text-slate-400">
          Internal base balance: {fmtMoneyMajor(pendingBalanceUsdMajor, "USD")}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={openTopupModal}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#D9D3C7] bg-white px-3 text-[10px] font-black text-[#173C2E] transition hover:bg-[#EEF3EE]"
          >
            <IoAddOutline size={14} />
            Top up
          </button>

          <button
            type="button"
            onClick={openWithdrawModal}
            disabled={!eligibleToWithdraw}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#173C2E] px-3 text-[10px] font-black text-white transition hover:bg-[#214C3A] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IoRemoveOutline size={14} />
            Withdraw
          </button>
        </div>

        {!eligibleToWithdraw ? (
          <p className="mt-3 text-[9px] font-medium leading-4 text-amber-700">
            Minimum withdrawal: {fmtMoneyMajor(minThresholdDisplayMajor, displayCurrency)}
          </p>
        ) : null}
      </section>

      <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
        <div className="flex items-start gap-3">
          <span
            className={[
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
              settlementReady
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700",
            ].join(" ")}
          >
            {settlement.method === "mpesa" ? (
              <IoPhonePortraitOutline size={17} />
            ) : (
              <IoBusinessOutline size={17} />
            )}
          </span>

          <div className="min-w-0">
            <div className="text-[12px] font-black text-slate-800">
              Payout destination
            </div>

            <p className="mt-1 text-[10px] font-medium leading-4 text-slate-400">
              {settlementReady
                ? settlement.method === "mpesa"
                  ? `M-Pesa · ${settlement.mpesa.phone}`
                  : `${settlement.bank.bankName || "Bank"} · ${settlement.bank.accountNumber || ""}`
                : "Settlement details need attention before withdrawal."}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
        <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
          Revenue split
        </div>

        <div className="mt-3 space-y-2">
          <SplitRow
            label="Creator share"
            value={`~${creatorSharePercentEffective}%`}
            strong
          />

          <SplitRow
            label="ekarihub"
            value={`${platformSharePercentEffective}%`}
          />

          <SplitRow
            label="Provider fees (est.)"
            value={`~${processingFeePercentEffective}%`}
          />
        </div>

        <p className="mt-3 text-[9px] font-medium leading-4 text-slate-400">
          Finance settings are used when available; otherwise the latest uplift values are used.
        </p>
      </section>

      <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E8ECE8] text-[#173C2E]">
            <IoShieldCheckmarkOutline size={17} />
          </span>

          <div>
            <div className="text-[12px] font-black text-slate-800">
              Secure payouts
            </div>

            <p className="mt-1 text-[10px] font-medium leading-4 text-slate-400">
              Withdrawal requests are reviewed before funds are settled to your saved payout method.
            </p>
          </div>
        </div>
      </section>
    </motion.aside>
  );

  const MainBody = (
    <div className="h-full min-h-0 overflow-y-auto bg-[#F8F7F2]">

      {Header}
      <main className="min-h-0 flex-1">

        <div className="mx-auto grid max-w-[1180px] gap-5 px-3 py-4 sm:px-4 md:px-6 md:py-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
          <section className="min-w-0 space-y-4">
            {Summary}

            <motion.section
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.02 }}
              className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.025)] sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
                    Available funds
                  </div>

                  <div className="mt-1 text-[26px] font-black tracking-[-0.04em] text-[#173C2E]">
                    {fmtMoneyMajor(pendingBalanceDisplayMajor, displayCurrency)}
                  </div>

                  <p className="mt-1 text-[10px] font-medium text-slate-400">
                    Minimum withdrawal: {fmtMoneyMajor(minThresholdDisplayMajor, displayCurrency)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={openTopupModal}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-4 text-[10px] font-black text-[#173C2E] transition hover:bg-[#EEF3EE]"
                  >
                    <IoWalletOutline size={14} />
                    Top up wallet
                  </button>

                  <button
                    type="button"
                    onClick={openWithdrawModal}
                    disabled={!eligibleToWithdraw}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#173C2E] px-4 text-[10px] font-black text-white transition hover:-translate-y-0.5 hover:bg-[#214C3A] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <IoCashOutline size={14} />
                    Withdraw funds
                  </button>
                </div>
              </div>

              {!eligibleToWithdraw ? (
                <div className="mt-4 rounded-[14px] border border-amber-200 bg-amber-50 px-3.5 py-3">
                  <p className="text-[10px] font-black text-amber-900">
                    Withdrawal threshold not reached
                  </p>

                  <p className="mt-1 text-[9px] font-medium leading-4 text-amber-800">
                    Keep earning uplifts or top up your wallet until your available balance reaches {fmtMoneyMajor(minThresholdDisplayMajor, displayCurrency)}.
                  </p>
                </div>
              ) : null}
            </motion.section>

            {SettlementPanel}
            {HistoryPanel}
          </section>

          {RightRail}
        </div>
      </main>

      {/* TOP-UP MODAL */}
      {topupOpen &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
            <div
              className={[
                "absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity duration-200",
                topupAnimated ? "opacity-100" : "opacity-0",
              ].join(" ")}
              onClick={() => !topupLoading && setTopupOpen(false)}
            />

            <div
              className={[
                "relative w-full max-w-md rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] p-5",
                "shadow-[0_25px_80px_rgba(0,0,0,.25)] transition-all duration-200",
                topupAnimated
                  ? "translate-y-0 scale-100 opacity-100"
                  : "translate-y-2 scale-95 opacity-0",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                    Creator wallet
                  </div>

                  <h2 className="mt-1 text-[18px] font-black text-slate-900">
                    Top up wallet
                  </h2>

                  <p className="mt-1 text-[10px] font-medium text-slate-400">
                    Add funds in {displayCurrency === "USD" ? "USD" : "Kenyan shillings"}.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={topupLoading}
                  onClick={() => setTopupOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-[#D9D3C7] bg-white text-slate-600 disabled:opacity-40"
                >
                  ×
                </button>
              </div>

              <label className="mt-4 block">
                <span className="text-[10px] font-black text-slate-600">
                  Amount ({displayCurrency === "USD" ? "USD" : "KSh"})
                </span>

                <div className="mt-1.5 flex h-12 items-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-3">
                  <span className="text-[10px] font-black text-slate-400">
                    {displayCurrency === "USD" ? "USD" : "KSh"}
                  </span>

                  <input
                    type="number"
                    min={displayCurrency === "USD" ? 1 : 100}
                    step={displayCurrency === "USD" ? 1 : 50}
                    value={topupAmount}
                    onChange={(event) => {
                      setTopupAmount(event.target.value);
                      if (topupError) setTopupError(null);
                    }}
                    className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-slate-800 outline-none"
                    placeholder={displayCurrency === "USD" ? "10" : "1000"}
                  />
                </div>
              </label>

              {topupError ? (
                <div className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-[10px] font-semibold text-rose-700">
                  {topupError}
                </div>
              ) : null}

              <p className="mt-2 text-[9px] font-medium leading-4 text-slate-400">
                You’ll continue to secure Paystack checkout. The wallet updates automatically after successful payment.
              </p>

              <button
                type="button"
                onClick={handleConfirmTopup}
                disabled={topupLoading}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#c69258] px-4 text-[11px] font-black text-white transition hover:bg-[#E98C12] disabled:opacity-60"
              >
                {topupLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                    Starting top-up…
                  </>
                ) : (
                  "Continue to payment"
                )}
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* WITHDRAW MODAL */}
      {withdrawOpen &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
            <div
              className={[
                "absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity duration-200",
                withdrawAnimated ? "opacity-100" : "opacity-0",
              ].join(" ")}
              onClick={() => !withdrawSubmitting && setWithdrawOpen(false)}
            />

            <div
              className={[
                "relative w-full max-w-md rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] p-5",
                "shadow-[0_25px_80px_rgba(0,0,0,.25)] transition-all duration-200",
                withdrawAnimated
                  ? "translate-y-0 scale-100 opacity-100"
                  : "translate-y-2 scale-95 opacity-0",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                    Withdrawal request
                  </div>

                  <h2 className="mt-1 text-[18px] font-black text-slate-900">
                    Choose withdrawal amount
                  </h2>

                  <p className="mt-1 text-[10px] font-medium text-slate-400">
                    Available {fmtMoneyMajor(pendingBalanceDisplayMajor, displayCurrency)}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={withdrawSubmitting}
                  onClick={() => setWithdrawOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-[#D9D3C7] bg-white text-slate-600 disabled:opacity-40"
                >
                  ×
                </button>
              </div>

              <label className="mt-4 block">
                <span className="text-[10px] font-black text-slate-600">
                  Amount ({displayCurrency === "USD" ? "USD" : "KSh"})
                </span>

                <div className="mt-1.5 flex h-12 items-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-3">
                  <span className="text-[10px] font-black text-slate-400">
                    {displayCurrency === "USD" ? "USD" : "KSh"}
                  </span>

                  <input
                    type="number"
                    min={displayCurrency === "USD" ? 0.01 : 1}
                    step={displayCurrency === "USD" ? 0.01 : 1}
                    value={withdrawAmount}
                    onChange={(event) => {
                      setWithdrawAmount(event.target.value);
                      if (withdrawError) setWithdrawError(null);
                    }}
                    className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-slate-800 outline-none"
                    disabled={withdrawSubmitting}
                  />
                </div>
              </label>

              <div className="mt-2 flex flex-wrap gap-2">
                {[25, 50, 75].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    disabled={withdrawSubmitting}
                    onClick={() => {
                      const value =
                        (pendingBalanceDisplayMajor * pct) / 100;

                      setWithdrawAmount(
                        value.toFixed(displayCurrency === "KES" ? 0 : 2)
                      );

                      setWithdrawError(null);
                    }}
                    className="h-8 rounded-lg border border-[#D9D3C7] bg-white px-3 text-[9px] font-black text-slate-600 transition hover:bg-[#F3F1EB] disabled:opacity-50"
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
                  className="h-8 rounded-lg bg-[#173C2E] px-3 text-[9px] font-black text-white disabled:opacity-50"
                >
                  Max
                </button>
              </div>

              {withdrawError ? (
                <div className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-[10px] font-semibold text-rose-700">
                  {withdrawError}
                </div>
              ) : null}

              <div className="mt-3 rounded-xl border border-[#DDD8CC] bg-[#F3F1EB] px-3 py-2.5">
                <p className="text-[9px] font-medium leading-4 text-slate-500">
                  Wallet balances are stored in USD. KSh requests use the current rate of {usdToKesRate} KES per USD.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRequestWithdraw}
                disabled={withdrawSubmitting}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173C2E] px-4 text-[11px] font-black text-white transition hover:bg-[#214C3A] disabled:opacity-60"
              >
                {withdrawSubmitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                    Submitting…
                  </>
                ) : (
                  "Submit withdrawal request"
                )}
              </button>

              <p className="mt-2 text-center text-[9px] font-medium leading-4 text-slate-400">
                Requests are reviewed before payout and use your saved settlement method.
              </p>
            </div>
          </div>,
          document.body
        )}

      <ConfirmModal
        open={!!feedbackModal}
        title={feedbackModal?.title || ""}
        message={feedbackModal?.message || ""}
        confirmText="OK"
        cancelText="Close"
        onConfirm={() => setFeedbackModal(null)}
        onCancel={() => setFeedbackModal(null)}
      />
    </div>
  );
  const page = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F8F7F2]">
      {Header}

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">

      </main>
    </div>
  );
  const MainBodyMobile = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F8F7F2]">

      {Header}
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">

        <div className="mx-auto grid max-w-[1180px] gap-5 px-3 py-4 sm:px-4 md:px-6 md:py-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
          <section className="min-w-0 space-y-4">
            {Summary}

            <motion.section
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.02 }}
              className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.025)] sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
                    Available funds
                  </div>

                  <div className="mt-1 text-[26px] font-black tracking-[-0.04em] text-[#173C2E]">
                    {fmtMoneyMajor(pendingBalanceDisplayMajor, displayCurrency)}
                  </div>

                  <p className="mt-1 text-[10px] font-medium text-slate-400">
                    Minimum withdrawal: {fmtMoneyMajor(minThresholdDisplayMajor, displayCurrency)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={openTopupModal}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-4 text-[10px] font-black text-[#173C2E] transition hover:bg-[#EEF3EE]"
                  >
                    <IoWalletOutline size={14} />
                    Top up wallet
                  </button>

                  <button
                    type="button"
                    onClick={openWithdrawModal}
                    disabled={!eligibleToWithdraw}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#173C2E] px-4 text-[10px] font-black text-white transition hover:-translate-y-0.5 hover:bg-[#214C3A] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <IoCashOutline size={14} />
                    Withdraw funds
                  </button>
                </div>
              </div>

              {!eligibleToWithdraw ? (
                <div className="mt-4 rounded-[14px] border border-amber-200 bg-amber-50 px-3.5 py-3">
                  <p className="text-[10px] font-black text-amber-900">
                    Withdrawal threshold not reached
                  </p>

                  <p className="mt-1 text-[9px] font-medium leading-4 text-amber-800">
                    Keep earning uplifts or top up your wallet until your available balance reaches {fmtMoneyMajor(minThresholdDisplayMajor, displayCurrency)}.
                  </p>
                </div>
              ) : null}
            </motion.section>

            {SettlementPanel}
            {HistoryPanel}
          </section>

          {RightRail}
        </div>
      </main>

      {/* TOP-UP MODAL */}
      {topupOpen &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
            <div
              className={[
                "absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity duration-200",
                topupAnimated ? "opacity-100" : "opacity-0",
              ].join(" ")}
              onClick={() => !topupLoading && setTopupOpen(false)}
            />

            <div
              className={[
                "relative w-full max-w-md rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] p-5",
                "shadow-[0_25px_80px_rgba(0,0,0,.25)] transition-all duration-200",
                topupAnimated
                  ? "translate-y-0 scale-100 opacity-100"
                  : "translate-y-2 scale-95 opacity-0",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                    Creator wallet
                  </div>

                  <h2 className="mt-1 text-[18px] font-black text-slate-900">
                    Top up wallet
                  </h2>

                  <p className="mt-1 text-[10px] font-medium text-slate-400">
                    Add funds in {displayCurrency === "USD" ? "USD" : "Kenyan shillings"}.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={topupLoading}
                  onClick={() => setTopupOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-[#D9D3C7] bg-white text-slate-600 disabled:opacity-40"
                >
                  ×
                </button>
              </div>

              <label className="mt-4 block">
                <span className="text-[10px] font-black text-slate-600">
                  Amount ({displayCurrency === "USD" ? "USD" : "KSh"})
                </span>

                <div className="mt-1.5 flex h-12 items-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-3">
                  <span className="text-[10px] font-black text-slate-400">
                    {displayCurrency === "USD" ? "USD" : "KSh"}
                  </span>

                  <input
                    type="number"
                    min={displayCurrency === "USD" ? 1 : 100}
                    step={displayCurrency === "USD" ? 1 : 50}
                    value={topupAmount}
                    onChange={(event) => {
                      setTopupAmount(event.target.value);
                      if (topupError) setTopupError(null);
                    }}
                    className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-slate-800 outline-none"
                    placeholder={displayCurrency === "USD" ? "10" : "1000"}
                  />
                </div>
              </label>

              {topupError ? (
                <div className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-[10px] font-semibold text-rose-700">
                  {topupError}
                </div>
              ) : null}

              <p className="mt-2 text-[9px] font-medium leading-4 text-slate-400">
                You’ll continue to secure Paystack checkout. The wallet updates automatically after successful payment.
              </p>

              <button
                type="button"
                onClick={handleConfirmTopup}
                disabled={topupLoading}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#c69258] px-4 text-[11px] font-black text-white transition hover:bg-[#E98C12] disabled:opacity-60"
              >
                {topupLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                    Starting top-up…
                  </>
                ) : (
                  "Continue to payment"
                )}
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* WITHDRAW MODAL */}
      {withdrawOpen &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
            <div
              className={[
                "absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity duration-200",
                withdrawAnimated ? "opacity-100" : "opacity-0",
              ].join(" ")}
              onClick={() => !withdrawSubmitting && setWithdrawOpen(false)}
            />

            <div
              className={[
                "relative w-full max-w-md rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] p-5",
                "shadow-[0_25px_80px_rgba(0,0,0,.25)] transition-all duration-200",
                withdrawAnimated
                  ? "translate-y-0 scale-100 opacity-100"
                  : "translate-y-2 scale-95 opacity-0",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#c69258]">
                    Withdrawal request
                  </div>

                  <h2 className="mt-1 text-[18px] font-black text-slate-900">
                    Choose withdrawal amount
                  </h2>

                  <p className="mt-1 text-[10px] font-medium text-slate-400">
                    Available {fmtMoneyMajor(pendingBalanceDisplayMajor, displayCurrency)}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={withdrawSubmitting}
                  onClick={() => setWithdrawOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-[#D9D3C7] bg-white text-slate-600 disabled:opacity-40"
                >
                  ×
                </button>
              </div>

              <label className="mt-4 block">
                <span className="text-[10px] font-black text-slate-600">
                  Amount ({displayCurrency === "USD" ? "USD" : "KSh"})
                </span>

                <div className="mt-1.5 flex h-12 items-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-3">
                  <span className="text-[10px] font-black text-slate-400">
                    {displayCurrency === "USD" ? "USD" : "KSh"}
                  </span>

                  <input
                    type="number"
                    min={displayCurrency === "USD" ? 0.01 : 1}
                    step={displayCurrency === "USD" ? 0.01 : 1}
                    value={withdrawAmount}
                    onChange={(event) => {
                      setWithdrawAmount(event.target.value);
                      if (withdrawError) setWithdrawError(null);
                    }}
                    className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-slate-800 outline-none"
                    disabled={withdrawSubmitting}
                  />
                </div>
              </label>

              <div className="mt-2 flex flex-wrap gap-2">
                {[25, 50, 75].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    disabled={withdrawSubmitting}
                    onClick={() => {
                      const value =
                        (pendingBalanceDisplayMajor * pct) / 100;

                      setWithdrawAmount(
                        value.toFixed(displayCurrency === "KES" ? 0 : 2)
                      );

                      setWithdrawError(null);
                    }}
                    className="h-8 rounded-lg border border-[#D9D3C7] bg-white px-3 text-[9px] font-black text-slate-600 transition hover:bg-[#F3F1EB] disabled:opacity-50"
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
                  className="h-8 rounded-lg bg-[#173C2E] px-3 text-[9px] font-black text-white disabled:opacity-50"
                >
                  Max
                </button>
              </div>

              {withdrawError ? (
                <div className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-[10px] font-semibold text-rose-700">
                  {withdrawError}
                </div>
              ) : null}

              <div className="mt-3 rounded-xl border border-[#DDD8CC] bg-[#F3F1EB] px-3 py-2.5">
                <p className="text-[9px] font-medium leading-4 text-slate-500">
                  Wallet balances are stored in USD. KSh requests use the current rate of {usdToKesRate} KES per USD.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRequestWithdraw}
                disabled={withdrawSubmitting}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173C2E] px-4 text-[11px] font-black text-white transition hover:bg-[#214C3A] disabled:opacity-60"
              >
                {withdrawSubmitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                    Submitting…
                  </>
                ) : (
                  "Submit withdrawal request"
                )}
              </button>

              <p className="mt-2 text-center text-[9px] font-medium leading-4 text-slate-400">
                Requests are reviewed before payout and use your saved settlement method.
              </p>
            </div>
          </div>,
          document.body
        )}

      <ConfirmModal
        open={!!feedbackModal}
        title={feedbackModal?.title || ""}
        message={feedbackModal?.message || ""}
        confirmText="OK"
        cancelText="Close"
        onConfirm={() => setFeedbackModal(null)}
        onCancel={() => setFeedbackModal(null)}
      />
    </div>
  );

  return isMobile ? (
    <div className="fixed inset-0">
      {MainBodyMobile}
    </div>
  ) : (
    <AppShell>
      {MainBody}
    </AppShell>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.025)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
            {label}
          </div>

          <div className="mt-1 text-[21px] font-black tracking-[-0.035em] text-[#173C2E]">
            {value}
          </div>
        </div>

        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E8ECE8] text-[#173C2E]">
          {icon}
        </span>
      </div>

      <p className="mt-2 text-[9px] font-medium leading-4 text-slate-400">
        {hint}
      </p>
    </motion.div>
  );
}

function SplitRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-[#F3F1EB] px-3 py-2.5">
      <span className="text-[9px] font-semibold text-slate-400">
        {label}
      </span>

      <span
        className={[
          "text-[10px] font-black",
          strong ? "text-[#173C2E]" : "text-slate-700",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyHistory({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="grid min-h-[220px] place-items-center text-center">
      <div>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#E8ECE8] text-[#173C2E]">
          {icon}
        </div>

        <div className="mt-3 text-[12px] font-black text-slate-700">
          {title}
        </div>

        <p className="mx-auto mt-1 max-w-sm text-[10px] font-medium leading-4 text-slate-400">
          {text}
        </p>
      </div>
    </div>
  );
}