// utils/ekariTags.ts
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
  county?: string;          // NEW: finer locale
};

export type BuildTrendingInput = {
  country?: string;
  county?: string;          // NEW
  stakeholders?: Stakeholder[];
  emphasizeActions?: string[];
  profile?: EkariProfile;
  extra?: string[];
  crops?: string[];         // NEW: bias to crop-specific pests/diseases
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

/* ----------------- PESTS & DISEASES CATALOG (examples) ----------------- */
const PLANT_PESTS = [
  "fallarmyworm",          // maize
  "tutaabsoluta",          // tomato leafminer
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

/* ----------------- TAXONOMY ----------------- */
const TAXONOMY: Record<
  Stakeholder,
  {
    tags: string[];
    actions: Record<string, string[]>;
  }
> = {
  primaryProducer: {
    tags: ["farmer", "beekeeper", "horticulture", "livestock", "aquaculture", "forestry", "onfarm", "smallholder"],
    actions: {
      sellProduce: ["grains", "fruits", "vegetables", "dairy", "meat", "honey", "timber", "fish", "flowers", "marketlinkage"],
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
    tags: ["inputsupplier", "equipment", "machinery", "greenhouses", "irrigationkits", "demonstrations"],
    actions: {
      sellInputs: ["seeds", "feeds", "fertilizers", "chemicals", "irrigationkits", "tools", "greenhouses"],
      leaseEquipment: ["machineryleasing", "tractorhire", "postharvestequipment"],
      afterSales: ["aftersales", "training", "demos", "fielddays"],
      bulkSupply: ["bulk", "cooperatives", "traders"],
    },
  },

  animalPlantHealth: {
    tags: ["animalhealth", "planthealth", "vet", "paravet", "breeding", "agronomist", "biosecurity"],
    actions: {
      services: ["vetservices", "herdhealth", "flockhealth", "parasitemanagement"],
      supplies: ["vaccines", "supplements", "drugs"],
      breeding: ["ai", "breedingservices"],
      partnerships: ["livestockkeepers", "outreach"],
      // NEW:
      pests: PLANT_PESTS,
      plantDiseases: PLANT_DISEASES,
      animalDiseases: ANIMAL_DISEASES,
      contamination: TOXINS_CONTAMINATION,
    },
  },

  processorValueAdder: {
    tags: ["valueaddition", "processor", "packaging", "coldstorage", "qualitycontrol"],
    actions: {
      sourceRaw: ["sourcing", "fromfarmers", "aggregation"],
      sellProcessed: ["flour", "dairyproducts", "juice", "honeyproducts", "edibleoils", "meatprocessing"],
      infra: ["packaging", "coldchain", "coldrooms"],
      export: ["export", "compliance", "certification"],
    },
  },

  traderDistributor: {
    tags: ["trader", "distributor", "exporter", "aggregator", "cooperative", "retailer", "onlinedistributor", "logistics"],
    actions: {
      bulkSourcing: ["bulk", "contracts", "procurement"],
      aggregation: ["aggregation", "coopopportunities"],
      logistics: ["transport", "coldchainbooking"],
      export: ["exportlinkages", "tradefinance"],
    },
  },

  financeBiz: {
    tags: ["agfinance", "sacco", "microfinance", "leasing", "insurance", "consulting"],
    actions: {
      credit: ["agriloans", "credit", "workingcapital"],
      risk: ["cropinsurance", "livestockinsurance", "indexinsurance"],
      segments: ["cooperatives", "farmergroups", "sme"],
      advisory: ["businessadvisory", "consultancy"],
    },
  },

  knowledgeResearch: {
    tags: ["research", "training", "ict", "agritech", "knowledgehub", "extension"],
    actions: {
      programs: ["courses", "trainings", "capacitybuilding"],
      tools: ["farmapps", "digitaladvisory"],
      collaboration: ["collaboration", "pilots", "fieldtests"],
      outreach: ["demonstrations", "farmerfieldschool"],
    },
  },

  governanceStandards: {
    tags: ["government", "regulator", "standards", "certifier", "ngo", "devpartner", "traceability"],
    actions: {
      licensing: ["licensing", "permits"],
      certification: ["certification", "qualityassurance", "haccp", "organic"],
      training: ["compliance", "foodsafety"],
      programs: ["grants", "projectsupport"],
    },
  },

  consumerBuyer: {
    tags: ["consumer", "buyer", "institutionalbuyer", "exportmarket", "organic", "freshproduce", "processed"],
    actions: {
      fresh: ["fruits", "vegetables", "cereals", "dairy", "meat", "honey", "fish", "flowers"],
      processed: ["flour", "juices", "oils", "meatproducts", "dairyproducts"],
      bulk: ["bulkpurchase", "schools", "hotels", "hospitals", "supermarkets"],
      preferences: ["certified", "organic", "traceable"],
      export: ["exportbuyer"],
    },
  },
};

/** Global base tags */
const GLOBAL_BASE = ["agribusiness", "agriculture", "supplychain", "market", "marketlinkage", "valuechain", "price", "pests", "diseases"];

/* optional short county list – add the rest as needed */
const KENYA_COUNTIES = [
  "nairobi", "mombasa", "kisumu", "nakuru", "machakos", "kiambu", "kajiado", "meru", "nyeri", "transnzoia",
  "uasin-gishu", "narok", "laikipia", "embu", "kericho", "kakamega", "bungoma", "kilifi", "kwale"
].map(canonical);

function regionTags(country?: string, county?: string): string[] {
  const out: string[] = [];
  if (country && canonical(country) === "kenya") out.push(...KENYA_COUNTIES);
  if (county) out.push(canonical(county));
  return out;
}

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

  let out: string[] = [
    ...GLOBAL_BASE,
    ...regionTags(country, county),
    ...(profile?.country || profile?.county ? regionTags(profile?.country, profile?.county) : []),
    ...extra,
    ...cropLinked(crops),
    ...cropLinked(profile?.areaOfInterest),
  ];

  const chosen: Stakeholder[] =
    stakeholders && stakeholders.length ? stakeholders : (Object.keys(TAXONOMY) as Stakeholder[]);

  for (const key of chosen) {
    const node = TAXONOMY[key];
    out.push(...node.tags);
    for (const k of Object.keys(node.actions)) out.push(...node.actions[k]);
    for (const k of emphasizeActions) if (node.actions[k]) out.push(...node.actions[k], ...node.actions[k]);
  }

  if (profile?.roles?.length) out.push(...profile.roles);
  if (profile?.areaOfInterest?.length) out.push(...profile.areaOfInterest);

  const counts: Record<string, number> = {};
  for (const raw of out) {
    const t = canonical(raw);
    if (!t) continue;
    counts[t] = (counts[t] || 0) + 1;
  }

  const ranked = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, limit);
  const boosters = ["agribusiness", "market", "kenya", "export", "organic"];
  return uniq([...boosters.filter((b) => ranked.includes(b)), ...ranked]);
}
