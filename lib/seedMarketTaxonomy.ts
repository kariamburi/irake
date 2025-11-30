// lib/seedMarketCatalogFull.ts
import { db } from "@/lib/firebase";
import {
    collection,
    doc,
    writeBatch,
} from "firebase/firestore";

import {
    MARKET_CATALOG,
    MarketType,
} from "@/utils/market_master_catalog"; // adjust path

type CatalogRow = {
    type: MarketType;
    category: string;
    subCategory?: string;
    name: string;
    variety?: string;
    form?: string;
    useCase?: string;
    typicalPackSize?: string | number;
    unit?: string;
    grade?: string;
    extras?: Record<string, string>;
};

function slugify(input: string): string {
    return input
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

const TYPE_LABELS: Record<MarketType, string> = {
    product: "Products",
    tree: "Trees",
    animal: "Animals & Livestock",
    lease: "Lease & Equipment",
    service: "Services",
    arableLand: "Arable Land"
};

export async function seedMarketTaxonomy() {
    const typesSet = new Set<MarketType>();
    const categoriesMap = new Map<MarketType, Set<string>>();

    const rows: CatalogRow[] = MARKET_CATALOG as CatalogRow[];

    // Collect types + categories
    for (const row of rows) {
        const type = row.type;
        typesSet.add(type);

        const cat = (row.category || "").trim();
        if (cat) {
            if (!categoriesMap.has(type)) categoriesMap.set(type, new Set());
            categoriesMap.get(type)!.add(cat);
        }
    }

    // ----- Seed market_types -----
    {
        const batch = writeBatch(db);
        for (const typeId of typesSet) {
            const ref = doc(collection(db, "market_types"), typeId);

            batch.set(
                ref,
                {
                    id: typeId,
                    label: TYPE_LABELS[typeId] ?? typeId,
                    description: "",
                    iconName: "",
                    order: 0,
                    active: true,
                },
                { merge: true }
            );
        }
        await batch.commit();
    }

    // ----- Seed market_categories -----
    {
        const batch = writeBatch(db);
        categoriesMap.forEach((cats, typeId) => {
            Array.from(cats).forEach((name, idx) => {
                const id = `${typeId}_${slugify(name)}`;
                const ref = doc(collection(db, "market_categories"), id);

                batch.set(
                    ref,
                    {
                        id,
                        typeId,
                        name,
                        description: "",
                        order: idx, // you can tweak later in admin
                        active: true,
                    },
                    { merge: true }
                );
            });
        });
        await batch.commit();
    }

    // ----- Seed market_items (full rows) -----
    // Firestore batch limit = 500 docs → chunk
    const chunkSize = 400;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const batch = writeBatch(db);
        const slice = rows.slice(i, i + chunkSize);

        slice.forEach((row, idx) => {
            const typeId = row.type;
            const cat = (row.category || "").trim();
            const subCat = (row.subCategory || "").trim();
            const name = (row.name || "").trim();
            const variety = (row.variety || "").trim();
            const idParts = [
                typeId,
                slugify(cat),
                subCat && slugify(subCat),
                name && slugify(name),
                variety && slugify(variety),
            ].filter(Boolean) as string[];

            const id =
                idParts.length > 0 ? idParts.join("_") : `item_${i + idx}`;

            const ref = doc(collection(db, "market_items"), id);

            const searchableParts = [
                typeId,
                cat,
                subCat,
                name,
                variety,
                row.form,
                row.useCase,
                row.grade,
                row.extras && Object.values(row.extras).join(" "),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            batch.set(
                ref,
                {
                    id,
                    type: typeId,
                    category: cat,
                    subCategory: subCat || null,
                    name,
                    variety: variety || null,
                    form: row.form || null,
                    useCase: row.useCase || null,
                    typicalPackSize: row.typicalPackSize ?? null,
                    unit: row.unit || null,
                    grade: row.grade || null,
                    extras: row.extras ?? {},
                    nameLower: name.toLowerCase(),
                    categoryLower: cat.toLowerCase(),
                    searchableText: searchableParts,
                    active: true,
                },
                { merge: true }
            );
        });

        await batch.commit();
    }

    console.log("✅ Finished seeding market_types, market_categories, market_items");
}
