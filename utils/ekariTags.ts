// utils/ekariTags.ts
import {
  Firestore,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

/* ----------------- TYPES ----------------- */

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
  county?: string;
};

export type BuildTrendingInput = {
  country?: string;
  county?: string;
  stakeholders?: Stakeholder[]; // kept for future use
  emphasizeActions?: string[];
  profile?: EkariProfile;
  extra?: string[];
  crops?: string[];
  limit?: number;
};

/* ----------------- NORMALISATION HELPERS ----------------- */

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

/* ----------------- FIRESTORE DOC SHAPES ----------------- */

type GroupDoc = {
  title?: string;
  items?: string[];
  order?: number;
  active?: boolean;
};

/* ----------------- RUNTIME TAG CACHE ----------------- */

type RuntimeTag = {
  value: string;      // normalized, e.g. "maize"
  label: string;      // pretty label, e.g. "Maize"
  baseWeight: number; // importance from group + type
};

/**
 * We keep ALL tags (from interests, roles, crops, etc.) here.
 * Key = normalized value (e.g. "maize")
 */
let RUNTIME_TAGS: Record<string, RuntimeTag> = {};

// latest docs per group type – so we can rebuild when any snapshot changes
let INTEREST_DOCS: GroupDoc[] = [];
let ROLE_DOCS: GroupDoc[] = [];
let CROP_DOCS: GroupDoc[] = [];

let SYNC_STARTED = false;

/* ----------------- SMALL FALLBACK IF FIRESTORE FAILS ----------------- */

const FALLBACK_TAGS = [
  "agribusiness",
  "agriculture",
  "market",
  "maize",
  "tomato",
  "dairy",
  "poultry",
];

/* ----------------- INTERNAL: REBUILD CACHE ----------------- */

function rebuildRuntimeTags() {
  const next: Record<string, RuntimeTag> = {};

  const ingest = (
    kind: "interest" | "role" | "crop",
    docs: GroupDoc[]
  ) => {
    docs.forEach((data, index) => {
      if (data.active === false) return;

      const items = data.items ?? [];
      const groupOrder = data.order ?? index;

      // basic boosts:
      //  - crops a bit stronger (they’re very visible)
      //  - roles slightly stronger than generic interests
      const kindBoost = kind === "crop" ? 3 : kind === "role" ? 2 : 1;

      // lower "order" → more important
      const orderWeight = Math.max(1, 50 - groupOrder); // 50,49,48,...

      const baseWeight = kindBoost + orderWeight / 10; // e.g. 3 + 4.9

      items.forEach((rawLabel) => {
        const label = (rawLabel ?? "").trim();
        if (!label) return;
        const value = canonical(label);
        if (!value) return;

        const existing = next[value];
        if (!existing || baseWeight > existing.baseWeight) {
          next[value] = {
            value,
            label,
            baseWeight,
          };
        }
      });
    });
  };

  ingest("interest", INTEREST_DOCS);
  ingest("role", ROLE_DOCS);
  ingest("crop", CROP_DOCS);

  RUNTIME_TAGS = next;
}

/* ----------------- PUBLIC: ONE-SHOT INIT + LIVE SYNC ----------------- */

/**
 * One-shot load (e.g. on app start).
 * Also starts live sync on the browser using `onSnapshot`.
 */
export async function initEkariTagsFromFirestore(db: Firestore) {
  try {
    const [igSnap, rgSnap] = await Promise.all([
      getDocs(
        query(collection(db, "interest_groups"), orderBy("order", "asc"))
      ),
      getDocs(query(collection(db, "role_groups"), orderBy("order", "asc"))),

    ]);

    INTEREST_DOCS = igSnap.docs.map((d) => d.data() as GroupDoc);
    ROLE_DOCS = rgSnap.docs.map((d) => d.data() as GroupDoc);


    rebuildRuntimeTags();

    // start live syncing on the client
    if (typeof window !== "undefined" && !SYNC_STARTED) {
      startEkariTagSync(db);
    }
  } catch (err) {
    console.error("initEkariTagsFromFirestore failed:", err);
    // keep whatever cache we had; buildTrending will fallback if empty
  }
}

/**
 * Start *live* syncing tags from Firestore.
 * Safe to call multiple times; later calls are no-ops.
 * Returns an unsubscribe function if you want to stop it.
 */
export function startEkariTagSync(db: Firestore) {
  if (SYNC_STARTED) return () => { };
  if (typeof window === "undefined") return () => { };
  SYNC_STARTED = true;

  const qInterests = query(
    collection(db, "interest_groups"),
    orderBy("order", "asc")
  );
  const qRoles = query(
    collection(db, "role_groups"),
    orderBy("order", "asc")
  );


  const unsubInterests = onSnapshot(qInterests, (snap) => {
    INTEREST_DOCS = snap.docs.map((d) => d.data() as GroupDoc);
    rebuildRuntimeTags();
  });

  const unsubRoles = onSnapshot(qRoles, (snap) => {
    ROLE_DOCS = snap.docs.map((d) => d.data() as GroupDoc);
    rebuildRuntimeTags();
  });

  return () => {
    unsubInterests();
    unsubRoles();
    SYNC_STARTED = false;
  };
}

/* ----------------- LABEL HELPER (for HashtagPicker UI) ----------------- */

export function getEkariTagLabel(tag: string): string {
  const value = canonical(tag);
  const runtime = RUNTIME_TAGS[value];

  if (runtime) return runtime.label;

  // fallback: make it look a bit nicer
  const cleaned = tag
    .replace(/[_-]/g, " ")
    .trim();

  if (!cleaned) return tag;

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/* ----------------- TRENDING BUILDER ----------------- */

export function buildEkariTrending(
  input: BuildTrendingInput = {}
): string[] {
  const {
    profile,
    crops = [],
    extra = [],
    limit = 800,
  } = input;

  const scores: Record<string, number> = {};

  const bump = (raw: string, amount: number) => {
    const value = canonical(raw);
    if (!value) return;
    const base = RUNTIME_TAGS[value]?.baseWeight ?? 1;
    scores[value] = (scores[value] ?? 0) + amount * base;
  };

  // 1) Baseline: all known tags at their base weight
  Object.values(RUNTIME_TAGS).forEach((rt) => {
    scores[rt.value] = (scores[rt.value] ?? 0) + rt.baseWeight;
  });

  // 2) Profile interest + roles → ×2
  (profile?.areaOfInterest ?? []).forEach((t) => bump(t, 2));
  (profile?.roles ?? []).forEach((t) => bump(t, 2));

  // 3) Explicit crops passed in → ×2
  crops.forEach((c) => bump(c, 2));

  // 4) Extras → ×3 (developer-forced boosts)
  extra.forEach((e) => bump(e, 3));

  // 5) Guard: if everything failed, use small fallback list
  if (!Object.keys(scores).length) {
    FALLBACK_TAGS.forEach((t) => bump(t, 1));
  }

  return Object.keys(scores)
    .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))
    .slice(0, limit);
}

/** Optional: get everything as `{ value, label }[]` if you ever need it */
export function getAllRuntimeTags(): { value: string; label: string }[] {
  return Object.values(RUNTIME_TAGS).map(({ value, label }) => ({
    value,
    label,
  }));
}
