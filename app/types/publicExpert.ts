import type {
    Timestamp,
} from "firebase/firestore";

/* -------------------------------------------------------------------------- */
/*                               Location types                               */
/* -------------------------------------------------------------------------- */

export type PublicExpertCoordinates = {
    latitude: number;
    longitude: number;
    geohash?: string | null;
};

export type PublicExpertLocation = {
    placeId: string | null;

    label: string;

    countryCode: string;
    country: string;

    region: string;
    city: string;
    locality: string;

    coordinates:
    | PublicExpertCoordinates
    | null;

    timezone: string | null;
};

export type PublicExpertServiceAreaType =
    | "country"
    | "region"
    | "city"
    | "radius";

export type PublicExpertServiceArea = {
    id: string;

    type:
    PublicExpertServiceAreaType;

    label: string;

    placeId: string | null;

    countryCode: string;
    country: string;

    region: string;
    city: string;

    center:
    | PublicExpertCoordinates
    | null;

    radiusKm: number | null;
};

export type PublicExpertOnlineCoverage =
    | "local"
    | "country"
    | "worldwide";

export type PublicExpertServiceCoverage = {
    offersOnlineServices: boolean;
    offersPhysicalVisits: boolean;

    onlineCoverage:
    PublicExpertOnlineCoverage;

    serviceAreas:
    PublicExpertServiceArea[];
};

/* -------------------------------------------------------------------------- */
/*                                Pricing types                               */
/* -------------------------------------------------------------------------- */

export type PublicExpertCurrency =
    | "KES"
    | "USD";

export type PublicExpertFeeType =
    | "fixed"
    | "starting_from"
    | "free";

export type PublicExpertPricing = {
    currency:
    PublicExpertCurrency;

    consultationFee: number;

    physicalVisitFeeFrom:
    number | null;

    feeType:
    PublicExpertFeeType;

    consultationDurationMinutes:
    number;
};

/* -------------------------------------------------------------------------- */
/*                              Consultation types                            */
/* -------------------------------------------------------------------------- */

export type PublicConsultationMethod =
    | "phone"
    | "whatsapp"
    | "video"
    | "chat"
    | "physical";

export type PublicExpertTerms = {
    summary: string;

    cancellationNoticeHours:
    number;

    cancellationPolicy: string;

    allowsRescheduling:
    boolean;

    paymentRequiredBeforeBooking:
    boolean;
};

export type PublicExpertRating = {
    average: number;
    count: number;
};

/* -------------------------------------------------------------------------- */
/*                              Verification types                            */
/* -------------------------------------------------------------------------- */

export type PublicExpertVerificationStatus =
    | "none"
    | "payment_pending"
    | "pending"
    | "approved"
    | "rejected"
    | "expired";

export type PublicExpertVerificationType =
    | "individual"
    | "business"
    | "company";

/* -------------------------------------------------------------------------- */
/*                                Public expert                               */
/* -------------------------------------------------------------------------- */

export type PublicExpert = {
    uid: string;

    displayName: string;
    firstName: string;
    surname: string;
    handle: string;
    photoURL: string;

    headline: string;
    expertBio: string;

    verificationStatus:
    PublicExpertVerificationStatus;

    verificationRole: string;

    verificationType:
    PublicExpertVerificationType;

    organizationName: string;

    specialties: string[];
    languages: string[];

    consultationMethods:
    PublicConsultationMethod[];

    primaryLocation:
    PublicExpertLocation;

    serviceCoverage:
    PublicExpertServiceCoverage;

    /*
     * Temporary compatibility field.
     *
     * Older published expert documents may still
     * contain Kenyan county-based service areas.
     * Remove after all profiles have been republished.
     */
    countiesServed?: string[];

    pricing: PublicExpertPricing;
    terms: PublicExpertTerms;

    acceptingBookings: boolean;

    /*
     * Keep this convenience boolean because cards
     * and ranking logic already use it.
     *
     * It should be true only when:
     * verificationStatus === "approved"
     */
    verified: boolean;

    rating: PublicExpertRating;

    completedConsultations:
    number;

    publishedAt?:
    | Timestamp
    | null;

    updatedAt?:
    | Timestamp
    | null;
};