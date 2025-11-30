// utils/ekariTags.ts
import {
  Firestore,
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

export type Stakeholder =
  | "primaryProducer"
  | "inputProvider"
  | "animalPlantHealth"
  | "processorValueAdder"
  | "traderDistributor"
  | "financeBiz"
  | "knowledgeResearch"
  | "governanceStandards"
  | "consumerBuyer";

export type EkariProfile = {
  roles?: string[];
  areaOfInterest?: string[];
  accountType?: string;
  country?: string;
  county?: string; // finer locale
};

export type BuildTrendingInput = {
  country?: string;
  county?: string;
  stakeholders?: Stakeholder[];
  emphasizeActions?: string[];
  profile?: EkariProfile;
  extra?: string[];
  crops?: string[]; // bias to crop-specific pests/diseases
  limit?: number;
};

/* ----------------- SHARED NORMALIZER + ALIASES ----------------- */
export const normalizeTag = (s: string) =>
  s
    .trim()
    .replace(/^#/, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30);

const ALIASES: Record<string, string> = {
  veg: "vegetables",
  veggies: "vegetables",
  mln: "maizelethalnecrosis",
  faw: "fallarmyworm",
  fmd: "footandmouth",
  ncd: "newcastle",
  ecf: "eastcoastfever",
  gmo: "geneticallymodified",
};

const canonical = (raw: string) => {
  const n = normalizeTag(raw);
  return ALIASES[n] || n;
};

const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

/* ----------------- STATIC CATALOGS (FALLBACK) ----------------- */
const PLANT_PESTS = [
  "fallarmyworm", // maize
  "tutaabsoluta", // tomato leafminer
  "fruitflies",
  "stemborer",
  "aphids",
  "locusts",
  "leafminer",
];

const PLANT_DISEASES = [
  "maizelethalnecrosis",
  "lateblight",
  "bacterialwilt",
  "anthracnose",
  "coffeerust",
  "powderymildew",
];

const ANIMAL_DISEASES = [
  "footandmouth",
  "newcastle",
  "brucellosis",
  "mastitis",
  "eastcoastfever",
  "anthrax",
];

const TOXINS_CONTAMINATION = ["aflatoxin", "residues", "mycotoxins"];

/* link crops → likely pests/diseases (short illustrative map) */
const CROP_LINKS: Record<string, string[]> = {
  maize: ["fallarmyworm", "stemborer", "maizelethalnecrosis", "aflatoxin"],
  tomato: ["tutaabsoluta", "lateblight", "bacterialwilt"],
  potato: ["lateblight", "bacterialwilt"],
  coffee: ["coffeerust"],
  dairy: ["mastitis"],
};

/** Global base tags (fallback) */
const GLOBAL_BASE_FALLBACK = [
  "agribusiness",
  "agriculture",
  "supplychain",
  "market",
  "marketlinkage",
  "valuechain",
  "price",
  "pests",
  "diseases",
];

/* ----------------- FIRESTORE-DRIVEN RUNTIME TAGS ----------------- */

/**
 * Flattened list of all interests (union of items in interest_groups)
 * and roles (union of items in role_groups), coming from Firestore.
 */
let ALL_INTERESTS_RUNTIME: string[] = [];
let ALL_ROLES_RUNTIME: string[] = [];

/**
 * Firestore schema we expect:
 * collection("interest_groups") docs:
 *   { title: string, items: string[], order: number }
 * collection("role_groups") docs:
 *   { title: string, items: string[], order: number }
 */
type GroupDoc = {
  title?: string;
  items?: string[];
  order?: number;
};

/**
 * Call this once (e.g. app start, API route init) to sync
 * trending tags with Firestore interest_groups + role_groups.
 *
 * Safe to call multiple times; latest successful call wins.
 */
export async function initEkariTagsFromFirestore(db: Firestore) {
  try {
    const igSnap = await getDocs(
      query(collection(db, "interest_groups"), orderBy("order", "asc"))
    );
    const rgSnap = await getDocs(
      query(collection(db, "role_groups"), orderBy("order", "asc"))
    );

    const interests: string[] = [];
    igSnap.forEach((docSnap) => {
      const data = docSnap.data() as GroupDoc;
      if (Array.isArray(data.items)) {
        interests.push(...data.items);
      }
    });

    const roles: string[] = [];
    rgSnap.forEach((docSnap) => {
      const data = docSnap.data() as GroupDoc;
      if (Array.isArray(data.items)) {
        roles.push(...data.items);
      }
    });

    ALL_INTERESTS_RUNTIME = uniq(
      interests
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => canonical(s))
    );

    ALL_ROLES_RUNTIME = uniq(
      roles
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => canonical(s))
    );
  } catch (err) {
    // If Firestore fails, we just keep runtime arrays empty
    // and rely purely on the static taxonomy + profile.
    console.error("initEkariTagsFromFirestore failed:", err);
    ALL_INTERESTS_RUNTIME = [];
    ALL_ROLES_RUNTIME = [];
  }
}

/* ----------------- TAXONOMY (STATIC, BUT USES CATALOGS ABOVE) ----------------- */

const TAXONOMY: Record<
  Stakeholder,
  {
    tags: string[];
    actions: Record<string, string[]>;
  }
> = {
  primaryProducer: {
    tags: [
      "farmer",
      "beekeeper",
      "horticulture",
      "livestock",
      "aquaculture",
      "forestry",
      "onfarm",
      "smallholder",
    ],
    actions: {
      sellProduce: [
        "grains",
        "fruits",
        "vegetables",
        "dairy",
        "meat",
        "honey",
        "timber",
        "fish",
        "flowers",
        "marketlinkage",
      ],
      buyInputs: ["seeds", "fertilizers", "agrochemicals", "feeds", "tools"],
      leaseEquipment: ["tractors", "irrigationpumps", "processingmachines"],
      hireServices: ["vets", "agronomist", "soiltesting", "logistics"],
      training: ["extension", "farmertraining", "goodagpractices"],
      finance: ["loans", "insurance", "microfinance"],
      irrigation: ["irrigation", "watermanagement"],
      climate: ["climatesmart", "resilience"],
    },
  },

  inputProvider: {
    tags: [
      "inputsupplier",
      "equipment",
      "machinery",
      "greenhouses",
      "irrigationkits",
      "demonstrations",
    ],
    actions: {
      sellInputs: [
        "seeds",
        "feeds",
        "fertilizers",
        "chemicals",
        "irrigationkits",
        "tools",
        "greenhouses",
      ],
      leaseEquipment: [
        "machineryleasing",
        "tractorhire",
        "postharvestequipment",
      ],
      afterSales: ["aftersales", "training", "demos", "fielddays"],
      bulkSupply: ["bulk", "cooperatives", "traders"],
    },
  },

  animalPlantHealth: {
    tags: [
      "animalhealth",
      "planthealth",
      "vet",
      "paravet",
      "breeding",
      "agronomist",
      "biosecurity",
    ],
    actions: {
      services: [
        "vetservices",
        "herdhealth",
        "flockhealth",
        "parasitemanagement",
      ],
      supplies: ["vaccines", "supplements", "drugs"],
      breeding: ["ai", "breedingservices"],
      partnerships: ["livestockkeepers", "outreach"],
      pests: PLANT_PESTS,
      plantDiseases: PLANT_DISEASES,
      animalDiseases: ANIMAL_DISEASES,
      contamination: TOXINS_CONTAMINATION,
    },
  },

  processorValueAdder: {
    tags: [
      "valueaddition",
      "processor",
      "packaging",
      "coldstorage",
      "qualitycontrol",
    ],
    actions: {
      sourceRaw: ["sourcing", "fromfarmers", "aggregation"],
      sellProcessed: [
        "flour",
        "dairyproducts",
        "juice",
        "honeyproducts",
        "edibleoils",
        "meatprocessing",
      ],
      infra: ["packaging", "coldchain", "coldrooms"],
      export: ["export", "compliance", "certification"],
    },
  },

  traderDistributor: {
    tags: [
      "trader",
      "distributor",
      "exporter",
      "aggregator",
      "cooperative",
      "retailer",
      "onlinedistributor",
      "logistics",
    ],
    actions: {
      bulkSourcing: ["bulk", "contracts", "procurement"],
      aggregation: ["aggregation", "coopopportunities"],
      logistics: ["transport", "coldchainbooking"],
      export: ["exportlinkages", "tradefinance"],
    },
  },

  financeBiz: {
    tags: [
      "agfinance",
      "sacco",
      "microfinance",
      "leasing",
      "insurance",
      "consulting",
    ],
    actions: {
      credit: ["agriloans", "credit", "workingcapital"],
      risk: ["cropinsurance", "livestockinsurance", "indexinsurance"],
      segments: ["cooperatives", "farmergroups", "sme"],
      advisory: ["businessadvisory", "consultancy"],
    },
  },

  knowledgeResearch: {
    tags: [
      "research",
      "training",
      "ict",
      "agritech",
      "knowledgehub",
      "extension",
    ],
    actions: {
      programs: ["courses", "trainings", "capacitybuilding"],
      tools: ["farmapps", "digitaladvisory"],
      collaboration: ["collaboration", "pilots", "fieldtests"],
      outreach: ["demonstrations", "farmerfieldschool"],
    },
  },

  governanceStandards: {
    tags: [
      "government",
      "regulator",
      "standards",
      "certifier",
      "ngo",
      "devpartner",
      "traceability",
    ],
    actions: {
      licensing: ["licensing", "permits"],
      certification: [
        "certification",
        "qualityassurance",
        "haccp",
        "organic",
      ],
      training: ["compliance", "foodsafety"],
      programs: ["grants", "projectsupport"],
    },
  },

  consumerBuyer: {
    tags: [
      "consumer",
      "buyer",
      "institutionalbuyer",
      "exportmarket",
      "organic",
      "freshproduce",
      "processed",
    ],
    actions: {
      fresh: [
        "fruits",
        "vegetables",
        "cereals",
        "dairy",
        "meat",
        "honey",
        "fish",
        "flowers",
      ],
      processed: [
        "flour",
        "juices",
        "oils",
        "meatproducts",
        "dairyproducts",
      ],
      bulk: ["bulkpurchase", "schools", "hotels", "hospitals", "supermarkets"],
      preferences: ["certified", "organic", "traceable"],
      export: ["exportbuyer"],
    },
  },
};

/* ----------------- HELPERS THAT USE CATALOGS ----------------- */

function cropLinked(crops?: string[]) {
  if (!crops?.length) return [] as string[];
  const out: string[] = [];
  for (const c of crops) {
    const key = canonical(c);
    if (CROP_LINKS[key]) out.push(...CROP_LINKS[key]);
  }
  return out;
}

/* ----------------- builder ----------------- */
export function buildEkariTrending(input: BuildTrendingInput = {}): string[] {
  const {
    country,
    county,
    stakeholders,
    emphasizeActions = [],
    profile,
    extra = [],
    crops = [],
    limit = 48,
  } = input;

  // Start with global base + Firestore-driven global interests and roles
  let out: string[] = [
    ...GLOBAL_BASE_FALLBACK,
    ...ALL_INTERESTS_RUNTIME,
    ...ALL_ROLES_RUNTIME,
    // region tags could be re-enabled later if needed
    ...extra,
    ...cropLinked(crops),
    ...cropLinked(profile?.areaOfInterest),
  ];

  const chosen: Stakeholder[] =
    stakeholders && stakeholders.length
      ? stakeholders
      : (Object.keys(TAXONOMY) as Stakeholder[]);

  for (const key of chosen) {
    const node = TAXONOMY[key];
    out.push(...node.tags);
    for (const k of Object.keys(node.actions)) {
      out.push(...node.actions[k]);
    }
    for (const k of emphasizeActions) {
      if (node.actions[k]) {
        out.push(...node.actions[k], ...node.actions[k]); // double weight
      }
    }
  }

  if (profile?.roles?.length) out.push(...profile.roles);
  if (profile?.areaOfInterest?.length) out.push(...profile.areaOfInterest);

  const counts: Record<string, number> = {};
  for (const raw of out) {
    const t = canonical(raw);
    if (!t) continue;
    counts[t] = (counts[t] || 0) + 1;
  }

  const ranked = Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, limit);

  const boosters = ["agribusiness", "market", "kenya", "export", "organic"];
  return uniq([
    ...boosters.filter((b) => ranked.includes(b)),
    ...ranked,
  ]);
}
