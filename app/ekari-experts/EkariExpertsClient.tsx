"use client";

import {
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    collection,
    doc,
    documentId,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    where,
} from "firebase/firestore";

import {
    usePathname,
    useRouter,
    useSearchParams,
} from "next/navigation";

import {
    IoBriefcaseOutline,
    IoChevronDown,
    IoClose,
    IoFilterOutline,
    IoLocationOutline,
    IoMenu,
    IoPeopleOutline,
    IoRefreshOutline,
    IoSearchOutline,
    IoShieldCheckmarkOutline,
    IoStarOutline,
} from "react-icons/io5";

import AppShell from "@/app/components/AppShell";
import ExpertCard from "@/app/components/experts/ExpertCard";

import { db } from "@/lib/firebase";
import { PublicExpert } from "../types/publicExpert";
import MobileBottomTabs from "../components/navigation/MobileBottomTabs";
import { useAuth } from "../hooks/useAuth";
import { EkariSideMenuSheet } from "../components/EkariSideMenuSheet";
import { useInboxTotalsWeb } from "@/hooks/useInboxTotalsWeb";
import { FALLBACK_EXPERT_SPECIALTIES } from "../constants/expertConstants";

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

type SortOption =
    | "recommended"
    | "rating"
    | "consultations"
    | "price_low"
    | "price_high"
    | "newest";

type ExpertSpecialtyGroup = {
    id: string;
    title: string;
    items: string[];
    order: number;
    active: boolean;
};

function normalizeSearchText(
    value: unknown
): string {
    return String(value || "")
        .trim()
        .toLowerCase();
}

function normalizeArray(
    value: unknown
): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((item) =>
            String(item || "").trim()
        )
        .filter(Boolean);
}
function safeNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function uniqueStrings(values: string[]): string[] {
    return Array.from(
        new Map(
            values
                .map((value) => String(value || "").trim())
                .filter(Boolean)
                .map((value) => [value.toLowerCase(), value])
        ).values()
    );
}

function getExpertLocationValues(expert: PublicExpert): string[] {
    const profile = expert as any;
    const primaryLocation = profile.primaryLocation || {};
    const serviceAreas = Array.isArray(
        profile.serviceCoverage?.serviceAreas
    )
        ? profile.serviceCoverage.serviceAreas
        : [];

    return uniqueStrings([
        primaryLocation.label,
        primaryLocation.locality,
        primaryLocation.city,
        primaryLocation.region,
        primaryLocation.country,

        // Legacy compatibility
        primaryLocation.town,
        primaryLocation.county,

        ...serviceAreas.flatMap((area: any) => [
            area?.label,
            area?.city,
            area?.region,
            area?.country,
        ]),

        ...normalizeArray(profile.countiesServed),
    ]);
}

function useIsDesktop() {
    return useMediaQuery("(min-width: 1024px)");
}
function normalizePublicExpert(
    id: string,
    data: Record<string, any>
): PublicExpert {
    const rawPrimaryLocation = data.primaryLocation || {};

    const legacyLatitude = safeNumber(rawPrimaryLocation.latitude);
    const legacyLongitude = safeNumber(rawPrimaryLocation.longitude);

    const coordinateLatitude =
        safeNumber(rawPrimaryLocation.coordinates?.latitude) ??
        legacyLatitude;

    const coordinateLongitude =
        safeNumber(rawPrimaryLocation.coordinates?.longitude) ??
        legacyLongitude;

    const legacyCounty = String(
        rawPrimaryLocation.county || ""
    ).trim();

    const legacyTown = String(
        rawPrimaryLocation.town || ""
    ).trim();

    const primaryLocation = {
        placeId:
            String(rawPrimaryLocation.placeId || "") || null,

        label: String(
            rawPrimaryLocation.label ||
            [
                rawPrimaryLocation.city || legacyTown,
                rawPrimaryLocation.region || legacyCounty,
                rawPrimaryLocation.country,
            ]
                .filter(Boolean)
                .join(", ")
        ).trim(),

        countryCode: String(
            rawPrimaryLocation.countryCode || ""
        )
            .trim()
            .toUpperCase(),

        country: String(
            rawPrimaryLocation.country || ""
        ).trim(),

        region: String(
            rawPrimaryLocation.region || legacyCounty
        ).trim(),

        city: String(
            rawPrimaryLocation.city || legacyTown
        ).trim(),

        locality: String(
            rawPrimaryLocation.locality || ""
        ).trim(),

        coordinates:
            coordinateLatitude !== null &&
                coordinateLongitude !== null
                ? {
                    latitude: coordinateLatitude,
                    longitude: coordinateLongitude,
                    geohash:
                        rawPrimaryLocation.coordinates?.geohash ||
                        rawPrimaryLocation.geohash ||
                        null,
                }
                : null,

        timezone:
            String(rawPrimaryLocation.timezone || "") || null,
    };

    const rawServiceCoverage = data.serviceCoverage || {};

    const onlineCoverage =
        rawServiceCoverage.onlineCoverage === "local" ||
            rawServiceCoverage.onlineCoverage === "country" ||
            rawServiceCoverage.onlineCoverage === "worldwide"
            ? rawServiceCoverage.onlineCoverage
            : "worldwide";

    const serviceCoverage = {
        offersOnlineServices:
            rawServiceCoverage.offersOnlineServices !== false,

        offersPhysicalVisits:
            rawServiceCoverage.offersPhysicalVisits === true,

        onlineCoverage,

        serviceAreas: Array.isArray(
            rawServiceCoverage.serviceAreas
        )
            ? rawServiceCoverage.serviceAreas
            : [],
    };

    return {
        uid: String(data.uid || id),
        displayName: String(data.displayName || ""),
        firstName: String(data.firstName || ""),
        surname: String(data.surname || ""),
        handle: String(data.handle || ""),
        photoURL: String(data.photoURL || ""),
        headline: String(data.headline || ""),
        expertBio: String(data.expertBio || ""),

        verificationStatus: String(
            data.verificationStatus ||
            (data.verified ? "approved" : "none")
        ),

        verificationRole: String(data.verificationRole || ""),
        verificationType: String(data.verificationType || ""),
        organizationName: String(data.organizationName || ""),

        specialties: normalizeArray(data.specialties),
        countiesServed: normalizeArray(data.countiesServed),
        languages: normalizeArray(data.languages),
        consultationMethods: normalizeArray(
            data.consultationMethods
        ),

        primaryLocation,
        serviceCoverage,

        pricing: {
            currency:
                data.pricing?.currency === "USD" ? "USD" : "KES",

            consultationFee:
                Number(data.pricing?.consultationFee) || 0,

            physicalVisitFeeFrom:
                data.pricing?.physicalVisitFeeFrom === null ||
                    data.pricing?.physicalVisitFeeFrom === undefined
                    ? null
                    : Number(
                        data.pricing.physicalVisitFeeFrom
                    ) || 0,

            feeType: String(data.pricing?.feeType || "fixed"),

            consultationDurationMinutes:
                Number(
                    data.pricing?.consultationDurationMinutes
                ) || 45,
        },

        terms: {
            summary: String(data.terms?.summary || ""),
            cancellationNoticeHours:
                Number(data.terms?.cancellationNoticeHours) || 0,
            cancellationPolicy: String(
                data.terms?.cancellationPolicy || ""
            ),
            allowsRescheduling:
                data.terms?.allowsRescheduling !== false,
            paymentRequiredBeforeBooking:
                data.terms?.paymentRequiredBeforeBooking !== false,
        },

        acceptingBookings: data.acceptingBookings !== false,
        verified: data.verified === true,

        rating: {
            average: Number(data.rating?.average) || 0,
            count: Number(data.rating?.count) || 0,
        },

        completedConsultations:
            Number(data.completedConsultations) || 0,

        publishedAt: data.publishedAt || null,
        updatedAt: data.updatedAt || null,
    } as PublicExpert;
}

async function loadUserRatingStats(
    userIds: string[]
): Promise<Map<string, UserRatingStats>> {
    const ratingMap =
        new Map<string, UserRatingStats>();

    const cleanUserIds = Array.from(
        new Set(
            userIds
                .map((uid) =>
                    String(uid || "").trim()
                )
                .filter(Boolean)
        )
    );

    if (cleanUserIds.length === 0) {
        return ratingMap;
    }

    const userIdChunks = chunkArray(
        cleanUserIds,
        30
    );

    await Promise.all(
        userIdChunks.map(async (ids) => {
            const usersQuery = query(
                collection(db, "users"),
                where(
                    documentId(),
                    "in",
                    ids
                )
            );

            const userSnapshot =
                await getDocs(usersQuery);

            userSnapshot.docs.forEach(
                (userDocument) => {
                    const userData =
                        userDocument.data();

                    const average = Number(
                        userData
                            .sellerReviewStats
                            ?.avgRating
                    );

                    const count = Number(
                        userData
                            .sellerReviewStats
                            ?.reviewsCount
                    );

                    ratingMap.set(
                        userDocument.id,
                        {
                            average:
                                Number.isFinite(
                                    average
                                )
                                    ? Math.max(
                                        0,
                                        Math.min(
                                            5,
                                            average
                                        )
                                    )
                                    : 0,

                            count:
                                Number.isFinite(
                                    count
                                )
                                    ? Math.max(
                                        0,
                                        Math.floor(
                                            count
                                        )
                                    )
                                    : 0,
                        }
                    );
                }
            );
        })
    );

    return ratingMap;
}
function getTimestampMillis(
    value: any
): number {
    if (!value) {
        return 0;
    }

    if (
        typeof value.toMillis ===
        "function"
    ) {
        return value.toMillis();
    }

    if (
        typeof value.seconds ===
        "number"
    ) {
        return value.seconds * 1000;
    }

    return 0;
}
type UserRatingStats = {
    average: number;
    count: number;
};
function chunkArray<T>(
    values: T[],
    size: number
): T[][] {
    const chunks: T[][] = [];

    for (
        let index = 0;
        index < values.length;
        index += size
    ) {
        chunks.push(
            values.slice(index, index + size)
        );
    }

    return chunks;
}
function MarketplaceContent() {
    const router = useRouter();
    const pathname = usePathname();

    const searchParams =
        useSearchParams();

    const [experts, setExperts] = useState<
        PublicExpert[]
    >([]);

    const [specialtyGroups, setSpecialtyGroups] = useState<
        ExpertSpecialtyGroup[]
    >([]);

    const [specialtiesLoading, setSpecialtiesLoading] =
        useState(true);

    const [loading, setLoading] =
        useState(true);

    const [errorMessage, setErrorMessage] =
        useState<string | null>(null);

    const [filtersOpen, setFiltersOpen] =
        useState(false);

    const [search, setSearch] =
        useState(
            searchParams.get("search") || ""
        );

    const [county, setCounty] =
        useState(
            searchParams.get("county") || ""
        );

    const [specialty, setSpecialty] =
        useState(
            searchParams.get("specialty") ||
            ""
        );

    const [
        acceptingOnly,
        setAcceptingOnly,
    ] = useState(
        searchParams.get("accepting") ===
        "true"
    );

    const [sort, setSort] =
        useState<SortOption>(
            (searchParams.get(
                "sort"
            ) as SortOption) ||
            "recommended"
        );

    const loadExperts =
        useCallback(async () => {
            setLoading(true);
            setErrorMessage(null);

            try {
                /*
                 * updatedAt exists on every publicExpert
                 * created by the publishing function.
                 *
                 * We limit the first version to 200
                 * experts and filter the loaded results
                 * in the browser.
                 */
                const expertQuery = query(
                    collection(
                        db,
                        "publicExperts"
                    ),
                    orderBy("updatedAt", "desc"),
                    limit(200)
                );

                const snapshot =
                    await getDocs(expertQuery);

                const loadedExperts =
                    snapshot.docs.map(
                        (documentSnapshot) =>
                            normalizePublicExpert(
                                documentSnapshot.id,
                                documentSnapshot.data()
                            )
                    );

                const ratingMap =
                    await loadUserRatingStats(
                        loadedExperts.map(
                            (expert) => expert.uid
                        )
                    );

                const expertsWithProfileRatings =
                    loadedExperts.map((expert) => {
                        const profileRating =
                            ratingMap.get(expert.uid);

                        /*
                         * Use the existing user profile rating
                         * when available. Fall back to the rating
                         * copied into publicExperts for compatibility.
                         */
                        if (!profileRating) {
                            return expert;
                        }

                        return {
                            ...expert,

                            rating: {
                                average:
                                    profileRating.average,
                                count:
                                    profileRating.count,
                            },
                        };
                    });

                setExperts(expertsWithProfileRatings);


            } catch (error: any) {
                console.error(
                    "Failed to load public experts:",
                    error
                );

                setErrorMessage(
                    error?.message ||
                    "We could not load ekariExperts."
                );
            } finally {
                setLoading(false);
            }
        }, []);

    useEffect(() => {
        loadExperts();
    }, [loadExperts]);


    useEffect(() => {
        setSpecialtiesLoading(true);

        const specialtiesQuery = query(
            collection(db, "expert_specialty_groups"),
            orderBy("order", "asc")
        );

        const unsubscribe = onSnapshot(
            specialtiesQuery,
            (snapshot) => {
                const groups = snapshot.docs
                    .map((documentSnapshot) => {
                        const data = documentSnapshot.data();

                        return {
                            id: documentSnapshot.id,
                            title: String(data.title || "").trim(),
                            items: uniqueStrings(
                                normalizeArray(data.items)
                            ),
                            order: Number(data.order || 0),
                            active: data.active !== false,
                        };
                    })
                    .filter(
                        (group) =>
                            group.active && group.items.length > 0
                    );

                setSpecialtyGroups(groups);
                setSpecialtiesLoading(false);
            },
            (error) => {
                console.error(
                    "LOAD_EXPERT_SPECIALTIES_FAILED",
                    error
                );

                setSpecialtyGroups([]);
                setSpecialtiesLoading(false);
            }
        );

        return unsubscribe;
    }, []);

    const databaseSpecialties = useMemo(
        () =>
            uniqueStrings(
                specialtyGroups.flatMap((group) => group.items)
            ),
        [specialtyGroups]
    );

    const specialtyOptions = useMemo(() => {
        const source =
            databaseSpecialties.length > 0
                ? databaseSpecialties
                : [...FALLBACK_EXPERT_SPECIALTIES];

        return uniqueStrings([
            ...source,
            ...experts.flatMap((expert) => expert.specialties),
        ]);
    }, [databaseSpecialties, experts]);

    const locationOptions = useMemo(
        () =>
            uniqueStrings(
                experts.flatMap(getExpertLocationValues)
            ).sort((first, second) =>
                first.localeCompare(second)
            ),
        [experts]
    );

    useEffect(() => {
        if (!filtersOpen) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setFiltersOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [filtersOpen]);

    useEffect(() => {
        const parameters =
            new URLSearchParams();

        const cleanSearch =
            search.trim();

        if (cleanSearch) {
            parameters.set(
                "search",
                cleanSearch
            );
        }

        if (county) {
            parameters.set("county", county);
        }

        if (specialty) {
            parameters.set(
                "specialty",
                specialty
            );
        }

        if (acceptingOnly) {
            parameters.set(
                "accepting",
                "true"
            );
        }

        if (sort !== "recommended") {
            parameters.set("sort", sort);
        }

        const queryString =
            parameters.toString();

        router.replace(
            queryString
                ? `${pathname}?${queryString}`
                : pathname,
            {
                scroll: false,
            }
        );
    }, [
        acceptingOnly,
        county,
        pathname,
        router,
        search,
        sort,
        specialty,
    ]);

    const filteredExperts =
        useMemo(() => {
            const searchValue =
                normalizeSearchText(search);

            const selectedCounty =
                normalizeSearchText(county);

            const selectedSpecialty =
                normalizeSearchText(
                    specialty
                );

            const results = experts.filter(
                (expert) => {
                    if (
                        acceptingOnly &&
                        !expert.acceptingBookings
                    ) {
                        return false;
                    }

                    if (selectedCounty) {
                        const expertLocations =
                            getExpertLocationValues(expert).map(
                                normalizeSearchText
                            );

                        const matchesLocation =
                            expertLocations.some(
                                (location) =>
                                    location === selectedCounty ||
                                    location.includes(selectedCounty)
                            );

                        if (!matchesLocation) {
                            return false;
                        }
                    }

                    if (selectedSpecialty) {
                        const matchesSpecialty =
                            expert.specialties.some(
                                (item) =>
                                    normalizeSearchText(
                                        item
                                    ) ===
                                    selectedSpecialty
                            );

                        if (!matchesSpecialty) {
                            return false;
                        }
                    }

                    if (searchValue) {
                        const searchableText = [
                            expert.displayName,
                            expert.firstName,
                            expert.surname,
                            expert.handle,
                            expert.headline,
                            expert.expertBio,
                            expert.verificationRole,
                            expert.organizationName,
                            ...getExpertLocationValues(expert),
                            ...expert.specialties,
                            ...expert.languages,
                        ]
                            .join(" ")
                            .toLowerCase();

                        if (
                            !searchableText.includes(
                                searchValue
                            )
                        ) {
                            return false;
                        }
                    }

                    return true;
                }
            );

            return [...results].sort(
                (first, second) => {
                    if (
                        sort === "rating"
                    ) {
                        const ratingDifference =
                            second.rating.average -
                            first.rating.average;

                        if (
                            ratingDifference !== 0
                        ) {
                            return ratingDifference;
                        }

                        return (
                            second.rating.count -
                            first.rating.count
                        );
                    }

                    if (
                        sort ===
                        "consultations"
                    ) {
                        return (
                            second.completedConsultations -
                            first.completedConsultations
                        );
                    }

                    if (
                        sort === "price_low"
                    ) {
                        return (
                            first.pricing
                                .consultationFee -
                            second.pricing
                                .consultationFee
                        );
                    }

                    if (
                        sort === "price_high"
                    ) {
                        return (
                            second.pricing
                                .consultationFee -
                            first.pricing
                                .consultationFee
                        );
                    }

                    if (sort === "newest") {
                        return (
                            getTimestampMillis(
                                second.publishedAt
                            ) -
                            getTimestampMillis(
                                first.publishedAt
                            )
                        );
                    }

                    /*
                     * Recommended:
                     * 1. Accepting clients
                     * 2. Verified
                     * 3. Rating
                     * 4. Number of reviews
                     * 5. Completed consultations
                     */
                    const firstScore =
                        (first.acceptingBookings
                            ? 1000
                            : 0) +
                        (first.verified ? 500 : 0) +
                        first.rating.average *
                        100 +
                        Math.min(
                            first.rating.count,
                            100
                        ) *
                        5 +
                        Math.min(
                            first.completedConsultations,
                            200
                        );

                    const secondScore =
                        (second.acceptingBookings
                            ? 1000
                            : 0) +
                        (second.verified ? 500 : 0) +
                        second.rating.average *
                        100 +
                        Math.min(
                            second.rating.count,
                            100
                        ) *
                        5 +
                        Math.min(
                            second.completedConsultations,
                            200
                        );

                    return (
                        secondScore - firstScore
                    );
                }
            );
        }, [
            acceptingOnly,
            county,
            experts,
            search,
            sort,
            specialty,
        ]);

    const activeFilterCount =
        [
            county,
            specialty,
            acceptingOnly ? "yes" : "",
        ].filter(Boolean).length;

    const clearFilters = () => {
        setSearch("");
        setCounty("");
        setSpecialty("");
        setAcceptingOnly(false);
        setSort("recommended");
    }; const ringStyle: React.CSSProperties = {
        ["--tw-ring-color" as any]: EKARI.forest,
    };

    const [menuOpen, setMenuOpen] = useState(false);
    const { user, signOutUser } = useAuth();
    const profile = useUserProfile(user?.uid);
    const { unreadDM, notifTotal } = useInboxTotalsWeb(!!user?.uid, user?.uid);

    const handle = (profile as any)?.handle ?? null;
    const profileHref =
        handle && String(handle).trim().length > 0 ? `/${handle}` : "/getstarted";
    return (
        <AppShell>
            <main
                className="min-h-screen w-full"
                style={{
                    backgroundColor: "#F6F8F7",
                }}
            >
                <section
                    className="relative overflow-hidden"
                    style={{
                        background:
                            "linear-gradient(135deg, #1B312C 0%, #233F39 58%, #31534B 100%)",
                    }}
                >
                    <div
                        className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full"
                        style={{
                            backgroundColor:
                                "rgba(199,146,87,0.15)",
                        }}
                    />

                    <div
                        className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full"
                        style={{
                            backgroundColor:
                                "rgba(255,255,255,0.04)",
                        }}
                    />
                    <div className="lg:hidden h-full p-2 flex items-center justify-between gap-2">
                        {/* Left: menu */}
                        <button
                            onClick={() => setMenuOpen(true)}
                            className="p-2 rounded-xl border transition hover:bg-black/5 focus:outline-none focus:ring-2"
                            style={{ borderColor: EKARI.hair, ...ringStyle }}
                            aria-label="Open menu"
                        >
                            <IoMenu size={20} style={{ color: EKARI.hair }} />
                        </button>
                    </div>
                    {/* Center: title */}

                    <div className="relative mx-auto max-w-7xl px-4 py-4 md:px-8 md:py-4">
                        <div className="max-w-3xl">

                            <h1 className="mt-5 text-2xl font-black leading-tight text-white md:text-2xl">
                                Find the right agricultural
                                expert
                            </h1>

                            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 md:text-base">
                                Connect with agricultural professionals for crops, livestock, agribusiness, farm management and technical consultation.
                            </p>

                            <div className="mt-8 flex max-w-3xl overflow-hidden rounded-2xl border border-white/20 bg-white p-1.5 shadow-xl">
                                <div className="grid w-12 shrink-0 place-items-center text-slate-500">
                                    <IoSearchOutline size={21} />
                                </div>

                                <input
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(
                                            event.target.value
                                        )
                                    }
                                    placeholder="Search by name, specialty, location or service..."
                                    className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 md:text-base"
                                />

                                {search ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSearch("")
                                        }
                                        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"
                                        aria-label="Clear search"
                                    >
                                        <IoClose size={20} />
                                    </button>
                                ) : null}
                            </div>

                            <div className="mt-5 flex flex-wrap gap-3 text-xs font-bold text-white/80">
                                <span className="inline-flex items-center gap-1.5">
                                    <IoShieldCheckmarkOutline
                                        size={15}
                                        color={EKARI.gold}
                                    />
                                    Verified and independent experts
                                </span>

                                <span className="inline-flex items-center gap-1.5">
                                    <IoLocationOutline
                                        size={15}
                                        color={EKARI.gold}
                                    />
                                    Local and worldwide consultations
                                </span>

                                <span className="inline-flex items-center gap-1.5">
                                    <IoStarOutline
                                        size={15}
                                        color={EKARI.gold}
                                    />
                                    Reviews and ratings
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="mx-auto max-w-7xl px-4 py-7 md:px-8 md:py-10">
                    <section className="min-w-0">
                        <div className="mb-6 flex flex-col gap-4 rounded-3xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between md:p-5"
                            style={{ borderColor: EKARI.hair }}
                        >
                            <div>
                                <h2
                                    className="text-xl font-black md:text-2xl"
                                    style={{ color: EKARI.text }}
                                >
                                    Agricultural experts
                                </h2>

                                <p
                                    className="mt-1 text-sm"
                                    style={{ color: EKARI.subtext }}
                                >
                                    {loading
                                        ? "Finding experts..."
                                        : `${filteredExperts.length} ${filteredExperts.length === 1
                                            ? "expert"
                                            : "experts"
                                        } found`}
                                </p>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <button
                                    type="button"
                                    onClick={() => setFiltersOpen(true)}
                                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-black shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                    style={{
                                        borderColor: activeFilterCount > 0
                                            ? EKARI.forest
                                            : EKARI.hair,
                                        color: EKARI.forest,
                                    }}
                                >
                                    <IoFilterOutline size={18} />
                                    Filter experts

                                    {activeFilterCount > 0 ? (
                                        <span
                                            className="grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs text-white"
                                            style={{ backgroundColor: EKARI.forest }}
                                        >
                                            {activeFilterCount}
                                        </span>
                                    ) : null}
                                </button>

                                <div className="flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3"
                                    style={{ borderColor: EKARI.hair }}
                                >
                                    <label
                                        htmlFor="expert-sort"
                                        className="shrink-0 text-xs font-bold"
                                        style={{ color: EKARI.subtext }}
                                    >
                                        Sort by
                                    </label>

                                    <div className="relative min-w-40">
                                        <select
                                            id="expert-sort"
                                            value={sort}
                                            onChange={(event) =>
                                                setSort(event.target.value as SortOption)
                                            }
                                            className="w-full appearance-none bg-transparent py-2.5 pl-1 pr-7 text-xs font-black outline-none"
                                            style={{ color: EKARI.text }}
                                        >
                                            <option value="recommended">Recommended</option>
                                            <option value="rating">Highest rated</option>
                                            <option value="consultations">Most consultations</option>
                                            <option value="price_low">Price: low to high</option>
                                            <option value="price_high">Price: high to low</option>
                                            <option value="newest">Newest profiles</option>
                                        </select>

                                        <IoChevronDown
                                            size={15}
                                            className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2"
                                            color={EKARI.subtext}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {activeFilterCount > 0 ? (
                            <div className="mb-5 flex flex-wrap items-center gap-2">
                                <span
                                    className="text-xs font-black uppercase tracking-wide"
                                    style={{ color: EKARI.subtext }}
                                >
                                    Active filters
                                </span>

                                {county ? (
                                    <button
                                        type="button"
                                        onClick={() => setCounty("")}
                                        className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-2 text-xs font-bold"
                                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                    >
                                        {county}
                                        <IoClose size={14} />
                                    </button>
                                ) : null}

                                {specialty ? (
                                    <button
                                        type="button"
                                        onClick={() => setSpecialty("")}
                                        className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-2 text-xs font-bold"
                                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                    >
                                        {specialty}
                                        <IoClose size={14} />
                                    </button>
                                ) : null}

                                {acceptingOnly ? (
                                    <button
                                        type="button"
                                        onClick={() => setAcceptingOnly(false)}
                                        className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-2 text-xs font-bold"
                                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                    >
                                        Accepting clients
                                        <IoClose size={14} />
                                    </button>
                                ) : null}

                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="ml-1 text-xs font-black"
                                    style={{ color: EKARI.gold }}
                                >
                                    Clear all
                                </button>
                            </div>
                        ) : null}

                        {errorMessage ? (
                            <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
                                <div className="font-black text-red-800">
                                    Experts could not be loaded
                                </div>

                                <p className="mt-2 text-sm text-red-700">
                                    {errorMessage}
                                </p>

                                <button
                                    type="button"
                                    onClick={loadExperts}
                                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-700 px-5 py-2.5 text-sm font-black text-white"
                                >
                                    <IoRefreshOutline size={17} />
                                    Try again
                                </button>
                            </div>
                        ) : null}

                        {loading ? (
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                                {Array.from({ length: 6 }).map((_, index) => (
                                    <div
                                        key={index}
                                        className="animate-pulse rounded-3xl border bg-white p-5"
                                        style={{ borderColor: EKARI.hair }}
                                    >
                                        <div className="flex gap-4">
                                            <div className="h-20 w-20 rounded-2xl bg-slate-200" />
                                            <div className="flex-1 space-y-3">
                                                <div className="h-4 w-3/4 rounded bg-slate-200" />
                                                <div className="h-3 w-1/2 rounded bg-slate-100" />
                                                <div className="h-3 w-2/3 rounded bg-slate-100" />
                                            </div>
                                        </div>

                                        <div className="mt-6 h-5 w-full rounded bg-slate-200" />
                                        <div className="mt-3 h-16 w-full rounded bg-slate-100" />
                                        <div className="mt-5 flex gap-2">
                                            <div className="h-7 w-24 rounded-full bg-slate-100" />
                                            <div className="h-7 w-20 rounded-full bg-slate-100" />
                                        </div>
                                        <div className="mt-6 h-12 w-full rounded-2xl bg-slate-200" />
                                    </div>
                                ))}
                            </div>
                        ) : null}

                        {!loading && !errorMessage && filteredExperts.length > 0 ? (
                            <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
                                {filteredExperts.map((expert) => (
                                    <ExpertCard
                                        key={expert.uid}
                                        expert={expert}
                                    />
                                ))}
                            </div>
                        ) : null}

                        {!loading && !errorMessage && filteredExperts.length === 0 ? (
                            <div
                                className="rounded-3xl border bg-white px-6 py-14 text-center"
                                style={{ borderColor: EKARI.hair }}
                            >
                                <div
                                    className="mx-auto grid h-16 w-16 place-items-center rounded-full"
                                    style={{
                                        backgroundColor: "rgba(35,63,57,0.08)",
                                        color: EKARI.forest,
                                    }}
                                >
                                    <IoPeopleOutline size={30} />
                                </div>

                                <h3
                                    className="mt-5 text-lg font-black"
                                    style={{ color: EKARI.text }}
                                >
                                    No experts found
                                </h3>

                                <p
                                    className="mx-auto mt-2 max-w-md text-sm leading-6"
                                    style={{ color: EKARI.subtext }}
                                >
                                    Try another specialty, location or search phrase.
                                    More experts will appear as they join the marketplace.
                                </p>

                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="mt-5 rounded-full px-6 py-3 text-sm font-black text-white"
                                    style={{ backgroundColor: EKARI.forest }}
                                >
                                    Clear filters
                                </button>
                            </div>
                        ) : null}
                    </section>
                </div>

                {filtersOpen ? (
                    <div
                        className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-5"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="expert-filter-title"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) {
                                setFiltersOpen(false);
                            }
                        }}
                    >
                        <div
                            className="max-h-[92vh] w-full overflow-hidden rounded-t-3xl border bg-white shadow-2xl sm:max-w-xl sm:rounded-3xl"
                            style={{ borderColor: EKARI.hair }}
                        >
                            <div className="flex items-center justify-between border-b px-5 py-4 sm:px-6"
                                style={{ borderColor: EKARI.hair }}
                            >
                                <div>
                                    <h2
                                        id="expert-filter-title"
                                        className="text-lg font-black"
                                        style={{ color: EKARI.text }}
                                    >
                                        Filter experts
                                    </h2>
                                    <p className="mt-1 text-xs" style={{ color: EKARI.subtext }}>
                                        Narrow results by location, specialty and availability.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setFiltersOpen(false)}
                                    className="grid h-10 w-10 place-items-center rounded-full border bg-white"
                                    style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                    aria-label="Close filters"
                                >
                                    <IoClose size={21} />
                                </button>
                            </div>

                            <div className="max-h-[calc(92vh-145px)] overflow-y-auto px-5 py-5 sm:px-6">
                                <div>
                                    <label
                                        className="text-xs font-black uppercase tracking-wide"
                                        style={{ color: EKARI.subtext }}
                                    >
                                        Service location
                                    </label>

                                    <div className="relative mt-2">
                                        <IoLocationOutline
                                            size={17}
                                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                                            color={EKARI.subtext}
                                        />

                                        <select
                                            value={county}
                                            onChange={(event) => setCounty(event.target.value)}
                                            className="w-full appearance-none rounded-2xl border bg-white py-3.5 pl-10 pr-9 text-sm font-semibold outline-none"
                                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                        >
                                            <option value="">All locations</option>
                                            {locationOptions.map((locationName) => (
                                                <option key={locationName} value={locationName}>
                                                    {locationName}
                                                </option>
                                            ))}
                                        </select>

                                        <IoChevronDown
                                            size={16}
                                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                                            color={EKARI.subtext}
                                        />
                                    </div>
                                </div>

                                <div className="mt-5">
                                    <label
                                        className="text-xs font-black uppercase tracking-wide"
                                        style={{ color: EKARI.subtext }}
                                    >
                                        Specialty
                                    </label>

                                    <div className="relative mt-2">
                                        <IoBriefcaseOutline
                                            size={17}
                                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                                            color={EKARI.subtext}
                                        />

                                        <select
                                            value={specialty}
                                            onChange={(event) => setSpecialty(event.target.value)}
                                            className="w-full appearance-none rounded-2xl border bg-white py-3.5 pl-10 pr-9 text-sm font-semibold outline-none"
                                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                        >
                                            <option value="">All specialties</option>
                                            {specialtiesLoading ? (
                                                <option value="" disabled>
                                                    Loading specialties…
                                                </option>
                                            ) : null}
                                            {specialtyOptions.map((item) => (
                                                <option key={item} value={item}>
                                                    {item}
                                                </option>
                                            ))}
                                        </select>

                                        <IoChevronDown
                                            size={16}
                                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                                            color={EKARI.subtext}
                                        />
                                    </div>
                                </div>

                                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border p-4">
                                    <input
                                        type="checkbox"
                                        checked={acceptingOnly}
                                        onChange={(event) => setAcceptingOnly(event.target.checked)}
                                        className="mt-0.5 h-4 w-4 accent-[#233F39]"
                                    />

                                    <span>
                                        <span
                                            className="block text-sm font-black"
                                            style={{ color: EKARI.text }}
                                        >
                                            Accepting clients
                                        </span>
                                        <span
                                            className="mt-1 block text-xs leading-5"
                                            style={{ color: EKARI.subtext }}
                                        >
                                            Show experts currently available for new consultations.
                                        </span>
                                    </span>
                                </label>

                                <div
                                    className="mt-5 rounded-2xl p-4"
                                    style={{ backgroundColor: "rgba(35,63,57,0.06)" }}
                                >
                                    <div
                                        className="flex items-center gap-2 text-xs font-black"
                                        style={{ color: EKARI.forest }}
                                    >
                                        <IoShieldCheckmarkOutline size={16} />
                                        Trusted profiles
                                    </div>
                                    <p className="mt-2 text-xs leading-5" style={{ color: EKARI.subtext }}>
                                        Verification badges identify experts whose identity or professional credentials have been reviewed by ekarihub.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 border-t bg-white px-5 py-4 sm:px-6"
                                style={{ borderColor: EKARI.hair }}
                            >
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="min-h-11 flex-1 rounded-xl border bg-white px-4 text-sm font-black"
                                    style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                >
                                    Clear
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFiltersOpen(false)}
                                    className="min-h-11 flex-[1.35] rounded-xl px-4 text-sm font-black text-white"
                                    style={{ backgroundColor: EKARI.forest }}
                                >
                                    Show {filteredExperts.length} {filteredExperts.length === 1 ? "expert" : "experts"}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null}
                <EkariSideMenuSheet
                    open={menuOpen}
                    onClose={() => setMenuOpen(false)}
                    uid={user?.uid}
                    handle={(profile as any)?.handle ?? null}
                    photoURL={(profile as any)?.photoURL ?? null}
                    profileHref={profileHref}
                    unreadDM={user?.uid ? unreadDM ?? 0 : 0}
                    notifTotal={user?.uid ? notifTotal ?? 0 : 0}
                    onLogout={signOutUser}
                />
            </main>
        </AppShell>
    );
}
/* ---------- Profiles ---------- */
function useUserProfile(uid?: string) {
    const [profile, setProfile] = useState<{
        handle?: string;
        photoURL?: string;
        dataSaverVideos?: boolean;
        uid?: string;
    } | null>(null);

    useEffect(() => {
        if (!uid) {
            setProfile(null);
            return;
        }
        const ref = doc(db, "users", uid);
        const unsub = onSnapshot(ref, (snap) => {
            const data = snap.data() as any | undefined;
            if (!data) {
                setProfile(null);
                return;
            }
            setProfile({
                uid,
                handle: data?.handle,
                photoURL: data?.photoURL,
                dataSaverVideos: !!data?.dataSaverVideos,
            });
        });
        return () => unsub();
    }, [uid]);

    return profile;
}

export default function EkariExpertsClient() {
    const { user, signOutUser } = useAuth();
    const router = useRouter();
    const isDesktop = useIsDesktop();


    const goUpload = () => {
        if (!user?.uid) router.push("/getstarted?next=/studio/upload");
        else router.push("/studio/upload");
    };
    return <><MarketplaceContent />
        {!isDesktop && (<>
            <MobileBottomTabs
                onCreate={goUpload}
                theme="light"
                activeKey="experts"
            />

        </>)};
    </>
}

function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia(query);

        const updateMatch = () => {
            setMatches(mediaQuery.matches);
        };

        updateMatch();

        mediaQuery.addEventListener("change", updateMatch);

        return () => {
            mediaQuery.removeEventListener("change", updateMatch);
        };
    }, [query]);

    return matches;
}