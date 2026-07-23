import { ConsultationMethod, ExpertProfile } from "../types/expert";

export const EXPERT_SPECIALTIES = [
    "Crop Disease",
    "Crop Production",
    "Soil Health",
    "Soil Testing",
    "Maize Farming",
    "Wheat Farming",
    "Potato Farming",
    "Vegetable Farming",
    "Fruit Farming",
    "Coffee Farming",
    "Tea Farming",
    "Dairy Farming",
    "Poultry Farming",
    "Beef Farming",
    "Sheep and Goat Farming",
    "Pig Farming",
    "Animal Health",
    "Veterinary Services",
    "Animal Nutrition",
    "Farm Inputs",
    "Irrigation",
    "Farm Machinery",
    "Agribusiness",
    "Agricultural Finance",
    "Market Access",
    "Export Advisory",
    "Organic Farming",
    "Greenhouse Farming",
    "Post-Harvest Management",
    "Farm Management",
    "Agricultural Technology",
] as const;

export const KENYA_COUNTIES = [
    "Baringo",
    "Bomet",
    "Bungoma",
    "Busia",
    "Elgeyo-Marakwet",
    "Embu",
    "Garissa",
    "Homa Bay",
    "Isiolo",
    "Kajiado",
    "Kakamega",
    "Kericho",
    "Kiambu",
    "Kilifi",
    "Kirinyaga",
    "Kisii",
    "Kisumu",
    "Kitui",
    "Kwale",
    "Laikipia",
    "Lamu",
    "Machakos",
    "Makueni",
    "Mandera",
    "Marsabit",
    "Meru",
    "Migori",
    "Mombasa",
    "Murang'a",
    "Nairobi",
    "Nakuru",
    "Nandi",
    "Narok",
    "Nyamira",
    "Nyandarua",
    "Nyeri",
    "Samburu",
    "Siaya",
    "Taita-Taveta",
    "Tana River",
    "Tharaka-Nithi",
    "Trans Nzoia",
    "Turkana",
    "Uasin Gishu",
    "Vihiga",
    "Wajir",
    "West Pokot",
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
] as const;

export const CONSULTATION_METHODS: {
    value: ConsultationMethod;
    label: string;
    description: string;
}[] = [
        {
            value: "phone",
            label: "Phone call",
            description: "Consult clients through a normal phone call.",
        },
        {
            value: "whatsapp",
            label: "WhatsApp",
            description: "Consult using WhatsApp chat, voice or video.",
        },
        {
            value: "video",
            label: "Video consultation",
            description: "Hold a scheduled online video consultation.",
        },
        {
            value: "physical",
            label: "Physical farm visit",
            description: "Visit the client, farm or business location.",
        },
    ];

export const ELIGIBLE_EXPERT_ROLES = [
    "Agronomist",
    "Veterinarian",
    "Extension Officer",
    "Animal Health Officer",
    "Agricultural Consultant",
    "Agribusiness Consultant",
    "Farm Business Consultant",
    "Irrigation Specialist",
    "Crop Protection Specialist",
    "Soil Scientist",
    "Agricultural Engineer",
    "Livestock Officer",
    "Farm Manager",
    "Agribusiness Owner",
    "Input Supplier",
];

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
    countiesServed: [],
    languages: ["English", "Kiswahili"],
    consultationMethods: ["phone", "whatsapp"],

    primaryLocation: {
        county: "",
        town: "",
        latitude: null,
        longitude: null,
        geohash: null,
    },

    pricing: {
        currency: "KES",
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
        timezone: "Africa/Nairobi",
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