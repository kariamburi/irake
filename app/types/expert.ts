import type {
  Timestamp,
} from "firebase/firestore";

export type ExpertProfileStatus =
  | "draft"
  | "active"
  | "paused"
  | "suspended";

export type ConsultationMethod =
  | "phone"
  | "whatsapp"
  | "video"
  | "chat"
  | "physical";

export type ExpertFeeType =
  | "fixed"
  | "starting_from"
  | "free";

export type ExpertCurrency =
  | "KES"
  | "USD";

export type ExpertCoordinates = {
  latitude: number;
  longitude: number;
  geohash?: string | null;
};

export type ExpertPlace = {
  placeId: string | null;

  label: string;

  countryCode: string;
  country: string;

  region: string;
  city: string;
  locality: string;

  coordinates:
  | ExpertCoordinates
  | null;

  timezone: string | null;
};

export type ExpertServiceAreaType =
  | "country"
  | "region"
  | "city"
  | "radius";

export type ExpertServiceArea = {
  id: string;

  type: ExpertServiceAreaType;

  label: string;

  placeId: string | null;

  countryCode: string;
  country: string;

  region: string;
  city: string;

  center:
  | ExpertCoordinates
  | null;

  radiusKm: number | null;
};

export type ExpertOnlineCoverage =
  | "local"
  | "country"
  | "worldwide";

export type ExpertServiceCoverage = {
  offersOnlineServices: boolean;
  offersPhysicalVisits: boolean;

  onlineCoverage:
  ExpertOnlineCoverage;

  serviceAreas:
  ExpertServiceArea[];
};

export type ExpertPricing = {
  currency: ExpertCurrency;

  consultationFee: number;

  physicalVisitFeeFrom:
  number | null;

  feeType: ExpertFeeType;

  consultationDurationMinutes:
  number;
};

export type ExpertTerms = {
  summary: string;

  cancellationNoticeHours:
  number;

  cancellationPolicy: string;

  allowsRescheduling:
  boolean;

  paymentRequiredBeforeBooking:
  boolean;
};

export type ExpertAvailability = {
  timezone: string;
  scheduleConfigured: boolean;
};

export type ExpertRating = {
  average: number;
  count: number;
};

export type ExpertProfile = {
  uid: string;

  status: ExpertProfileStatus;

  isDiscoverable: boolean;

  acceptingBookings: boolean;

  headline: string;
  expertBio: string;

  specialties: string[];

  /**
   * Temporary migration field for older
   * web/mobile profiles.
   *
   * Remove after all expert profiles have
   * been resaved using serviceCoverage.
   */
  countiesServed?: string[];

  languages: string[];

  consultationMethods:
  ConsultationMethod[];

  primaryLocation:
  ExpertPlace;

  serviceCoverage:
  ExpertServiceCoverage;

  pricing: ExpertPricing;

  terms: ExpertTerms;

  availability:
  ExpertAvailability;

  rating: ExpertRating;

  completedConsultations:
  number;

  createdAt?:
  | Timestamp
  | null;

  updatedAt?:
  | Timestamp
  | null;

  publishedAt?:
  | Timestamp
  | null;

  suspendedAt?:
  | Timestamp
  | null;

  suspendedReason?:
  string | null;
};