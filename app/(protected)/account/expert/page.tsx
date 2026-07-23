"use client";

import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { getApp } from "firebase/app";

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import {
  getFunctions,
  httpsCallable,
} from "firebase/functions";

import {
  IoArrowBack,
  IoBriefcaseOutline,
  IoCallOutline,
  IoCheckmark,
  IoCloseOutline,
  IoGlobeOutline,
  IoInformationCircleOutline,
  IoLocationOutline,
  IoLogoWhatsapp,
  IoOpenOutline,
  IoPauseOutline,
  IoSaveOutline,
  IoShieldCheckmarkOutline,
  IoVideocamOutline,
} from "react-icons/io5";

import AppShell from "@/app/components/AppShell";
import { useAuth } from "@/app/hooks/useAuth";
import { db } from "@/lib/firebase";

import {
  CONSULTATION_METHODS,
  DEFAULT_EXPERT_PROFILE,
  EXPERT_LANGUAGES,
  EXPERT_SPECIALTIES,
  KENYA_COUNTIES,
} from "@/app/constants/expertConstants";

import {
  ConsultationMethod,
  ExpertFeeType,
  ExpertProfile,
} from "@/app/types/expert";

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  text: "#111827",
  subtext: "#6B7280",
  hair: "#E5E7EB",
  soft: "#F8FAFC",
  success: "#15803D",
  danger: "#B42318",
};

const functions = getFunctions(
  getApp(),
  "africa-south1"
);
type VerificationStatus =
  | "none"
  | "payment_pending"
  | "pending"
  | "approved"
  | "rejected";

type UserSummary = {
  uid: string;
  name: string;
  handle: string;
  phone: string;
  photoURL: string;
  verificationStatus: VerificationStatus;
  verificationRole: string;
  verificationType: "individual" | "business" | "company";
  organizationName: string;
  county: string;
  town: string;
  latitude: number | null;
  longitude: number | null;
};

function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function normalizeExpertProfile(
  uid: string,
  value: Partial<ExpertProfile> | undefined,
  userSummary: UserSummary
): ExpertProfile {
  const defaults = DEFAULT_EXPERT_PROFILE(uid);

  return {
    ...defaults,
    ...value,

    uid,

    status: value?.status || "draft",

    // Public publishing will be handled by a secure backend
    // function in the next implementation step.
    isDiscoverable: value?.isDiscoverable === true,

    acceptingBookings:
      value?.acceptingBookings !== false,

    headline: value?.headline || "",
    expertBio: value?.expertBio || "",

    specialties: normalizeStringArray(value?.specialties),
    countiesServed:
      normalizeStringArray(value?.countiesServed).length > 0
        ? normalizeStringArray(value?.countiesServed)
        : userSummary.county
          ? [userSummary.county]
          : [],

    languages:
      normalizeStringArray(value?.languages).length > 0
        ? normalizeStringArray(value?.languages)
        : defaults.languages,

    consultationMethods:
      Array.isArray(value?.consultationMethods) &&
        value.consultationMethods.length > 0
        ? value.consultationMethods
        : defaults.consultationMethods,

    primaryLocation: {
      county:
        value?.primaryLocation?.county ||
        userSummary.county ||
        "",
      town:
        value?.primaryLocation?.town ||
        userSummary.town ||
        "",
      latitude:
        safeNumber(value?.primaryLocation?.latitude) ??
        userSummary.latitude,
      longitude:
        safeNumber(value?.primaryLocation?.longitude) ??
        userSummary.longitude,
      geohash:
        value?.primaryLocation?.geohash || null,
    },

    pricing: {
      ...defaults.pricing,
      ...(value?.pricing || {}),
      consultationFee:
        safeNumber(value?.pricing?.consultationFee) ?? 0,
      physicalVisitFeeFrom:
        safeNumber(value?.pricing?.physicalVisitFeeFrom),
    },

    terms: {
      ...defaults.terms,
      ...(value?.terms || {}),
    },

    availability: {
      ...defaults.availability,
      ...(value?.availability || {}),
    },

    rating: {
      average:
        safeNumber(value?.rating?.average) ?? 0,
      count:
        safeNumber(value?.rating?.count) ?? 0,
    },

    completedConsultations:
      safeNumber(value?.completedConsultations) ?? 0,

    createdAt: value?.createdAt || null,
    updatedAt: value?.updatedAt || null,
    publishedAt: value?.publishedAt || null,
    suspendedAt: value?.suspendedAt || null,
    suspendedReason: value?.suspendedReason || null,
  };
}

function MultiSelectChips({
  label,
  helper,
  options,
  value,
  onChange,
  max,
}: {
  label: string;
  helper?: string;
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
}) {
  const selected = useMemo(
    () => new Set(value),
    [value]
  );

  const toggle = (item: string) => {
    if (selected.has(item)) {
      onChange(value.filter((current) => current !== item));
      return;
    }

    if (max && value.length >= max) {
      return;
    }

    onChange([...value, item]);
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3
            className="text-sm font-black"
            style={{ color: EKARI.text }}
          >
            {label}
          </h3>

          {helper ? (
            <p
              className="mt-1 text-xs"
              style={{ color: EKARI.subtext }}
            >
              {helper}
            </p>
          ) : null}
        </div>

        <span
          className="shrink-0 rounded-full border px-3 py-1 text-xs font-bold"
          style={{
            borderColor: EKARI.hair,
            color: EKARI.subtext,
          }}
        >
          {value.length}
          {max ? `/${max}` : ""}
        </span>
      </div>

      {value.length > 0 ? (
        <div
          className="mt-3 flex flex-wrap gap-2 rounded-2xl border p-3"
          style={{
            borderColor: "rgba(199,146,87,0.3)",
            backgroundColor: "rgba(199,146,87,0.06)",
          }}
        >
          {value.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => toggle(item)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-white"
              style={{ backgroundColor: EKARI.forest }}
            >
              <IoCheckmark size={14} />
              {item}
              <IoCloseOutline size={14} />
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex max-h-56 flex-wrap gap-2 overflow-y-auto">
        {options.map((item) => {
          const active = selected.has(item);
          const disabled =
            !active && !!max && value.length >= max;

          return (
            <button
              key={item}
              type="button"
              disabled={disabled}
              onClick={() => toggle(item)}
              className="rounded-full border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                borderColor: active
                  ? EKARI.forest
                  : EKARI.hair,
                backgroundColor: active
                  ? EKARI.forest
                  : "#FFFFFF",
                color: active
                  ? "#FFFFFF"
                  : EKARI.text,
              }}
            >
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MethodIcon({
  method,
}: {
  method: ConsultationMethod;
}) {
  if (method === "whatsapp") {
    return <IoLogoWhatsapp size={20} />;
  }

  if (method === "video") {
    return <IoVideocamOutline size={20} />;
  }

  if (method === "physical") {
    return <IoLocationOutline size={20} />;
  }

  return <IoCallOutline size={20} />;
}

export default function ExpertSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);

  const [userSummary, setUserSummary] =
    useState<UserSummary | null>(null);

  const [expertProfile, setExpertProfile] =
    useState<ExpertProfile | null>(null);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.uid) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const [userSnapshot, expertSnapshot] =
        await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "expertProfiles", user.uid)),
        ]);

      if (!userSnapshot.exists()) {
        throw new Error(
          "Your user profile could not be found."
        );
      }

      const userData = userSnapshot.data() as any;
      const verification = userData.verification || {};

      const firstName =
        String(userData.firstName || "").trim();

      const surname =
        String(userData.surname || "").trim();

      const name =
        String(
          userData.name ||
          `${firstName} ${surname}`
        ).trim();

      const location =
        userData.location ||
        userData.primaryLocation ||
        userData.profileLocation ||
        {};

      const summary: UserSummary = {
        uid: user.uid,
        name,
        handle: String(userData.handle || ""),
        phone: String(userData.phone || ""),
        photoURL: String(
          userData.photoURL ||
          userData.avatarUrl ||
          ""
        ),
        verificationStatus:
          verification.status || "none",
        verificationRole: String(
          verification.roleLabel ||
          verification.primaryRole ||
          userData.primaryRoleLabel ||
          ""
        ),
        verificationType:
          verification.verificationType ||
          "individual",
        organizationName: String(
          verification.organizationName || ""
        ),
        county: String(
          userData.county ||
          location.county ||
          ""
        ),
        town: String(
          userData.town ||
          userData.city ||
          location.town ||
          location.city ||
          location.name ||
          ""
        ),
        latitude:
          safeNumber(userData.latitude) ??
          safeNumber(location.latitude) ??
          safeNumber(location.lat),
        longitude:
          safeNumber(userData.longitude) ??
          safeNumber(location.longitude) ??
          safeNumber(location.lng) ??
          safeNumber(location.lon),
      };

      setUserSummary(summary);

      const savedProfile = expertSnapshot.exists()
        ? (expertSnapshot.data() as Partial<ExpertProfile>)
        : undefined;

      setExpertProfile(
        normalizeExpertProfile(
          user.uid,
          savedProfile,
          summary
        )
      );
    } catch (error: any) {
      console.error("Failed to load expert settings:", error);

      setErrorMessage(
        error?.message ||
        "We could not load your expert settings."
      );
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (user === undefined) return;

    if (!user) {
      const next = "/account/expert";

      router.replace(
        `/login?next=${encodeURIComponent(next)}`
      );

      return;
    }

    loadData();
  }, [user, router, loadData]);

  const isVerified =
    userSummary?.verificationStatus === "approved";

  const updateProfile = <
    K extends keyof ExpertProfile,
  >(
    field: K,
    value: ExpertProfile[K]
  ) => {
    setExpertProfile((previous) => {
      if (!previous) return previous;

      return {
        ...previous,
        [field]: value,
      };
    });
  };

  const toggleMethod = (
    method: ConsultationMethod
  ) => {
    if (!expertProfile) return;

    const active =
      expertProfile.consultationMethods.includes(
        method
      );

    const methods = active
      ? expertProfile.consultationMethods.filter(
        (current) => current !== method
      )
      : [
        ...expertProfile.consultationMethods,
        method,
      ];

    updateProfile("consultationMethods", methods);
  };

  const validateProfile = (): string | null => {
    if (!expertProfile) {
      return "Expert profile is unavailable.";
    }

    if (!expertProfile.headline.trim()) {
      return "Please add a professional headline.";
    }

    if (expertProfile.headline.trim().length < 10) {
      return "Your professional headline should contain at least 10 characters.";
    }

    if (!expertProfile.expertBio.trim()) {
      return "Please add a description of your professional experience.";
    }

    if (expertProfile.expertBio.trim().length < 40) {
      return "Your expert biography should contain at least 40 characters.";
    }

    if (expertProfile.specialties.length === 0) {
      return "Please select at least one specialty.";
    }

    if (expertProfile.countiesServed.length === 0) {
      return "Please select at least one county that you serve.";
    }

    if (!expertProfile.primaryLocation.county) {
      return "Please select your primary county.";
    }

    if (expertProfile.languages.length === 0) {
      return "Please select at least one language.";
    }

    if (
      expertProfile.consultationMethods.length === 0
    ) {
      return "Please select at least one consultation method.";
    }

    if (
      expertProfile.pricing.feeType !== "free" &&
      expertProfile.pricing.consultationFee < 0
    ) {
      return "Consultation fee cannot be negative.";
    }

    if (
      expertProfile.pricing.consultationFee >
      100000
    ) {
      return "Consultation fee cannot exceed KES 100,000.";
    }

    if (!expertProfile.terms.summary.trim()) {
      return "Please provide your consultation terms.";
    }

    return null;
  };

  const handleSave = async (
    event: FormEvent
  ) => {
    event.preventDefault();

    setErrorMessage(null);
    setSuccessMessage(null);

    if (!user?.uid || !expertProfile) {
      setErrorMessage(
        "You must be logged in to save expert settings."
      );

      return;
    }

    if (!isVerified) {
      setErrorMessage(
        "Your account must be verified before you can create an expert profile."
      );

      return;
    }

    const validationError = validateProfile();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    try {
      setSaving(true);

      const expertReference = doc(
        db,
        "expertProfiles",
        user.uid
      );

      const existingSnapshot =
        await getDoc(expertReference);

      const editablePayload = {
        acceptingBookings:
          expertProfile.acceptingBookings,

        headline:
          expertProfile.headline.trim(),

        expertBio:
          expertProfile.expertBio.trim(),

        specialties:
          expertProfile.specialties,

        countiesServed:
          expertProfile.countiesServed,

        languages:
          expertProfile.languages,

        consultationMethods:
          expertProfile.consultationMethods,

        primaryLocation: {
          county:
            expertProfile.primaryLocation.county,

          town:
            expertProfile.primaryLocation.town.trim(),

          latitude:
            expertProfile.primaryLocation.latitude,

          longitude:
            expertProfile.primaryLocation.longitude,

          geohash:
            expertProfile.primaryLocation.geohash ||
            null,
        },

        pricing: {
          currency: "KES",

          consultationFee:
            expertProfile.pricing.feeType === "free"
              ? 0
              : Number(
                expertProfile.pricing
                  .consultationFee
              ),

          physicalVisitFeeFrom:
            expertProfile.consultationMethods.includes(
              "physical"
            )
              ? expertProfile.pricing
                .physicalVisitFeeFrom
              : null,

          feeType:
            expertProfile.pricing.feeType,

          consultationDurationMinutes:
            Number(
              expertProfile.pricing
                .consultationDurationMinutes
            ),
        },

        terms: {
          summary:
            expertProfile.terms.summary.trim(),

          cancellationNoticeHours:
            Number(
              expertProfile.terms
                .cancellationNoticeHours
            ),

          cancellationPolicy:
            expertProfile.terms
              .cancellationPolicy.trim(),

          allowsRescheduling:
            expertProfile.terms
              .allowsRescheduling,

          paymentRequiredBeforeBooking:
            expertProfile.terms
              .paymentRequiredBeforeBooking,
        },

        availability: {
          timezone: "Africa/Nairobi",

          scheduleConfigured:
            expertProfile.availability
              .scheduleConfigured,
        },

        updatedAt: serverTimestamp(),
      };

      if (existingSnapshot.exists()) {
        await updateDoc(
          expertReference,
          editablePayload
        );
      } else {
        await setDoc(expertReference, {
          uid: user.uid,

          status: "draft",
          isDiscoverable: false,

          ...editablePayload,

          rating: {
            average: 0,
            count: 0,
          },

          completedConsultations: 0,

          createdAt: serverTimestamp(),

          publishedAt: null,
          suspendedAt: null,
          suspendedReason: null,
        });
      }

      const savedStatus = existingSnapshot.exists()
        ? String(
          existingSnapshot.data()?.status || "draft"
        )
        : "draft";

      const savedIsDiscoverable =
        existingSnapshot.exists() &&
        existingSnapshot.data()?.isDiscoverable === true;

      setExpertProfile((previous: any) => {
        if (!previous) return previous;

        return {
          ...previous,

          status: savedStatus as ExpertProfile["status"],

          isDiscoverable: savedIsDiscoverable,

          updatedAt: new Date(),
        };
      });

      setSuccessMessage(
        savedStatus === "active" &&
          savedIsDiscoverable
          ? "Your expert service settings have been saved and the public listing will update automatically."
          : "Your expert service settings have been saved."
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

    } catch (error: any) {
      console.error(
        "Failed to save expert profile:",
        {
          code: error?.code,
          message: error?.message,
          error,
        }
      );

      if (
        error?.code === "permission-denied" ||
        error?.code === "firestore/permission-denied"
      ) {
        setErrorMessage(
          "Firebase denied permission to save this expert profile. Confirm that the expertProfiles rules are deployed and that your verification status is approved."
        );
      } else {
        setErrorMessage(
          error?.message ||
          "We could not save your expert settings."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const saveLatestExpertFields =
    async (): Promise<void> => {
      if (!user?.uid || !expertProfile) {
        throw new Error(
          "Your expert profile could not be loaded."
        );
      }

      const expertReference = doc(
        db,
        "expertProfiles",
        user.uid
      );

      const expertSnapshot =
        await getDoc(expertReference);

      if (!expertSnapshot.exists()) {
        throw new Error(
          "Save your expert profile before publishing it."
        );
      }

      await updateDoc(expertReference, {
        headline:
          expertProfile.headline.trim(),

        expertBio:
          expertProfile.expertBio.trim(),

        specialties:
          expertProfile.specialties,

        countiesServed:
          expertProfile.countiesServed,

        languages:
          expertProfile.languages,

        consultationMethods:
          expertProfile.consultationMethods,

        acceptingBookings:
          expertProfile.acceptingBookings,

        primaryLocation: {
          county:
            expertProfile.primaryLocation.county,

          town:
            expertProfile.primaryLocation.town.trim(),

          latitude:
            expertProfile.primaryLocation.latitude,

          longitude:
            expertProfile.primaryLocation.longitude,

          geohash:
            expertProfile.primaryLocation.geohash ||
            null,
        },

        pricing: {
          currency: "KES",

          consultationFee:
            expertProfile.pricing.feeType === "free"
              ? 0
              : Number(
                expertProfile.pricing
                  .consultationFee
              ),

          physicalVisitFeeFrom:
            expertProfile.consultationMethods.includes(
              "physical"
            )
              ? expertProfile.pricing
                .physicalVisitFeeFrom
              : null,

          feeType:
            expertProfile.pricing.feeType,

          consultationDurationMinutes:
            Number(
              expertProfile.pricing
                .consultationDurationMinutes
            ),
        },

        terms: {
          summary:
            expertProfile.terms.summary.trim(),

          cancellationNoticeHours:
            Number(
              expertProfile.terms
                .cancellationNoticeHours
            ),

          cancellationPolicy:
            expertProfile.terms
              .cancellationPolicy.trim(),

          allowsRescheduling:
            expertProfile.terms
              .allowsRescheduling,

          paymentRequiredBeforeBooking:
            expertProfile.terms
              .paymentRequiredBeforeBooking,
        },

        availability: {
          timezone: "Africa/Nairobi",

          scheduleConfigured:
            expertProfile.availability
              .scheduleConfigured,
        },

        updatedAt: serverTimestamp(),
      });

    };

  const handlePublish = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!user?.uid || !expertProfile) {
      setErrorMessage(
        "You must be logged in and have an expert profile before publishing."
      );
      return;
    }

    if (!isVerified) {
      setErrorMessage(
        "Your account must be verified before publishing an expert profile."
      );
      return;
    }

    const validationError = validateProfile();

    if (validationError) {
      setErrorMessage(
        `${validationError} Save or correct your details before publishing.`
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    try {
      setPublishing(true);

      // Save the current form values before the backend publishes them.
      await saveLatestExpertFields();

      const publishExpertProfile = httpsCallable<
        Record<string, never>,
        {
          success: boolean;
          status: string;
          isDiscoverable: boolean;
          message: string;
        }
      >(functions, "publishExpertProfile");

      const result = await publishExpertProfile({});

      setSuccessMessage(
        result.data.message || "Your expert profile is now public."
      );

      await loadData();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error: any) {
      console.error("Failed to publish expert profile:", error);

      const detailedErrors = error?.details?.errors;
      const message =
        (Array.isArray(detailedErrors) && detailedErrors[0]) ||
        error?.message ||
        "We could not publish your expert profile.";

      setErrorMessage(message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!user?.uid) {
      setErrorMessage("You must be logged in to pause your profile.");
      return;
    }

    try {
      setUnpublishing(true);

      const unpublishExpertProfile = httpsCallable<
        Record<string, never>,
        {
          success: boolean;
          status: string;
          isDiscoverable: boolean;
          message: string;
        }
      >(functions, "unpublishExpertProfile");

      const result = await unpublishExpertProfile({});

      setSuccessMessage(
        result.data.message || "Your expert profile has been paused."
      );

      await loadData();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error: any) {
      console.error("Failed to pause expert profile:", error);

      setErrorMessage(
        error?.message || "We could not pause your expert profile."
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setUnpublishing(false);
    }
  };

  const pageContent = (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
      <div className="mb-6 flex items-start gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border bg-white"
          style={{
            borderColor: EKARI.hair,
            color: EKARI.text,
          }}
          aria-label="Go back"
        >
          <IoArrowBack size={20} />
        </button>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1
              className="text-2xl font-black md:text-3xl"
              style={{ color: EKARI.text }}
            >
              Expert services
            </h1>

            {isVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                <IoShieldCheckmarkOutline size={14} />
                Verified
              </span>
            ) : null}
          </div>

          <p
            className="mt-2 max-w-2xl text-sm leading-6"
            style={{ color: EKARI.subtext }}
          >
            Configure the agricultural services,
            locations, consultation methods and fees
            that will appear on your ekariExpert
            profile.
          </p>
        </div>
      </div>

      {loading ? (
        <div
          className="rounded-3xl border bg-white p-8"
          style={{ borderColor: EKARI.hair }}
        >
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-52 rounded bg-slate-200" />
            <div className="h-4 w-full rounded bg-slate-100" />
            <div className="h-28 w-full rounded-2xl bg-slate-100" />
          </div>
        </div>
      ) : null}

      {!loading && errorMessage ? (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {!loading && successMessage ? (
        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {!loading && userSummary && !isVerified ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 md:p-7">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700">
              <IoInformationCircleOutline
                size={24}
              />
            </div>

            <div>
              <h2 className="font-black text-amber-900">
                Verification required
              </h2>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                Only approved verified professionals,
                businesses and companies can configure
                ekariExpert services.
              </p>

              <p className="mt-2 text-xs font-semibold text-amber-800">
                Current status:{" "}
                {userSummary.verificationStatus}
              </p>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/account/verification"
                  )
                }
                className="mt-4 rounded-full bg-amber-700 px-5 py-2.5 text-sm font-bold text-white"
              >
                Go to verification
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!loading &&
        userSummary &&
        isVerified &&
        expertProfile ? (
        <form
          onSubmit={handleSave}
          className="space-y-6"
        >
          <section
            className="rounded-3xl border bg-white p-5 shadow-sm md:p-7"
            style={{ borderColor: EKARI.hair }}
          >
            <div className="flex items-start gap-3">
              <div
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
                style={{
                  backgroundColor:
                    "rgba(35,63,57,0.08)",
                  color: EKARI.forest,
                }}
              >
                <IoBriefcaseOutline size={22} />
              </div>

              <div>
                <h2
                  className="text-lg font-black"
                  style={{ color: EKARI.text }}
                >
                  Professional introduction
                </h2>

                <p
                  className="mt-1 text-sm"
                  style={{
                    color: EKARI.subtext,
                  }}
                >
                  Explain your expertise and the
                  clients you can assist.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <label
                className="text-sm font-black"
                style={{ color: EKARI.text }}
              >
                Professional headline
              </label>

              <input
                value={expertProfile.headline}
                onChange={(event) =>
                  updateProfile(
                    "headline",
                    event.target.value
                  )
                }
                maxLength={120}
                placeholder="Example: Crop disease and soil health specialist"
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2"
                style={{
                  borderColor: EKARI.hair,
                }}
              />

              <div
                className="mt-1 text-right text-xs"
                style={{
                  color: EKARI.subtext,
                }}
              >
                {expertProfile.headline.length}/120
              </div>
            </div>

            <div className="mt-5">
              <label
                className="text-sm font-black"
                style={{ color: EKARI.text }}
              >
                Expert biography
              </label>

              <textarea
                value={expertProfile.expertBio}
                onChange={(event) =>
                  updateProfile(
                    "expertBio",
                    event.target.value
                  )
                }
                maxLength={1200}
                rows={7}
                placeholder="Describe your qualifications, experience and the agricultural problems you help clients solve."
                className="mt-2 w-full resize-none rounded-2xl border px-4 py-3 text-sm leading-6 outline-none focus:ring-2"
                style={{
                  borderColor: EKARI.hair,
                }}
              />

              <div
                className="mt-1 text-right text-xs"
                style={{
                  color: EKARI.subtext,
                }}
              >
                {expertProfile.expertBio.length}
                /1200
              </div>
            </div>
          </section>

          <section
            className="rounded-3xl border bg-white p-5 shadow-sm md:p-7"
            style={{ borderColor: EKARI.hair }}
          >
            <MultiSelectChips
              label="Specialties"
              helper="Select up to eight areas in which you provide professional advice."
              options={EXPERT_SPECIALTIES}
              value={expertProfile.specialties}
              max={8}
              onChange={(specialties) =>
                updateProfile(
                  "specialties",
                  specialties
                )
              }
            />
          </section>

          <section
            className="rounded-3xl border bg-white p-5 shadow-sm md:p-7"
            style={{ borderColor: EKARI.hair }}
          >
            <div className="mb-5 flex items-start gap-3">
              <div
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
                style={{
                  backgroundColor:
                    "rgba(35,63,57,0.08)",
                  color: EKARI.forest,
                }}
              >
                <IoLocationOutline size={22} />
              </div>

              <div>
                <h2
                  className="text-lg font-black"
                  style={{ color: EKARI.text }}
                >
                  Service location
                </h2>

                <p
                  className="mt-1 text-sm"
                  style={{
                    color: EKARI.subtext,
                  }}
                >
                  This information will be used to
                  connect you with nearby clients.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-black">
                  Primary county
                </label>

                <select
                  value={
                    expertProfile.primaryLocation
                      .county
                  }
                  onChange={(event) =>
                    updateProfile(
                      "primaryLocation",
                      {
                        ...expertProfile.primaryLocation,
                        county: event.target.value,
                      }
                    )
                  }
                  className="mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none"
                  style={{
                    borderColor: EKARI.hair,
                  }}
                >
                  <option value="">
                    Select county
                  </option>

                  {KENYA_COUNTIES.map((county) => (
                    <option
                      key={county}
                      value={county}
                    >
                      {county}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-black">
                  Town or area
                </label>

                <input
                  value={
                    expertProfile.primaryLocation
                      .town
                  }
                  onChange={(event) =>
                    updateProfile(
                      "primaryLocation",
                      {
                        ...expertProfile.primaryLocation,
                        town: event.target.value,
                      }
                    )
                  }
                  placeholder="Example: Ol Kalou"
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  style={{
                    borderColor: EKARI.hair,
                  }}
                />
              </div>
            </div>

            <div className="mt-6">
              <MultiSelectChips
                label="Counties served"
                helper="Select all counties where you can provide consultations or physical services."
                options={KENYA_COUNTIES}
                value={
                  expertProfile.countiesServed
                }
                max={15}
                onChange={(countiesServed) =>
                  updateProfile(
                    "countiesServed",
                    countiesServed
                  )
                }
              />
            </div>
          </section>

          <section
            className="rounded-3xl border bg-white p-5 shadow-sm md:p-7"
            style={{ borderColor: EKARI.hair }}
          >
            <div className="flex items-start gap-3">
              <div
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
                style={{
                  backgroundColor:
                    "rgba(35,63,57,0.08)",
                  color: EKARI.forest,
                }}
              >
                <IoGlobeOutline size={22} />
              </div>

              <div>
                <h2
                  className="text-lg font-black"
                  style={{ color: EKARI.text }}
                >
                  Languages and consultation methods
                </h2>

                <p
                  className="mt-1 text-sm"
                  style={{
                    color: EKARI.subtext,
                  }}
                >
                  Choose how clients can communicate
                  with you.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <MultiSelectChips
                label="Languages"
                options={EXPERT_LANGUAGES}
                value={expertProfile.languages}
                max={6}
                onChange={(languages) =>
                  updateProfile(
                    "languages",
                    languages
                  )
                }
              />
            </div>

            <div className="mt-7 grid gap-3 md:grid-cols-2">
              {CONSULTATION_METHODS.map(
                (method) => {
                  const active =
                    expertProfile.consultationMethods.includes(
                      method.value
                    );

                  return (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() =>
                        toggleMethod(method.value)
                      }
                      className="flex items-start gap-3 rounded-2xl border p-4 text-left transition"
                      style={{
                        borderColor: active
                          ? EKARI.forest
                          : EKARI.hair,
                        backgroundColor: active
                          ? "rgba(35,63,57,0.06)"
                          : "#FFFFFF",
                      }}
                    >
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                        style={{
                          backgroundColor: active
                            ? EKARI.forest
                            : "#F3F4F6",
                          color: active
                            ? "#FFFFFF"
                            : EKARI.text,
                        }}
                      >
                        <MethodIcon
                          method={method.value}
                        />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span
                          className="block text-sm font-black"
                          style={{
                            color: EKARI.text,
                          }}
                        >
                          {method.label}
                        </span>

                        <span
                          className="mt-1 block text-xs leading-5"
                          style={{
                            color: EKARI.subtext,
                          }}
                        >
                          {method.description}
                        </span>
                      </span>

                      {active ? (
                        <IoCheckmark
                          size={20}
                          color={EKARI.forest}
                        />
                      ) : null}
                    </button>
                  );
                }
              )}
            </div>
          </section>

          <section
            className="rounded-3xl border bg-white p-5 shadow-sm md:p-7"
            style={{ borderColor: EKARI.hair }}
          >
            <h2
              className="text-lg font-black"
              style={{ color: EKARI.text }}
            >
              Pricing
            </h2>

            <p
              className="mt-1 text-sm"
              style={{ color: EKARI.subtext }}
            >
              Set your standard consultation fee.
              Physical visits may have a separate
              starting fee.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-black">
                  Fee type
                </label>

                <select
                  value={
                    expertProfile.pricing.feeType
                  }
                  onChange={(event) =>
                    updateProfile("pricing", {
                      ...expertProfile.pricing,
                      feeType: event.target
                        .value as ExpertFeeType,
                    })
                  }
                  className="mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-sm"
                  style={{
                    borderColor: EKARI.hair,
                  }}
                >
                  <option value="fixed">
                    Fixed fee
                  </option>
                  <option value="starting_from">
                    Starting from
                  </option>
                  <option value="free">
                    Free consultation
                  </option>
                </select>
              </div>

              <div>
                <label className="text-sm font-black">
                  Consultation duration
                </label>

                <select
                  value={
                    expertProfile.pricing
                      .consultationDurationMinutes
                  }
                  onChange={(event) =>
                    updateProfile("pricing", {
                      ...expertProfile.pricing,
                      consultationDurationMinutes:
                        Number(
                          event.target.value
                        ),
                    })
                  }
                  className="mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-sm"
                  style={{
                    borderColor: EKARI.hair,
                  }}
                >
                  {[15, 30, 45, 60, 90].map(
                    (minutes) => (
                      <option
                        key={minutes}
                        value={minutes}
                      >
                        {minutes} minutes
                      </option>
                    )
                  )}
                </select>
              </div>

              {expertProfile.pricing.feeType !==
                "free" ? (
                <div>
                  <label className="text-sm font-black">
                    Consultation fee
                  </label>

                  <div className="mt-2 flex overflow-hidden rounded-2xl border">
                    <span
                      className="grid place-items-center border-r px-4 text-sm font-black"
                      style={{
                        borderColor: EKARI.hair,
                        backgroundColor:
                          EKARI.soft,
                      }}
                    >
                      KES
                    </span>

                    <input
                      type="number"
                      min={0}
                      max={100000}
                      step={50}
                      value={
                        expertProfile.pricing
                          .consultationFee
                      }
                      onChange={(event) =>
                        updateProfile(
                          "pricing",
                          {
                            ...expertProfile.pricing,
                            consultationFee:
                              Number(
                                event.target
                                  .value || 0
                              ),
                          }
                        )
                      }
                      className="w-full px-4 py-3 text-sm outline-none"
                    />
                  </div>
                </div>
              ) : null}

              {expertProfile.consultationMethods.includes(
                "physical"
              ) ? (
                <div>
                  <label className="text-sm font-black">
                    Physical visit fee from
                  </label>

                  <div className="mt-2 flex overflow-hidden rounded-2xl border">
                    <span
                      className="grid place-items-center border-r px-4 text-sm font-black"
                      style={{
                        borderColor: EKARI.hair,
                        backgroundColor:
                          EKARI.soft,
                      }}
                    >
                      KES
                    </span>

                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={
                        expertProfile.pricing
                          .physicalVisitFeeFrom ??
                        ""
                      }
                      onChange={(event) =>
                        updateProfile(
                          "pricing",
                          {
                            ...expertProfile.pricing,
                            physicalVisitFeeFrom:
                              event.target.value
                                ? Number(
                                  event.target
                                    .value
                                )
                                : null,
                          }
                        )
                      }
                      placeholder="Example: 3000"
                      className="w-full px-4 py-3 text-sm outline-none"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section
            className="rounded-3xl border bg-white p-5 shadow-sm md:p-7"
            style={{ borderColor: EKARI.hair }}
          >
            <h2
              className="text-lg font-black"
              style={{ color: EKARI.text }}
            >
              Consultation terms
            </h2>

            <p
              className="mt-1 text-sm"
              style={{ color: EKARI.subtext }}
            >
              These terms will be visible to clients
              before they contact or book you.
            </p>

            <div className="mt-5">
              <label className="text-sm font-black">
                Service terms
              </label>

              <textarea
                value={expertProfile.terms.summary}
                onChange={(event) =>
                  updateProfile("terms", {
                    ...expertProfile.terms,
                    summary: event.target.value,
                  })
                }
                rows={6}
                maxLength={1000}
                placeholder="Example: The consultation covers one farming issue and lasts up to 45 minutes. Laboratory tests, transport and farm inputs are charged separately."
                className="mt-2 w-full resize-none rounded-2xl border px-4 py-3 text-sm leading-6 outline-none"
                style={{
                  borderColor: EKARI.hair,
                }}
              />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-black">
                  Cancellation notice
                </label>

                <select
                  value={
                    expertProfile.terms
                      .cancellationNoticeHours
                  }
                  onChange={(event) =>
                    updateProfile("terms", {
                      ...expertProfile.terms,
                      cancellationNoticeHours:
                        Number(
                          event.target.value
                        ),
                    })
                  }
                  className="mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-sm"
                  style={{
                    borderColor: EKARI.hair,
                  }}
                >
                  {[1, 2, 4, 6, 12, 24, 48].map(
                    (hours) => (
                      <option
                        key={hours}
                        value={hours}
                      >
                        {hours}{" "}
                        {hours === 1
                          ? "hour"
                          : "hours"}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="text-sm font-black">
                  Cancellation policy
                </label>

                <input
                  value={
                    expertProfile.terms
                      .cancellationPolicy
                  }
                  onChange={(event) =>
                    updateProfile("terms", {
                      ...expertProfile.terms,
                      cancellationPolicy:
                        event.target.value,
                    })
                  }
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm"
                  style={{
                    borderColor: EKARI.hair,
                  }}
                />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4">
                <input
                  type="checkbox"
                  checked={
                    expertProfile.terms
                      .allowsRescheduling
                  }
                  onChange={(event) =>
                    updateProfile("terms", {
                      ...expertProfile.terms,
                      allowsRescheduling:
                        event.target.checked,
                    })
                  }
                  className="mt-1 h-4 w-4"
                />

                <span>
                  <span className="block text-sm font-black">
                    Allow rescheduling
                  </span>
                  <span
                    className="mt-1 block text-xs"
                    style={{
                      color: EKARI.subtext,
                    }}
                  >
                    Clients may request a different
                    consultation date or time.
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4">
                <input
                  type="checkbox"
                  checked={
                    expertProfile.terms
                      .paymentRequiredBeforeBooking
                  }
                  onChange={(event) =>
                    updateProfile("terms", {
                      ...expertProfile.terms,
                      paymentRequiredBeforeBooking:
                        event.target.checked,
                    })
                  }
                  className="mt-1 h-4 w-4"
                />

                <span>
                  <span className="block text-sm font-black">
                    Require payment before confirmation
                  </span>
                  <span
                    className="mt-1 block text-xs"
                    style={{
                      color: EKARI.subtext,
                    }}
                  >
                    This setting will be used when the
                    booking and payment feature is
                    introduced.
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section
            className="rounded-3xl border bg-white p-5 shadow-sm md:p-7"
            style={{ borderColor: EKARI.hair }}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={
                  expertProfile.acceptingBookings
                }
                onChange={(event) =>
                  updateProfile(
                    "acceptingBookings",
                    event.target.checked
                  )
                }
                className="mt-1 h-5 w-5"
              />

              <span>
                <span
                  className="block font-black"
                  style={{ color: EKARI.text }}
                >
                  I am currently accepting clients
                </span>

                <span
                  className="mt-1 block text-sm"
                  style={{
                    color: EKARI.subtext,
                  }}
                >
                  You can pause new requests later
                  without deleting your expert profile.
                </span>
              </span>
            </label>
          </section>

          <div
            className="sticky bottom-3 z-20 rounded-3xl border bg-white/95 p-3 shadow-xl backdrop-blur-xl"
            style={{ borderColor: EKARI.hair }}
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={saving || publishing || unpublishing}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border px-6 py-3.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  borderColor: EKARI.forest,
                  color: EKARI.forest,
                  backgroundColor: "#FFFFFF",
                }}
              >
                <IoSaveOutline size={19} />
                {saving ? "Saving…" : "Save changes"}
              </button>

              {expertProfile.status === "active" &&
                expertProfile.isDiscoverable ? (
                <button
                  type="button"
                  onClick={handleUnpublish}
                  disabled={saving || publishing || unpublishing}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: "#B45309" }}
                >
                  <IoCloseOutline size={20} />
                  {unpublishing
                    ? "Pausing…"
                    : "Pause public profile"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={
                    saving ||
                    publishing ||
                    unpublishing ||
                    expertProfile.status === "suspended"
                  }
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background:
                      "linear-gradient(135deg, #233F39, #C79257)",
                  }}
                >
                  <IoGlobeOutline size={19} />
                  {publishing
                    ? "Publishing…"
                    : expertProfile.status === "paused"
                      ? "Republish profile"
                      : "Publish expert profile"}
                </button>
              )}
            </div>

            <div className="mt-3 flex items-center justify-center gap-2 text-center">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor:
                    expertProfile.status === "active" &&
                      expertProfile.isDiscoverable
                      ? "#16A34A"
                      : expertProfile.status === "suspended"
                        ? "#DC2626"
                        : "#D97706",
                }}
              />

              <p
                className="text-[11px] font-semibold"
                style={{ color: EKARI.subtext }}
              >
                {expertProfile.status === "active" &&
                  expertProfile.isDiscoverable
                  ? "Your expert profile is currently public."
                  : expertProfile.status === "paused"
                    ? "Your expert profile is paused and hidden from search."
                    : expertProfile.status === "suspended"
                      ? "Your expert profile has been suspended."
                      : "Your expert profile is saved privately as a draft."}
              </p>
            </div>

            {expertProfile.status === "active" &&
              expertProfile.isDiscoverable ? (
              <button
                type="button"
                onClick={() => router.push("/ekari-experts")}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black"
                style={{
                  borderColor: EKARI.hair,
                  color: EKARI.forest,
                }}
              >
                <IoOpenOutline size={18} />
                View in ekariExperts
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );

  return <AppShell>{pageContent}</AppShell>;
}