import type {
  ConsultationMethod,
  ExpertProfile,
} from "../types/expert";

/*
 * Fallback only.
 *
 * The primary specialties list should be loaded from:
 * expert_specialty_groups
 *
 * This fallback is used when Firestore is unavailable
 * or the taxonomy collection is empty.
 */
export const FALLBACK_EXPERT_SPECIALTIES = [
  "Crop disease diagnosis",
  "Soil fertility management",
  "Greenhouse production",
  "General veterinary consultation",
  "Dairy production",
  "Poultry disease management",
  "Feed formulation",
  "Farm business planning",
] as const;

/*
 * Optional prominent choices shown before the full
 * searchable specialty list.
 */
export const PROMINENT_EXPERT_SPECIALTIES = [
  "Crop disease diagnosis",
  "Soil fertility management",
  "Greenhouse production",
  "General veterinary consultation",
  "Dairy production",
  "Poultry disease management",
  "Feed formulation",
  "Farm business planning",
] as const;

export const EXPERT_LANGUAGES = [
  "English",
  "Kiswahili",
  "Kikuyu",
  "Kalenjin",
  "Luo",
  "Luhya",
  "Kamba",
  "Kisii",
  "Meru",
  "Maasai",
  "Somali",
  "Turkana",
  "Embu",
  "Mijikenda",
  "Arabic",
  "French",
] as const;

export const CONSULTATION_METHODS: Array<{
  value: ConsultationMethod;
  label: string;
  description: string;
}> = [
    {
      value: "phone",
      label: "Phone call",
      description:
        "Consult clients through a normal phone call.",
    },
    {
      value: "whatsapp",
      label: "WhatsApp",
      description:
        "Consult using WhatsApp chat, voice or video.",
    },
    {
      value: "video",
      label: "Video consultation",
      description:
        "Hold a scheduled online video consultation.",
    },
    {
      value: "chat",
      label: "Ekarihub chat",
      description:
        "Provide consultation through Ekarihub messages.",
    },
    {
      value: "physical",
      label: "Physical farm visit",
      description:
        "Visit the client, farm or business location.",
    },
  ];

export const EXPERT_CURRENCIES = [
  {
    value: "KES",
    label: "KES — Kenyan shilling",
  },
  {
    value: "USD",
    label: "USD — US dollar",
  },
] as const;

export const ONLINE_COVERAGE_OPTIONS = [
  {
    value: "local",
    label: "Near my location",
  },
  {
    value: "country",
    label: "Anywhere in my country",
  },
  {
    value: "worldwide",
    label: "Worldwide",
  },
] as const;

export const PHYSICAL_VISIT_RADIUS_OPTIONS = [
  {
    value: "10",
    label: "Within 10 km",
  },
  {
    value: "25",
    label: "Within 25 km",
  },
  {
    value: "50",
    label: "Within 50 km",
  },
  {
    value: "100",
    label: "Within 100 km",
  },
  {
    value: "200",
    label: "Within 200 km",
  },
] as const;

export const CONSULTATION_DURATIONS = [
  15,
  30,
  45,
  60,
  90,
  120,
] as const;

export const DEFAULT_EXPERT_PROFILE = (
  uid: string
): ExpertProfile => ({
  uid,

  status: "draft",
  isDiscoverable: false,
  acceptingBookings: true,

  headline: "",
  expertBio: "",

  specialties: [],

  /*
   * Temporary compatibility field.
   * Remove after old profiles have been migrated.
   */
  countiesServed: [],

  languages: [
    "English",
    "Kiswahili",
  ],

  consultationMethods: [
    "phone",
    "whatsapp",
  ],

  primaryLocation: {
    placeId: null,
    label: "",

    countryCode: "",
    country: "",

    region: "",
    city: "",
    locality: "",

    coordinates: null,
    timezone: null,
  },

  serviceCoverage: {
    offersOnlineServices: true,
    offersPhysicalVisits: false,

    onlineCoverage: "worldwide",

    serviceAreas: [],
  },

  pricing: {
    /*
     * This can be overridden by the user’s
     * preferred currency during normalization.
     */
    currency: "USD",

    consultationFee: 0,
    physicalVisitFeeFrom: null,

    feeType: "fixed",

    consultationDurationMinutes: 45,
  },

  terms: {
    summary: "",

    cancellationNoticeHours: 6,

    cancellationPolicy:
      "Clients should cancel or request rescheduling before the required notice period.",

    allowsRescheduling: true,

    paymentRequiredBeforeBooking: true,
  },

  availability: {
    timezone: "UTC",
    scheduleConfigured: false,
  },

  rating: {
    average: 0,
    count: 0,
  },

  completedConsultations: 0,

  createdAt: null,
  updatedAt: null,
  publishedAt: null,

  suspendedAt: null,
  suspendedReason: null,
});