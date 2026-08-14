"use client";

import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { getApp } from "firebase/app";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
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
  IoChevronDownOutline,
  IoCloseOutline,
  IoGlobeOutline,
  IoInformationCircleOutline,
  IoLocationOutline,
  IoMapOutline,
  IoNavigateOutline,
  IoLogoWhatsapp,
  IoOpenOutline,
  IoPauseOutline,
  IoSaveOutline,
  IoSearchOutline,
  IoShieldCheckmarkOutline,
  IoVideocamOutline,
} from "react-icons/io5";

import AppShell from "@/app/components/AppShell";
import GlobalLocationPicker from "@/app/components/location/GlobalLocationPicker";
import { useAuth } from "@/app/hooks/useAuth";
import { db } from "@/lib/firebase";

import {
  CONSULTATION_METHODS,
  DEFAULT_EXPERT_PROFILE,
  EXPERT_LANGUAGES,
} from "@/app/constants/expertConstants";

import {
  ConsultationMethod,
  ExpertCurrency,
  ExpertFeeType,
  ExpertPlace,
  ExpertProfile,
  ExpertServiceArea,
} from "@/app/types/expert";

const EKARI = {
  forest: "#173C2E",
  forestSoft: "#214C3A",
  gold: "#c69258",
  canvas: "#F8F7F2",
  paper: "#FBFAF6",
  text: "#111827",
  subtext: "#64748B",
  hair: "#DDD8CC",
  soft: "#F3F1EB",
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
  profileLocation: ExpertPlace;
  preferredCurrency: ExpertCurrency;
  timezone: string;
};
type ExpertSpecialtyGroup = {
  id: string;
  title: string;
  items: string[];
  order: number;
  active: boolean;
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
  const rawPrimaryLocation = value?.primaryLocation as any;

  const hasStructuredLocation =
    typeof rawPrimaryLocation?.label === "string" ||
    typeof rawPrimaryLocation?.country === "string" ||
    !!rawPrimaryLocation?.coordinates;

  const legacyCounty = String(
    rawPrimaryLocation?.county || ""
  ).trim();
  const legacyTown = String(
    rawPrimaryLocation?.town || ""
  ).trim();
  const legacyLatitude = safeNumber(
    rawPrimaryLocation?.latitude
  );
  const legacyLongitude = safeNumber(
    rawPrimaryLocation?.longitude
  );

  const migratedPrimaryLocation: ExpertPlace =
    hasStructuredLocation
      ? {
        ...defaults.primaryLocation,
        ...rawPrimaryLocation,
        placeId: rawPrimaryLocation?.placeId || null,
        label: String(rawPrimaryLocation?.label || "").trim(),
        countryCode: String(
          rawPrimaryLocation?.countryCode || ""
        ).toUpperCase(),
        country: String(rawPrimaryLocation?.country || "").trim(),
        region: String(rawPrimaryLocation?.region || "").trim(),
        city: String(rawPrimaryLocation?.city || "").trim(),
        locality: String(rawPrimaryLocation?.locality || "").trim(),
        coordinates: rawPrimaryLocation?.coordinates || null,
        timezone: rawPrimaryLocation?.timezone || null,
      }
      : legacyCounty ||
        legacyTown ||
        legacyLatitude !== null ||
        legacyLongitude !== null
        ? {
          placeId: null,
          label: [legacyTown, legacyCounty, "Kenya"]
            .filter(Boolean)
            .join(", "),
          countryCode: "KE",
          country: "Kenya",
          region: legacyCounty,
          city: legacyTown,
          locality: "",
          coordinates:
            legacyLatitude !== null && legacyLongitude !== null
              ? {
                latitude: legacyLatitude,
                longitude: legacyLongitude,
                geohash: rawPrimaryLocation?.geohash || null,
              }
              : null,
          timezone: "Africa/Nairobi",
        }
        : userSummary.profileLocation;

  const legacyCounties = normalizeStringArray(
    value?.countiesServed
  );

  const migratedServiceAreas: ExpertServiceArea[] =
    legacyCounties.map((county, index) => ({
      id: `legacy-county-${index}`,
      type: "region",
      label: `${county}, Kenya`,
      placeId: null,
      countryCode: "KE",
      country: "Kenya",
      region: county,
      city: "",
      center: null,
      radiusKm: null,
    }));

  const existingServiceAreas = Array.isArray(
    value?.serviceCoverage?.serviceAreas
  )
    ? value.serviceCoverage.serviceAreas
    : [];

  return {
    ...defaults,
    ...value,
    uid,
    status: value?.status || "draft",
    isDiscoverable: value?.isDiscoverable === true,
    acceptingBookings: value?.acceptingBookings !== false,
    headline: value?.headline || "",
    expertBio: value?.expertBio || "",
    specialties: normalizeStringArray(value?.specialties),
    countiesServed: legacyCounties,
    languages:
      normalizeStringArray(value?.languages).length > 0
        ? normalizeStringArray(value?.languages)
        : defaults.languages,
    consultationMethods:
      Array.isArray(value?.consultationMethods) &&
        value.consultationMethods.length > 0
        ? value.consultationMethods
        : defaults.consultationMethods,
    primaryLocation: migratedPrimaryLocation,
    serviceCoverage: {
      ...defaults.serviceCoverage,
      ...(value?.serviceCoverage || {}),
      serviceAreas:
        existingServiceAreas.length > 0
          ? existingServiceAreas
          : migratedServiceAreas,
    },
    pricing: {
      ...defaults.pricing,
      ...(value?.pricing || {}),
      currency:
        value?.pricing?.currency === "KES" ||
          value?.pricing?.currency === "USD"
          ? value.pricing.currency
          : userSummary.preferredCurrency,
      consultationFee:
        safeNumber(value?.pricing?.consultationFee) ?? 0,
      physicalVisitFeeFrom: safeNumber(
        value?.pricing?.physicalVisitFeeFrom
      ),
    },
    terms: {
      ...defaults.terms,
      ...(value?.terms || {}),
    },
    availability: {
      ...defaults.availability,
      ...(value?.availability || {}),
      timezone:
        value?.availability?.timezone ||
        migratedPrimaryLocation.timezone ||
        userSummary.timezone ||
        "UTC",
    },
    rating: {
      average: safeNumber(value?.rating?.average) ?? 0,
      count: safeNumber(value?.rating?.count) ?? 0,
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
  groups,
  value,
  onChange,
  max,
  prominentOptions = [],
}: {
  label: string;
  helper?: string;
  options?: readonly string[];

  groups?: Array<{
    id: string;
    title: string;
    items: string[];
  }>;

  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
  prominentOptions?: string[];
}) {
  const [search, setSearch] =
    useState("");

  const [expandedGroups, setExpandedGroups] =
    useState<Set<string>>(
      new Set()
    );

  const selected = useMemo(
    () => new Set(value),
    [value]
  );

  const normalizedSearch =
    search.trim().toLowerCase();

  const toggle = (
    item: string
  ) => {
    if (selected.has(item)) {
      onChange(
        value.filter(
          (current) =>
            current !== item
        )
      );

      return;
    }

    if (
      max &&
      value.length >= max
    ) {
      return;
    }

    onChange([
      ...value,
      item,
    ]);
  };

  const toggleGroup = (
    groupId: string
  ) => {
    setExpandedGroups(
      (current) => {
        const next =
          new Set(current);

        if (
          next.has(groupId)
        ) {
          next.delete(groupId);
        } else {
          next.add(groupId);
        }

        return next;
      }
    );
  };

  const filteredGroups =
    useMemo(() => {
      if (
        !groups ||
        groups.length === 0
      ) {
        return [];
      }

      if (!normalizedSearch) {
        return groups;
      }

      return groups
        .map((group) => ({
          ...group,

          items:
            group.items.filter(
              (item) =>
                item
                  .toLowerCase()
                  .includes(
                    normalizedSearch
                  ) ||
                group.title
                  .toLowerCase()
                  .includes(
                    normalizedSearch
                  )
            ),
        }))
        .filter(
          (group) =>
            group.items.length >
            0
        );
    }, [
      groups,
      normalizedSearch,
    ]);

  const filteredOptions =
    useMemo(() => {
      if (!normalizedSearch) {
        return options || [];
      }

      return (
        options || []
      ).filter((item) =>
        item
          .toLowerCase()
          .includes(
            normalizedSearch
          )
      );
    }, [
      options,
      normalizedSearch,
    ]);

  const visibleProminentOptions =
    useMemo(
      () =>
        prominentOptions
          .filter(
            (item) =>
              !selected.has(item)
          )
          .slice(0, 8),
      [
        prominentOptions,
        selected,
      ]
    );

  const renderOption = (
    item: string
  ) => {
    const active =
      selected.has(item);

    const disabled =
      !active &&
      !!max &&
      value.length >= max;

    return (
      <button
        key={item}
        type="button"
        disabled={disabled}
        onClick={() =>
          toggle(item)
        }
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
        {active ? (
          <span className="inline-flex items-center gap-1">
            <IoCheckmark
              size={13}
            />
            {item}
          </span>
        ) : (
          item
        )}
      </button>
    );
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3
            className="text-sm font-black"
            style={{
              color: EKARI.text,
            }}
          >
            {label}
          </h3>

          {helper ? (
            <p
              className="mt-1 text-xs"
              style={{
                color:
                  EKARI.subtext,
              }}
            >
              {helper}
            </p>
          ) : null}
        </div>

        <span
          className="shrink-0 rounded-full border px-3 py-1 text-xs font-bold"
          style={{
            borderColor:
              EKARI.hair,

            color:
              EKARI.subtext,
          }}
        >
          {value.length}
          {max
            ? `/${max}`
            : ""}
        </span>
      </div>

      {value.length > 0 ? (
        <div
          className="mt-4 rounded-2xl border p-3"
          style={{
            borderColor:
              "rgba(199,146,87,0.30)",

            backgroundColor:
              "rgba(199,146,87,0.06)",
          }}
        >
          <div
            className="mb-2 text-[11px] font-black uppercase tracking-[0.12em]"
            style={{
              color:
                EKARI.forest,
            }}
          >
            Selected specialties
          </div>

          <div className="flex flex-wrap gap-2">
            {value.map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() =>
                    toggle(item)
                  }
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-white"
                  style={{
                    backgroundColor:
                      EKARI.forest,
                  }}
                >
                  <IoCheckmark
                    size={14}
                  />

                  {item}

                  <IoCloseOutline
                    size={14}
                  />
                </button>
              )
            )}
          </div>
        </div>
      ) : null}

      <div className="relative mt-4">
        <IoSearchOutline
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
          color={EKARI.subtext}
        />

        <input
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Search specialties or categories"
          className="h-12 w-full rounded-2xl border bg-white pl-11 pr-11 text-sm outline-none focus:ring-2"
          style={{
            borderColor:
              EKARI.hair,
            color: EKARI.text,
          }}
        />

        {search ? (
          <button
            type="button"
            onClick={() =>
              setSearch("")
            }
            className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full hover:bg-slate-100"
            aria-label="Clear search"
          >
            <IoCloseOutline
              size={18}
            />
          </button>
        ) : null}
      </div>

      {!normalizedSearch &&
        visibleProminentOptions.length >
        0 ? (
        <div className="mt-5">
          <div
            className="mb-2 text-xs font-black"
            style={{
              color: EKARI.text,
            }}
          >
            Popular specialties
          </div>

          <div className="flex flex-wrap gap-2">
            {visibleProminentOptions.map(
              renderOption
            )}
          </div>
        </div>
      ) : null}

      {normalizedSearch ? (
        <div className="mt-5">
          <div
            className="mb-3 text-xs font-black"
            style={{
              color: EKARI.text,
            }}
          >
            Search results
          </div>

          {filteredGroups.length >
            0 ? (
            <div className="space-y-5">
              {filteredGroups.map(
                (group) => (
                  <div
                    key={group.id}
                  >
                    <div
                      className="mb-2 text-[11px] font-black uppercase tracking-[0.12em]"
                      style={{
                        color:
                          EKARI.forest,
                      }}
                    >
                      {group.title}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {group.items.map(
                        renderOption
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          ) : filteredOptions.length >
            0 ? (
            <div className="flex flex-wrap gap-2">
              {filteredOptions.map(
                renderOption
              )}
            </div>
          ) : (
            <div
              className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm"
              style={{
                borderColor:
                  EKARI.hair,

                color:
                  EKARI.subtext,
              }}
            >
              No specialty matched
              “{search}”.
            </div>
          )}
        </div>
      ) : groups &&
        groups.length > 0 ? (
        <div className="mt-6">
          <div
            className="mb-3 text-xs font-black"
            style={{
              color: EKARI.text,
            }}
          >
            Browse by category
          </div>

          <div className="space-y-2">
            {groups.map(
              (group) => {
                const expanded =
                  expandedGroups.has(
                    group.id
                  );

                const selectedCount =
                  group.items.filter(
                    (item) =>
                      selected.has(
                        item
                      )
                  ).length;

                return (
                  <div
                    key={group.id}
                    className="overflow-hidden rounded-2xl border"
                    style={{
                      borderColor:
                        EKARI.hair,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        toggleGroup(
                          group.id
                        )
                      }
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          className="block text-sm font-black"
                          style={{
                            color:
                              EKARI.text,
                          }}
                        >
                          {
                            group.title
                          }
                        </span>

                        <span
                          className="mt-0.5 block text-[11px]"
                          style={{
                            color:
                              EKARI.subtext,
                          }}
                        >
                          {
                            group.items
                              .length
                          }{" "}
                          specialties
                        </span>
                      </span>

                      {selectedCount >
                        0 ? (
                        <span
                          className="grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[10px] font-black text-white"
                          style={{
                            backgroundColor:
                              EKARI.forest,
                          }}
                        >
                          {
                            selectedCount
                          }
                        </span>
                      ) : null}

                      <IoChevronDownOutline
                        size={18}
                        color={
                          EKARI.subtext
                        }
                        className={[
                          "transition-transform duration-200",
                          expanded
                            ? "rotate-180"
                            : "",
                        ].join(
                          " "
                        )}
                      />
                    </button>

                    {expanded ? (
                      <div
                        className="border-t px-4 py-4"
                        style={{
                          borderColor:
                            EKARI.hair,

                          backgroundColor:
                            EKARI.soft,
                        }}
                      >
                        <div className="flex flex-wrap gap-2">
                          {group.items.map(
                            renderOption
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              }
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex max-h-56 flex-wrap gap-2 overflow-y-auto">
          {(options || []).map(
            renderOption
          )}
        </div>
      )}
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

      const latitude =
        safeNumber(userData.latitude) ??
        safeNumber(location.latitude) ??
        safeNumber(location.lat);

      const longitude =
        safeNumber(userData.longitude) ??
        safeNumber(location.longitude) ??
        safeNumber(location.lng) ??
        safeNumber(location.lon);

      const city = String(
        userData.town ||
        userData.city ||
        location.town ||
        location.city ||
        ""
      ).trim();

      const region = String(
        userData.county ||
        location.county ||
        location.region ||
        location.state ||
        ""
      ).trim();

      const country = String(
        userData.country ||
        location.country ||
        ""
      ).trim();

      const profileLocation: ExpertPlace = {
        placeId:
          String(
            location.placeId ||
            location.place_id ||
            ""
          ) || null,
        label: String(
          location.formattedAddress ||
          location.address ||
          location.label ||
          location.name ||
          [city, region, country]
            .filter(Boolean)
            .join(", ")
        ).trim(),
        countryCode: String(
          userData.countryCode ||
          location.countryCode ||
          ""
        ).toUpperCase(),
        country,
        region,
        city,
        locality: String(
          location.locality ||
          location.subLocality ||
          ""
        ).trim(),
        coordinates:
          latitude !== null && longitude !== null
            ? {
              latitude,
              longitude,
              geohash: location.geohash || null,
            }
            : null,
        timezone: String(
          userData.timezone ||
          location.timezone ||
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          "UTC"
        ),
      };

      const preferredCurrency: ExpertCurrency =
        String(
          userData.preferredCurrency ||
          "USD"
        ).toUpperCase() === "KES"
          ? "KES"
          : "USD";

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
        profileLocation,
        preferredCurrency,
        timezone: profileLocation.timezone || "UTC",
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

  const [
    specialtyGroups,
    setSpecialtyGroups,
  ] = useState<ExpertSpecialtyGroup[]>([]);

  const [
    specialtiesLoading,
    setSpecialtiesLoading,
  ] = useState(true);

  const [
    specialtiesError,
    setSpecialtiesError,
  ] = useState<string | null>(null);
  useEffect(() => {
    const specialtiesQuery = query(
      collection(
        db,
        "expert_specialty_groups"
      ),
      orderBy("order", "asc")
    );

    setSpecialtiesLoading(true);
    setSpecialtiesError(null);

    const unsubscribe = onSnapshot(
      specialtiesQuery,
      (snapshot) => {
        const rows: ExpertSpecialtyGroup[] =
          snapshot.docs.map(
            (documentSnapshot) => {
              const data =
                documentSnapshot.data();

              return {
                id: documentSnapshot.id,

                title: String(
                  data.title || ""
                ).trim(),

                items:
                  normalizeStringArray(
                    data.items
                  ),

                order:
                  safeNumber(
                    data.order
                  ) ?? 0,

                active:
                  data.active !== false,
              };
            }
          );

        setSpecialtyGroups(rows);
        setSpecialtiesLoading(false);
        setSpecialtiesError(null);
      },
      (error) => {
        console.error(
          "LOAD_EXPERT_SPECIALTIES_FAILED",
          error
        );

        setSpecialtyGroups([]);
        setSpecialtiesLoading(false);

        setSpecialtiesError(
          "Could not load the latest specialties. Default specialties are being shown."
        );
      }
    );

    return unsubscribe;
  }, []);


  const isVerified =
    userSummary?.verificationStatus === "approved";
  const isVerificationPending =
    userSummary?.verificationStatus ===
    "pending" ||
    userSummary?.verificationStatus ===
    "payment_pending";

  const databaseSpecialties = useMemo(() => {
    const values = specialtyGroups
      .filter(
        (group) =>
          group.active &&
          group.title.length > 0
      )
      .flatMap(
        (group) => group.items
      )
      .map(
        (specialty) =>
          specialty.trim()
      )
      .filter(Boolean);

    return Array.from(
      new Map(
        values.map((specialty) => [
          specialty.toLowerCase(),
          specialty,
        ])
      ).values()
    );
  }, [specialtyGroups]);

  const activeSpecialtyGroups =
    useMemo(
      () =>
        specialtyGroups
          .filter(
            (group) =>
              group.active &&
              group.items.length >
              0
          )
          .map((group) => ({
            id: group.id,
            title: group.title,
            items: group.items,
          })),
      [specialtyGroups]
    );
  const availableSpecialties =
    useMemo(() => {
      /*
       * Use Firestore values when available.
       * Retain currently saved specialties even when an
       * admin has renamed or disabled an option.
       */
      const baseOptions =
        databaseSpecialties;

      const selectedSpecialties =
        expertProfile?.specialties || [];

      return Array.from(
        new Map(
          [
            ...selectedSpecialties,
            ...baseOptions,
          ].map((specialty) => [
            specialty
              .trim()
              .toLowerCase(),

            specialty.trim(),
          ])
        ).values()
      ).filter(Boolean);
    }, [
      databaseSpecialties,
      expertProfile?.specialties,
    ]);


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

    if (!expertProfile.primaryLocation.label.trim()) {
      return "Please select your primary location.";
    }

    if (
      !expertProfile.serviceCoverage.offersOnlineServices &&
      !expertProfile.serviceCoverage.offersPhysicalVisits
    ) {
      return "Select online consultations, physical visits, or both.";
    }

    if (
      expertProfile.serviceCoverage.offersPhysicalVisits &&
      expertProfile.serviceCoverage.serviceAreas.length === 0
    ) {
      return "Add at least one physical service area.";
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

    const maximumConsultationFee =
      expertProfile.pricing.currency === "KES"
        ? 100000
        : 1000;

    if (
      expertProfile.pricing.consultationFee >
      maximumConsultationFee
    ) {
      return `Consultation fee cannot exceed ${expertProfile.pricing.currency} ${maximumConsultationFee.toLocaleString()}.`;
    }

    if (!expertProfile.terms.summary.trim()) {
      return "Please provide your consultation terms.";
    }

    return null;
  };

  const buildEditablePayload = useCallback(() => {
    if (!expertProfile) {
      throw new Error("Expert profile is unavailable.");
    }

    return {
      acceptingBookings: expertProfile.acceptingBookings,
      headline: expertProfile.headline.trim(),
      expertBio: expertProfile.expertBio.trim(),
      specialties: expertProfile.specialties,
      languages: expertProfile.languages,
      consultationMethods: expertProfile.consultationMethods,
      primaryLocation: {
        ...expertProfile.primaryLocation,
        placeId: expertProfile.primaryLocation.placeId || null,
        label: expertProfile.primaryLocation.label.trim(),
        countryCode: expertProfile.primaryLocation.countryCode
          .trim()
          .toUpperCase(),
        country: expertProfile.primaryLocation.country.trim(),
        region: expertProfile.primaryLocation.region.trim(),
        city: expertProfile.primaryLocation.city.trim(),
        locality: expertProfile.primaryLocation.locality.trim(),
        timezone:
          expertProfile.primaryLocation.timezone ||
          expertProfile.availability.timezone ||
          userSummary?.timezone ||
          "UTC",
      },
      serviceCoverage: {
        ...expertProfile.serviceCoverage,
        serviceAreas:
          expertProfile.serviceCoverage.serviceAreas,
      },
      // Temporary legacy mirror for older clients.
      countiesServed:
        expertProfile.serviceCoverage.serviceAreas
          .filter(
            (area) =>
              area.countryCode === "KE" &&
              area.region
          )
          .map((area) => area.region),
      pricing: {
        currency: expertProfile.pricing.currency,
        consultationFee:
          expertProfile.pricing.feeType === "free"
            ? 0
            : Number(expertProfile.pricing.consultationFee),
        physicalVisitFeeFrom:
          expertProfile.serviceCoverage.offersPhysicalVisits
            ? expertProfile.pricing.physicalVisitFeeFrom
            : null,
        feeType: expertProfile.pricing.feeType,
        consultationDurationMinutes: Number(
          expertProfile.pricing.consultationDurationMinutes
        ),
      },
      terms: {
        summary: expertProfile.terms.summary.trim(),
        cancellationNoticeHours: Number(
          expertProfile.terms.cancellationNoticeHours
        ),
        cancellationPolicy:
          expertProfile.terms.cancellationPolicy.trim(),
        allowsRescheduling:
          expertProfile.terms.allowsRescheduling,
        paymentRequiredBeforeBooking:
          expertProfile.terms.paymentRequiredBeforeBooking,
      },
      availability: {
        timezone:
          expertProfile.availability.timezone ||
          expertProfile.primaryLocation.timezone ||
          userSummary?.timezone ||
          "UTC",
        scheduleConfigured:
          expertProfile.availability.scheduleConfigured,
      },
      updatedAt: serverTimestamp(),
    };
  }, [expertProfile, userSummary?.timezone]);

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

      const editablePayload = buildEditablePayload();

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
          "Firebase denied permission to save this expert profile. Confirm that the expertProfiles rules allow authenticated users to create and update their own profile."
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

      await updateDoc(
        expertReference,
        buildEditablePayload()
      );

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

  const readiness = useMemo(() => {
    if (!expertProfile) {
      return {
        completed: 0,
        total: 9,
        percentage: 0,
        items: [] as Array<{
          label: string;
          complete: boolean;
        }>,
      };
    }

    const items = [
      {
        label: "Professional headline",
        complete:
          expertProfile.headline.trim().length >= 10,
      },
      {
        label: "Expert biography",
        complete:
          expertProfile.expertBio.trim().length >= 40,
      },
      {
        label: "Specialties",
        complete:
          expertProfile.specialties.length > 0,
      },
      {
        label: "Primary location",
        complete:
          expertProfile.primaryLocation.label.trim().length > 0,
      },
      {
        label: "Service mode",
        complete:
          expertProfile.serviceCoverage.offersOnlineServices ||
          expertProfile.serviceCoverage.offersPhysicalVisits,
      },
      {
        label: "Service coverage",
        complete:
          !expertProfile.serviceCoverage.offersPhysicalVisits ||
          expertProfile.serviceCoverage.serviceAreas.length > 0,
      },
      {
        label: "Languages",
        complete:
          expertProfile.languages.length > 0,
      },
      {
        label: "Consultation methods",
        complete:
          expertProfile.consultationMethods.length > 0,
      },
      {
        label: "Consultation terms",
        complete:
          expertProfile.terms.summary.trim().length > 0,
      },
    ];

    const completed =
      items.filter((item) => item.complete).length;

    return {
      completed,
      total: items.length,
      percentage: Math.round(
        (completed / items.length) * 100
      ),
      items,
    };
  }, [expertProfile]);

  const profileIsPublic =
    expertProfile?.status === "active" &&
    expertProfile?.isDiscoverable === true;

  const pageContent = (
    <div className="h-full min-h-0 overflow-y-auto bg-[#F8F7F2]">
      <motion.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className="relative overflow-hidden bg-[#173C2E] text-white"
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
              onClick={() => router.back()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[0.06] text-white transition hover:bg-white/[0.11] active:scale-95"
              aria-label="Go back"
            >
              <IoArrowBack size={19} />
            </button>

            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#c69258]">
                ekari Expert
              </div>

              <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-[24px] font-black tracking-[-0.035em] md:text-[28px]">
                      Expert services
                    </h1>

                    {isVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-black text-emerald-200">
                        <IoShieldCheckmarkOutline size={12} />
                        Verified
                      </span>
                    ) : isVerificationPending ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-[9px] font-black text-amber-200">
                        <IoInformationCircleOutline size={12} />
                        Verification pending
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-black text-white/65">
                        <IoInformationCircleOutline size={12} />
                        Unverified
                      </span>
                    )}
                  </div>

                  <p className="mt-1 max-w-2xl text-[11px] font-medium leading-5 text-white/50 md:text-[12px]">
                    Configure how clients discover, contact and book your professional agricultural services.
                  </p>
                </div>

                {expertProfile ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span
                      className={[
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5",
                        "text-[10px] font-black",
                        profileIsPublic
                          ? "bg-emerald-400/15 text-emerald-200"
                          : expertProfile.status === "suspended"
                            ? "bg-rose-400/15 text-rose-200"
                            : "bg-amber-400/15 text-amber-200",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "h-2 w-2 rounded-full",
                          profileIsPublic
                            ? "bg-emerald-300"
                            : expertProfile.status === "suspended"
                              ? "bg-rose-300"
                              : "bg-amber-300",
                        ].join(" ")}
                      />

                      {profileIsPublic
                        ? "Public"
                        : expertProfile.status === "paused"
                          ? "Paused"
                          : expertProfile.status === "suspended"
                            ? "Suspended"
                            : "Draft"}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="mx-auto max-w-[1180px] px-4 py-4 md:px-6 md:py-5">

        <div className="grid gap-5 xl:grid-cols-[minmax(0,820px)_300px] xl:items-start">
          <div className="min-w-0">
            {loading ? (
              <div
                className="rounded-3xl border bg-white p-8"

              >
                <div className="animate-pulse space-y-4">
                  <div className="h-6 w-52 rounded bg-slate-200" />
                  <div className="h-4 w-full rounded bg-slate-100" />
                  <div className="h-28 w-full rounded-2xl bg-slate-100" />
                </div>
              </div>
            ) : null}

            <AnimatePresence mode="popLayout">
              {!loading && errorMessage ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mb-4 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-700"
                >
                  {errorMessage}
                </motion.div>
              ) : null}

              {!loading && successMessage ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mb-4 rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] font-semibold text-emerald-700"
                >
                  {successMessage}
                </motion.div>
              ) : null}
            </AnimatePresence>

            {!loading && userSummary && !isVerified ? (
              <div className="mb-4 rounded-[18px] border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
                    <IoInformationCircleOutline
                      size={24}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="font-black text-amber-900">
                      {isVerificationPending
                        ? "Verification pending"
                        : "Unverified expert profile"}
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-amber-800">
                      {isVerificationPending
                        ? "You can create, publish and manage your expert profile while your verification request is being reviewed."
                        : "You can create and publish your expert profile without verification. Your public profile will display an Unverified expert badge until verification is approved."}
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
                      className="mt-3 rounded-xl bg-amber-700 px-4 py-2.5 text-[11px] font-black text-white transition hover:bg-amber-800"
                    >
                      {isVerificationPending
                        ? "View verification status"
                        : "Get verified"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {!loading &&
              userSummary &&

              expertProfile ? (
              <form
                onSubmit={handleSave}
                className="space-y-4"
              >
                <section
                  className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.025)] md:p-5"

                >
                  <div className="flex items-start gap-3">
                    <div
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
                      style={{
                        backgroundColor:
                          "rgba(23,60,46,0.08)",
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
                      className="mt-2 w-full rounded-xl border border-[#D9D3C7] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#173C2E]/45 focus:ring-2 focus:ring-[#173C2E]/5"
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
                      className="mt-2 w-full resize-none rounded-xl border border-[#D9D3C7] bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#173C2E]/45 focus:ring-2 focus:ring-[#173C2E]/5"
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
                  className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.025)] md:p-5"

                >
                  {specialtiesLoading ? (
                    <div className="space-y-4">
                      <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />

                      <div className="h-4 w-72 max-w-full animate-pulse rounded bg-slate-100" />

                      <div className="flex flex-wrap gap-2">
                        {Array.from({
                          length: 10,
                        }).map((_, index) => (
                          <div
                            key={index}
                            className="h-9 w-32 animate-pulse rounded-full bg-slate-100"
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {specialtiesError ? (
                        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                          {specialtiesError}
                        </div>
                      ) : null}

                      <MultiSelectChips
                        label="Specialties"
                        helper="Select up to eight professional services that clients can book you for."
                        groups={
                          activeSpecialtyGroups
                        }
                        options={
                          availableSpecialties
                        }
                        value={
                          expertProfile.specialties
                        }
                        max={8}
                        onChange={(specialties) =>
                          updateProfile(
                            "specialties",
                            specialties
                          )
                        }
                      />

                      {databaseSpecialties.length >
                        0 ? (
                        <div
                          className="mt-4 text-xs"
                          style={{
                            color: EKARI.subtext,
                          }}
                        >
                          Showing{" "}
                          <strong>
                            {
                              databaseSpecialties.length
                            }
                          </strong>{" "}
                          specialties managed by ekarihub.
                        </div>
                      ) : null}
                    </>
                  )}
                </section>

                <section
                  className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.025)] md:p-5"

                >
                  <div className="mb-5 flex items-start gap-3">
                    <div
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
                      style={{
                        backgroundColor: "rgba(23,60,46,0.08)",
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
                        style={{ color: EKARI.subtext }}
                      >
                        Select your primary location and define where you offer online consultations or physical visits.
                      </p>
                    </div>
                  </div>

                  <GlobalLocationPicker
                    value={expertProfile.primaryLocation}
                    profileLocation={userSummary.profileLocation}
                    onChange={(primaryLocation) => {
                      updateProfile("primaryLocation", primaryLocation);
                      updateProfile("availability", {
                        ...expertProfile.availability,
                        timezone:
                          primaryLocation.timezone ||
                          expertProfile.availability.timezone ||
                          userSummary.timezone ||
                          "UTC",
                      });
                    }}
                  />

                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        const enabled =
                          !expertProfile.serviceCoverage.offersOnlineServices;

                        updateProfile("serviceCoverage", {
                          ...expertProfile.serviceCoverage,
                          offersOnlineServices: enabled,
                        });
                      }}
                      className="flex items-start gap-3 rounded-2xl border p-4 text-left transition"
                      style={{
                        borderColor:
                          expertProfile.serviceCoverage.offersOnlineServices
                            ? EKARI.forest
                            : EKARI.hair,
                        backgroundColor:
                          expertProfile.serviceCoverage.offersOnlineServices
                            ? "rgba(23,60,46,0.06)"
                            : "#FFFFFF",
                      }}
                    >
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                        style={{
                          backgroundColor:
                            expertProfile.serviceCoverage.offersOnlineServices
                              ? EKARI.forest
                              : "#F3F4F6",
                          color:
                            expertProfile.serviceCoverage.offersOnlineServices
                              ? "#FFFFFF"
                              : EKARI.text,
                        }}
                      >
                        <IoVideocamOutline size={20} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black">
                          Online consultations
                        </span>
                        <span
                          className="mt-1 block text-xs leading-5"
                          style={{ color: EKARI.subtext }}
                        >
                          Serve clients through phone, WhatsApp or video.
                        </span>
                      </span>

                      {expertProfile.serviceCoverage.offersOnlineServices ? (
                        <IoCheckmark size={20} color={EKARI.forest} />
                      ) : null}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const enabled =
                          !expertProfile.serviceCoverage.offersPhysicalVisits;

                        let serviceAreas =
                          expertProfile.serviceCoverage.serviceAreas;

                        if (
                          enabled &&
                          serviceAreas.length === 0 &&
                          expertProfile.primaryLocation.coordinates
                        ) {
                          serviceAreas = [
                            {
                              id: "primary-radius",
                              type: "radius",
                              label: `Within 25 km of ${expertProfile.primaryLocation.label ||
                                expertProfile.primaryLocation.city ||
                                "primary location"
                                }`,
                              placeId:
                                expertProfile.primaryLocation.placeId,
                              countryCode:
                                expertProfile.primaryLocation.countryCode,
                              country:
                                expertProfile.primaryLocation.country,
                              region:
                                expertProfile.primaryLocation.region,
                              city: expertProfile.primaryLocation.city,
                              center:
                                expertProfile.primaryLocation.coordinates,
                              radiusKm: 25,
                            },
                          ];
                        }

                        updateProfile("serviceCoverage", {
                          ...expertProfile.serviceCoverage,
                          offersPhysicalVisits: enabled,
                          serviceAreas,
                        });
                      }}
                      className="flex items-start gap-3 rounded-2xl border p-4 text-left transition"
                      style={{
                        borderColor:
                          expertProfile.serviceCoverage.offersPhysicalVisits
                            ? EKARI.forest
                            : EKARI.hair,
                        backgroundColor:
                          expertProfile.serviceCoverage.offersPhysicalVisits
                            ? "rgba(23,60,46,0.06)"
                            : "#FFFFFF",
                      }}
                    >
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                        style={{
                          backgroundColor:
                            expertProfile.serviceCoverage.offersPhysicalVisits
                              ? EKARI.forest
                              : "#F3F4F6",
                          color:
                            expertProfile.serviceCoverage.offersPhysicalVisits
                              ? "#FFFFFF"
                              : EKARI.text,
                        }}
                      >
                        <IoMapOutline size={20} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black">
                          Physical farm visits
                        </span>
                        <span
                          className="mt-1 block text-xs leading-5"
                          style={{ color: EKARI.subtext }}
                        >
                          Travel to farms, businesses or client locations.
                        </span>
                      </span>

                      {expertProfile.serviceCoverage.offersPhysicalVisits ? (
                        <IoCheckmark size={20} color={EKARI.forest} />
                      ) : null}
                    </button>
                  </div>

                  {expertProfile.serviceCoverage.offersOnlineServices ? (
                    <div className="mt-5">
                      <label className="text-sm font-black">
                        Online consultation coverage
                      </label>

                      <select
                        value={expertProfile.serviceCoverage.onlineCoverage}
                        onChange={(event) =>
                          updateProfile("serviceCoverage", {
                            ...expertProfile.serviceCoverage,
                            onlineCoverage: event.target.value as
                              | "local"
                              | "country"
                              | "worldwide",
                          })
                        }
                        className="mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none"

                      >
                        <option value="local">
                          Near my primary location
                        </option>
                        <option value="country">
                          Anywhere in my country
                        </option>
                        <option value="worldwide">
                          Worldwide
                        </option>
                      </select>
                    </div>
                  ) : null}

                  {expertProfile.serviceCoverage.offersPhysicalVisits ? (
                    <div
                      className="mt-5 rounded-2xl border p-4"
                      style={{
                        borderColor: EKARI.hair,
                        backgroundColor: EKARI.soft,
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <IoNavigateOutline
                          size={20}
                          color={EKARI.forest}
                        />

                        <div className="min-w-0 flex-1">
                          <label className="text-sm font-black">
                            Physical visit radius
                          </label>
                          <p
                            className="mt-1 text-xs"
                            style={{ color: EKARI.subtext }}
                          >
                            Choose how far you can normally travel from your primary location.
                          </p>

                          <select
                            value={
                              expertProfile.serviceCoverage.serviceAreas.find(
                                (area) => area.id === "primary-radius"
                              )?.radiusKm || 25
                            }
                            onChange={(event) => {
                              const radiusKm = Number(event.target.value);
                              const place = expertProfile.primaryLocation;

                              const radiusArea: ExpertServiceArea = {
                                id: "primary-radius",
                                type: "radius",
                                label: `Within ${radiusKm} km of ${place.label ||
                                  place.city ||
                                  "primary location"
                                  }`,
                                placeId: place.placeId,
                                countryCode: place.countryCode,
                                country: place.country,
                                region: place.region,
                                city: place.city,
                                center: place.coordinates,
                                radiusKm,
                              };

                              const otherAreas =
                                expertProfile.serviceCoverage.serviceAreas.filter(
                                  (area) => area.id !== "primary-radius"
                                );

                              updateProfile("serviceCoverage", {
                                ...expertProfile.serviceCoverage,
                                serviceAreas: [radiusArea, ...otherAreas],
                              });
                            }}
                            className="mt-3 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none"

                          >
                            {[10, 25, 50, 100, 200].map((radius) => (
                              <option key={radius} value={radius}>
                                Within {radius} km
                              </option>
                            ))}
                          </select>

                          {!expertProfile.primaryLocation.coordinates ? (
                            <p className="mt-2 text-xs font-semibold text-amber-700">
                              Select a GPS, searched or map location to enable accurate radius matching.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </section>

                <section
                  className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.025)] md:p-5"

                >
                  <div className="flex items-start gap-3">
                    <div
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
                      style={{
                        backgroundColor:
                          "rgba(23,60,46,0.08)",
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
                                ? "rgba(23,60,46,0.06)"
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
                  className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.025)] md:p-5"

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

                  <div className="mt-5">
                    <label className="text-sm font-black">
                      Consultation currency
                    </label>

                    <div className="mt-2 inline-flex rounded-2xl border bg-white p-1" >
                      {(["KES", "USD"] as ExpertCurrency[]).map((currency) => {
                        const active = expertProfile.pricing.currency === currency;

                        return (
                          <button
                            key={currency}
                            type="button"
                            onClick={() =>
                              updateProfile("pricing", {
                                ...expertProfile.pricing,
                                currency,
                              })
                            }
                            className="rounded-xl px-5 py-2.5 text-xs font-black transition"
                            style={{
                              backgroundColor: active ? EKARI.forest : "transparent",
                              color: active ? "#FFFFFF" : EKARI.text,
                            }}
                          >
                            {currency}
                          </button>
                        );
                      })}
                    </div>
                  </div>

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
                            {expertProfile.pricing.currency}
                          </span>

                          <input
                            type="number"
                            min={0}
                            max={expertProfile.pricing.currency === "KES" ? 100000 : 1000}
                            step={expertProfile.pricing.currency === "KES" ? 50 : 1}
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
                            {expertProfile.pricing.currency}
                          </span>

                          <input
                            type="number"
                            min={0}
                            step={expertProfile.pricing.currency === "KES" ? 100 : 1}
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
                  className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.025)] md:p-5"

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
                      className="mt-2 w-full resize-none rounded-xl border border-[#D9D3C7] bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#173C2E]/45 focus:ring-2 focus:ring-[#173C2E]/5"
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
                        className="mt-1 h-5 w-5 cursor-pointer rounded border-slate-300 accent-[#173C2E]"
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
                        className="mt-1 h-5 w-5 cursor-pointer rounded border-slate-300 accent-[#173C2E]"
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
                  className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.025)] md:p-5"

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
                      className="mt-1 h-5 w-5 cursor-pointer rounded border-slate-300 accent-[#173C2E]"
                    />


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

                  </label>
                </section>

                <div
                  className="sticky bottom-3 z-30 rounded-[18px] border border-[#D9D3C7] bg-[#FBFAF6]/95 p-3 shadow-[0_16px_38px_rgba(15,23,42,0.12)] backdrop-blur-xl"

                >
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="submit"
                      disabled={saving || publishing || unpublishing}
                      className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#173C2E] bg-white px-5 text-[11px] font-black text-[#173C2E] transition hover:bg-[#EEF3EE] disabled:cursor-not-allowed disabled:opacity-60"
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
                        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-700 px-5 text-[11px] font-black text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
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
                        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#173C2E] px-5 text-[11px] font-black text-white transition hover:-translate-y-0.5 hover:bg-[#214C3A] disabled:cursor-not-allowed disabled:opacity-60"

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
                      className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-4 text-[10px] font-black text-[#173C2E] transition hover:bg-[#EEF3EE]"
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

          <motion.aside
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.24, delay: 0.04, ease: "easeOut" }}
            className="hidden space-y-3 xl:sticky xl:top-4 xl:block"
          >
            <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
                    Expert profile
                  </div>

                  <div className="mt-1 text-[14px] font-black text-slate-900">
                    {profileIsPublic
                      ? "Public and discoverable"
                      : expertProfile?.status === "suspended"
                        ? "Profile suspended"
                        : expertProfile?.status === "paused"
                          ? "Profile paused"
                          : "Private draft"}
                  </div>
                </div>

                <span
                  className={[
                    "mt-1 h-2.5 w-2.5 rounded-full",
                    profileIsPublic
                      ? "bg-emerald-500"
                      : expertProfile?.status === "suspended"
                        ? "bg-rose-500"
                        : "bg-amber-500",
                  ].join(" ")}
                />
              </div>

              {expertProfile ? (
                <div className="mt-4 space-y-2.5 text-[11px]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-400">
                      Accepting bookings
                    </span>
                    <span className="font-black text-slate-700">
                      {expertProfile.acceptingBookings ? "Yes" : "No"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-400">
                      Discoverable
                    </span>
                    <span className="font-black text-slate-700">
                      {expertProfile.isDiscoverable ? "Yes" : "No"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-400">
                      Status
                    </span>
                    <span className="font-black capitalize text-slate-700">
                      {expertProfile.status}
                    </span>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
                    Profile readiness
                  </div>

                  <div className="mt-1 text-[24px] font-black tracking-[-0.04em] text-[#173C2E]">
                    {readiness.percentage}%
                  </div>
                </div>

                <div className="grid h-11 w-11 place-items-center rounded-full bg-[#E8ECE8] text-[#173C2E]">
                  <IoCheckmark size={18} />
                </div>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EAE6DD]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${readiness.percentage}%` }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className="h-full rounded-full bg-[#173C2E]"
                />
              </div>

              <p className="mt-2 text-[10px] font-semibold text-slate-400">
                {readiness.completed} of {readiness.total} required areas complete
              </p>

              <div className="mt-3 space-y-1.5">
                {readiness.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-2 text-[10px]"
                  >
                    <span
                      className={[
                        "grid h-4 w-4 shrink-0 place-items-center rounded-full",
                        item.complete
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-400",
                      ].join(" ")}
                    >
                      {item.complete ? (
                        <IoCheckmark size={10} />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      )}
                    </span>

                    <span
                      className={[
                        "font-semibold",
                        item.complete
                          ? "text-slate-600"
                          : "text-slate-400",
                      ].join(" ")}
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
              <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
                Verification
              </div>

              <div className="mt-3 flex items-start gap-3">
                <span
                  className={[
                    "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                    isVerified
                      ? "bg-emerald-100 text-emerald-700"
                      : isVerificationPending
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-500",
                  ].join(" ")}
                >
                  {isVerified ? (
                    <IoShieldCheckmarkOutline size={17} />
                  ) : (
                    <IoInformationCircleOutline size={17} />
                  )}
                </span>

                <div className="min-w-0">
                  <div className="text-[12px] font-black text-slate-800">
                    {isVerified
                      ? "Verified expert"
                      : isVerificationPending
                        ? "Verification pending"
                        : "Unverified expert"}
                  </div>

                  <div className="mt-0.5 text-[10px] font-medium leading-4 text-slate-400">
                    {userSummary?.organizationName ||
                      userSummary?.verificationRole ||
                      userSummary?.verificationType ||
                      "Professional account"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push("/account/verification")}
                className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-xl border border-[#D9D3C7] bg-white px-3 text-[10px] font-black text-[#173C2E] transition hover:bg-[#EEF3EE]"
              >
                {isVerificationPending
                  ? "View verification status"
                  : isVerified
                    ? "Manage verification"
                    : "Get verified"}
              </button>
            </section>

            <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
              <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
                Quick links
              </div>

              <div className="mt-2 space-y-1">
                <button
                  type="button"
                  onClick={() => router.push("/ekari-experts")}
                  className="flex h-9 w-full items-center justify-between rounded-xl px-2.5 text-left text-[10px] font-black text-slate-600 transition hover:bg-[#EEF3EE] hover:text-[#173C2E]"
                >
                  View ekariExperts
                  <IoOpenOutline size={13} />
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/account/expert/bookings")}
                  className="flex h-9 w-full items-center justify-between rounded-xl px-2.5 text-left text-[10px] font-black text-slate-600 transition hover:bg-[#EEF3EE] hover:text-[#173C2E]"
                >
                  Expert bookings
                  <IoOpenOutline size={13} />
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/account/bookings")}
                  className="flex h-9 w-full items-center justify-between rounded-xl px-2.5 text-left text-[10px] font-black text-slate-600 transition hover:bg-[#EEF3EE] hover:text-[#173C2E]"
                >
                  My bookings
                  <IoOpenOutline size={13} />
                </button>
              </div>
            </section>
          </motion.aside>
        </div>
      </div>
    </div>
  );

  return (
    <AppShell>
      {pageContent}
    </AppShell>
  );
}