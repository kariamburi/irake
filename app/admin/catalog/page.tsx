// app/admin/catalog/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MarketTypeDoc } from "@/app/shared/marketCatalogTypes";
import { MarketType } from "@/utils/market_master_catalog";
import { ConfirmModal } from "@/app/components/ConfirmModal";

/* --------- Brand --------- */
const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    hair: "#E5E7EB",
    text: "#0F172A",
    dim: "#6B7280",
    danger: "#B42318",
};

/* --------- Local types for categories & items --------- */

type MarketCategoryDoc = {
    id: string;
    typeId: MarketType;
    name: string;
    description?: string;
    order?: number;
    active?: boolean;
};

type MarketItemDoc = {
    id: string;
    type: MarketType;
    category: string;
    subCategory?: string | null;
    name: string;
    nameLower?: string;
    categoryLower?: string;
    variety?: string | null;
    form?: string | null;
    useCase?: string | null;
    typicalPackSize?: string | number | null;
    unit?: string | null;
    grade?: string | null;
    extras?: Record<string, string>;
    active?: boolean;
};

type BannerState =
    | { type: "success"; message: string }
    | { type: "error"; message: string }
    | { type: "info"; message: string }
    | null;

/* --------- Helpers --------- */

const EMPTY_TYPE: MarketTypeDoc = {
    id: "product",
    label: "",
    order: 0,
    active: true,
};

const EMPTY_CATEGORY: MarketCategoryDoc = {
    id: "",
    typeId: "product",
    name: "",
    order: 0,
    active: true,
};

const EMPTY_ITEM: MarketItemDoc = {
    id: "",
    type: "product",
    category: "",
    name: "",
    active: true,
    subCategory: null,
    variety: null,
    form: null,
    useCase: null,
    typicalPackSize: null,
    unit: null,
    grade: null,
    extras: {},
};

function slugify(input: string): string {
    return input
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

const TYPE_LABEL: Record<MarketType, string> = {
    product: "Product",
    animal: "Animal & Livestock",
    tree: "Trees",
    lease: "Lease & Equipment",
    service: "Service",
    arableLand: "Arable Land",
};

/* How many items per page in Items table */
const ITEMS_PER_PAGE = 50;

export default function AdminCatalogPage() {
    /* ---------- Banner + confirm modal ---------- */
    const [banner, setBanner] = useState<BannerState>(null);
    const [confirmConfig, setConfirmConfig] = useState<{
        title: string;
        message: string;
        confirmText?: string;
        cancelText?: string;
        onConfirm: () => void;
    } | null>(null);

    const showError = (message: string) =>
        setBanner({ type: "error", message });
    const showSuccess = (message: string) =>
        setBanner({ type: "success", message });
    const showInfo = (message: string) =>
        setBanner({ type: "info", message });
    const clearBanner = () => setBanner(null);

    /* ---------- Types ---------- */
    const [types, setTypes] = useState<MarketTypeDoc[]>([]);
    const [editingType, setEditingType] = useState<MarketTypeDoc | null>(null);
    const [showArchivedTypes, setShowArchivedTypes] = useState(false);

    /* ---------- Categories ---------- */
    const [categories, setCategories] = useState<MarketCategoryDoc[]>([]);
    const [editingCategory, setEditingCategory] =
        useState<MarketCategoryDoc | null>(null);
    const [categoryFilterType, setCategoryFilterType] =
        useState<MarketType | "all">("all");
    const [showArchivedCategories, setShowArchivedCategories] = useState(false);

    /* ---------- Items ---------- */
    const [items, setItems] = useState<MarketItemDoc[]>([]);
    const [editingItem, setEditingItem] = useState<MarketItemDoc | null>(null);
    const [itemFilterType, setItemFilterType] =
        useState<MarketType | "all">("all");
    const [showArchivedItems, setShowArchivedItems] = useState(false);
    const [itemSearch, setItemSearch] = useState<string>("");

    // pagination state for Items
    const [itemPage, setItemPage] = useState<number>(1);

    /* ---------- Firestore listeners ---------- */

    useEffect(() => {
        // market_types
        const ref = collection(db, "market_types");
        const q = query(ref, orderBy("order", "asc"));

        const unsub = onSnapshot(q, (snap) => {
            const rows: MarketTypeDoc[] = [];
            snap.forEach((d) => rows.push(d.data() as MarketTypeDoc));
            setTypes(rows);
        });

        return () => unsub();
    }, []);

    useEffect(() => {
        // market_categories
        const ref = collection(db, "market_categories");
        const q = query(ref, orderBy("order", "asc"));

        const unsub = onSnapshot(q, (snap) => {
            const rows: MarketCategoryDoc[] = [];
            snap.forEach((d) => rows.push(d.data() as MarketCategoryDoc));
            setCategories(rows);
        });

        return () => unsub();
    }, []);

    useEffect(() => {
        // market_items
        const ref = collection(db, "market_items");
        const q = query(ref, orderBy("nameLower", "asc"));

        const unsub = onSnapshot(q, (snap) => {
            const rows: MarketItemDoc[] = [];
            snap.forEach((d) => rows.push(d.data() as MarketItemDoc));
            setItems(rows);
        });

        return () => unsub();
    }, []);

    /* ---------- Derived lists / sorted ---------- */

    // Types sorted alphabetically by label (fallback id)
    const sortedTypes = useMemo(
        () =>
            [...types].sort((a, b) =>
                (a.label || a.id).localeCompare(b.label || b.id, undefined, {
                    sensitivity: "base",
                })
            ),
        [types]
    );

    const visibleTypes = useMemo(
        () =>
            sortedTypes.filter((t) =>
                showArchivedTypes ? true : t.active !== false
            ),
        [sortedTypes, showArchivedTypes]
    );

    const typeOptions: MarketType[] = useMemo(
        () =>
            (sortedTypes.map((t) => t.id) as MarketType[]).length
                ? (sortedTypes.map((t) => t.id) as MarketType[])
                : ([
                    "product",
                    "animal",
                    "tree",
                    "lease",
                    "service",
                    "arableLand",
                ] as MarketType[]),
        [sortedTypes]
    );

    const sortedCategories = useMemo(
        () =>
            [...categories].sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
            ),
        [categories]
    );

    const filteredCategories = useMemo(() => {
        let list =
            categoryFilterType === "all"
                ? sortedCategories
                : sortedCategories.filter((c) => c.typeId === categoryFilterType);

        if (!showArchivedCategories) {
            list = list.filter((c) => c.active !== false);
        }

        return list;
    }, [sortedCategories, categoryFilterType, showArchivedCategories]);

    const sortedItems = useMemo(
        () =>
            [...items].sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
            ),
        [items]
    );

    const filteredItems = useMemo(() => {
        let list =
            itemFilterType === "all"
                ? sortedItems
                : sortedItems.filter((i) => i.type === itemFilterType);

        if (!showArchivedItems) {
            list = list.filter((i) => i.active !== false);
        }

        return list;
    }, [sortedItems, itemFilterType, showArchivedItems]);

    const searchedItems = useMemo(() => {
        const term = itemSearch.trim().toLowerCase();
        if (!term) return filteredItems;

        return filteredItems.filter((i) => {
            const name = (i.name || "").toLowerCase();
            const cat = (i.category || "").toLowerCase();
            return name.includes(term) || cat.includes(term);
        });
    }, [filteredItems, itemSearch]);

    // pagination derived values
    const totalItemPages = useMemo(
        () => Math.max(1, Math.ceil(searchedItems.length / ITEMS_PER_PAGE)),
        [searchedItems.length]
    );

    const pagedItems = useMemo(() => {
        const page = Math.min(Math.max(1, itemPage), totalItemPages);
        const start = (page - 1) * ITEMS_PER_PAGE;
        return searchedItems.slice(start, start + ITEMS_PER_PAGE);
    }, [searchedItems, itemPage, totalItemPages]);

    // When filters / search change, go back to page 1
    useEffect(() => {
        setItemPage(1);
    }, [itemFilterType, showArchivedItems, itemSearch]);

    // If total pages shrinks below current page, clamp it
    useEffect(() => {
        setItemPage((prev) => Math.min(prev, totalItemPages));
    }, [totalItemPages]);

    /* ---------- Type handlers ---------- */

    const handleEditType = (row: MarketTypeDoc) => {
        clearBanner();
        setEditingType({ ...row });
    };

    const handleCreateType = () => {
        clearBanner();
        setEditingType({ ...EMPTY_TYPE });
    };

    const handleSaveType = async () => {
        if (!editingType) return;
        clearBanner();

        const id = editingType.id as MarketType;
        const ref = doc(db, "market_types", id);
        try {
            await setDoc(ref, editingType, { merge: true });
            setEditingType(null);
            showSuccess("Type saved successfully.");
        } catch (err: any) {
            console.error("Error saving type:", err);
            showError(err?.message || "Failed to save type. Please try again.");
        }
    };

    const handleDeleteType = (row: MarketTypeDoc) => {
        const ref = doc(db, "market_types", row.id);
        setConfirmConfig({
            title: "Archive type",
            message: `Soft-delete type "${TYPE_LABEL[row.id as MarketType] ?? row.id}"? It will be hidden from selection but kept in the database.`,
            confirmText: "Archive",
            cancelText: "Cancel",
            onConfirm: async () => {
                setConfirmConfig(null);
                clearBanner();
                try {
                    await setDoc(ref, { active: false }, { merge: true });
                    showSuccess("Type archived.");
                } catch (err: any) {
                    console.error("Error archiving type:", err);
                    showError(err?.message || "Failed to archive type.");
                }
            },
        });
    };

    /* ---------- Category handlers ---------- */

    const handleEditCategory = (row: MarketCategoryDoc) => {
        clearBanner();
        setEditingCategory({ ...row });
    };

    const handleCreateCategory = () => {
        clearBanner();
        setEditingCategory({ ...EMPTY_CATEGORY });
    };

    const handleSaveCategory = async () => {
        if (!editingCategory) return;
        clearBanner();

        const baseName = editingCategory.name.trim();
        if (!baseName) {
            showError("Category name is required.");
            return;
        }

        const typeId = editingCategory.typeId as MarketType;
        const id =
            editingCategory.id && editingCategory.id.trim().length > 0
                ? editingCategory.id.trim()
                : `${typeId}_${slugify(baseName)}`;

        const ref = doc(db, "market_categories", id);
        try {
            await setDoc(
                ref,
                {
                    ...editingCategory,
                    id,
                    typeId,
                    name: baseName,
                },
                { merge: true }
            );
            setEditingCategory(null);
            showSuccess("Category saved successfully.");
        } catch (err: any) {
            console.error("Error saving category:", err);
            showError(err?.message || "Failed to save category. Please try again.");
        }
    };

    const handleDeleteCategory = (row: MarketCategoryDoc) => {
        const ref = doc(db, "market_categories", row.id);
        setConfirmConfig({
            title: "Archive category",
            message: `Soft-delete category "${row.name}"? It will be hidden from selection but kept in the database.`,
            confirmText: "Archive",
            cancelText: "Cancel",
            onConfirm: async () => {
                setConfirmConfig(null);
                clearBanner();
                try {
                    await setDoc(ref, { active: false }, { merge: true });
                    showSuccess("Category archived.");
                } catch (err: any) {
                    console.error("Error archiving category:", err);
                    showError(err?.message || "Failed to archive category.");
                }
            },
        });
    };

    /* ---------- Item handlers ---------- */

    const handleEditItem = (row: MarketItemDoc) => {
        clearBanner();
        setEditingItem({ ...row });
    };

    const handleCreateItem = () => {
        clearBanner();
        setEditingItem({ ...EMPTY_ITEM });
    };

    const handleSaveItem = async () => {
        if (!editingItem) return;
        clearBanner();

        const baseName = editingItem.name.trim();
        const baseCat = editingItem.category.trim();
        if (!baseName || !baseCat) {
            showError("Item name and category are required.");
            return;
        }

        const type = editingItem.type as MarketType;

        const catSlug = slugify(baseCat);
        const nameSlug = slugify(baseName);
        const varietySlug = editingItem.variety ? slugify(editingItem.variety) : "";

        const parts = [type, catSlug, nameSlug, varietySlug].filter(Boolean);
        const id =
            editingItem.id && editingItem.id.trim().length > 0
                ? editingItem.id.trim()
                : parts.join("_");

        const ref = doc(db, "market_items", id);
        try {
            await setDoc(
                ref,
                {
                    ...editingItem,
                    id,
                    type,
                    category: baseCat,
                    name: baseName,
                    nameLower: baseName.toLowerCase(),
                    categoryLower: baseCat.toLowerCase(),
                },
                { merge: true }
            );
            setEditingItem(null);
            showSuccess("Item saved successfully.");
        } catch (err) {
            console.error("Error saving item:", err);
            showError("Failed to save item – please try again.");
        }
    };

    const handleDeleteItem = (row: MarketItemDoc) => {
        const ref = doc(db, "market_items", row.id);
        setConfirmConfig({
            title: "Archive item",
            message: `Soft-delete item "${row.name}"? It will be hidden from selection but kept in the database.`,
            confirmText: "Archive",
            cancelText: "Cancel",
            onConfirm: async () => {
                setConfirmConfig(null);
                clearBanner();
                try {
                    await setDoc(ref, { active: false }, { merge: true });
                    showSuccess("Item archived.");
                } catch (err: any) {
                    console.error("Error archiving item:", err);
                    showError(err?.message || "Failed to archive item.");
                }
            },
        });
    };

    /* ---------- Category options for Item modal ---------- */
    const categoriesByType = useMemo(() => {
        const map: Record<MarketType, MarketCategoryDoc[]> = {
            product: [],
            animal: [],
            tree: [],
            lease: [],
            service: [],
            arableLand: [],
        };
        for (const c of categories) {
            if (!c.typeId || !map[c.typeId]) continue;
            if (c.active === false) continue;
            map[c.typeId].push(c);
        }
        (Object.keys(map) as MarketType[]).forEach((t) => {
            map[t] = map[t].sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
            );
        });
        return map;
    }, [categories]);

    const itemModalCategories: MarketCategoryDoc[] = useMemo(() => {
        if (!editingItem) return [];
        return categoriesByType[editingItem.type] || [];
    }, [categoriesByType, editingItem]);

    /* ---------- Banner styling ---------- */
    const bannerBg =
        banner?.type === "error"
            ? "#FEF2F2"
            : banner?.type === "success"
                ? "#ECFDF3"
                : "#DBEAFE";
    const bannerText =
        banner?.type === "error"
            ? "#B91C1C"
            : banner?.type === "success"
                ? "#166534"
                : "#1D4ED8";
    const bannerBorder =
        banner?.type === "error"
            ? "#FECACA"
            : banner?.type === "success"
                ? "#BBF7D0"
                : "#BFDBFE";

    return (
        <>
            <div
                className="p-4 md:p-6 space-y-6"
                style={{ backgroundColor: "#F9FAFB" }}
            >
                {/* HEADER */}
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
                    <div>
                        <h1
                            className="text-xl md:text-2xl font-extrabold"
                            style={{ color: EKARI.text }}
                        >
                            Market catalog
                        </h1>
                        <p className="text-sm" style={{ color: EKARI.dim }}>
                            Manage types, categories and items used by Ekarihub market
                            features. Categories &amp; items are ordered alphabetically.
                        </p>
                    </div>
                </div>

                {/* BANNER */}
                {banner && (
                    <div
                        className="rounded-xl px-3 py-2 text-xs flex items-start justify-between gap-2"
                        style={{
                            backgroundColor: bannerBg,
                            color: bannerText,
                            border: `1px solid ${bannerBorder}`,
                        }}
                    >
                        <div>{banner.message}</div>
                        <button
                            type="button"
                            onClick={clearBanner}
                            className="text-[11px] font-bold"
                        >
                            ×
                        </button>
                    </div>
                )}

                {/* TYPES */}
                <section
                    className="rounded-2xl border bg-white shadow-sm p-4 space-y-3"
                    style={{ borderColor: EKARI.hair }}
                >
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <h2
                                className="text-sm font-extrabold"
                                style={{ color: EKARI.text }}
                            >
                                Types
                            </h2>
                            <p className="text-xs" style={{ color: EKARI.dim }}>
                                High-level groupings for the catalog (product, animal, land,
                                etc).
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1 text-xs">
                                <input
                                    type="checkbox"
                                    checked={showArchivedTypes}
                                    onChange={(e) => setShowArchivedTypes(e.target.checked)}
                                />
                                <span style={{ color: EKARI.dim }}>Show archived</span>
                            </label>

                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs md:text-sm border rounded-xl overflow-hidden">
                            <thead>
                                <tr
                                    className="bg-gray-50 text-gray-600"
                                    style={{ backgroundColor: "#F9FAFB" }}
                                >
                                    <th className="p-2 text-left">ID</th>
                                    <th className="p-2 text-left">Label</th>



                                </tr>
                            </thead>
                            <tbody>
                                {visibleTypes.map((t) => (
                                    <tr
                                        key={t.id}
                                        className="border-t"
                                        style={{ borderColor: EKARI.hair }}
                                    >
                                        <td className="p-2">{t.id}</td>
                                        <td className="p-2">{t.label}</td>


                                    </tr>
                                ))}
                                {visibleTypes.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="p-3 text-center text-xs"
                                            style={{ color: EKARI.dim }}
                                        >
                                            No types found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* CATEGORIES */}
                <section
                    className="rounded-2xl border bg-white shadow-sm p-4 space-y-3"
                    style={{ borderColor: EKARI.hair }}
                >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h2
                                className="text-sm font-extrabold"
                                style={{ color: EKARI.text }}
                            >
                                Categories
                            </h2>
                            <p className="text-xs" style={{ color: EKARI.dim }}>
                                Group items inside each type. Displayed alphabetically for
                                users.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <select
                                className="border rounded-full px-3 py-1 text-xs md:text-sm"
                                value={categoryFilterType}
                                onChange={(e) =>
                                    setCategoryFilterType(
                                        (e.target.value as MarketType | "all") || "all"
                                    )
                                }
                            >
                                <option value="all">All types</option>
                                {typeOptions.map((t) => (
                                    <option key={t} value={t}>
                                        {TYPE_LABEL[t] ?? t}
                                    </option>
                                ))}
                            </select>
                            <label className="flex items-center gap-1 text-xs">
                                <input
                                    type="checkbox"
                                    checked={showArchivedCategories}
                                    onChange={(e) => setShowArchivedCategories(e.target.checked)}
                                />
                                <span style={{ color: EKARI.dim }}>Show archived</span>
                            </label>
                            <button
                                className="px-3 py-1.5 rounded-full text-xs font-semibold"
                                style={{
                                    backgroundColor: EKARI.forest,
                                    color: EKARI.sand,
                                }}
                                onClick={handleCreateCategory}
                            >
                                + New category
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs md:text-sm border rounded-xl overflow-hidden">
                            <thead>
                                <tr
                                    className="bg-gray-50 text-gray-600"
                                    style={{ backgroundColor: "#F9FAFB" }}
                                >
                                    <th className="p-2 text-left">ID</th>
                                    <th className="p-2 text-left">Type</th>
                                    <th className="p-2 text-left">Name</th>
                                    <th className="p-2 text-left">Active</th>
                                    <th className="p-2" />
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCategories.map((c) => (
                                    <tr
                                        key={c.id}
                                        className="border-t"
                                        style={{ borderColor: EKARI.hair }}
                                    >
                                        <td className="p-2 max-w-[220px] truncate" title={c.id}>
                                            {c.id}
                                        </td>
                                        <td className="p-2">{TYPE_LABEL[c.typeId] ?? c.typeId}</td>
                                        <td className="p-2">{c.name}</td>
                                        <td className="p-2">{c.active ? "Yes" : "No"}</td>
                                        <td className="p-2 text-right space-x-2">
                                            <button
                                                className="text-emerald-700 text-xs font-semibold"
                                                onClick={() => handleEditCategory(c)}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                className="text-red-600 text-xs font-semibold"
                                                onClick={() => handleDeleteCategory(c)}
                                            >
                                                Archive
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredCategories.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="p-3 text-center text-xs"
                                            style={{ color: EKARI.dim }}
                                        >
                                            No categories found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* ITEMS */}
                <section
                    className="rounded-2xl border bg-white shadow-sm p-4 space-y-3"
                    style={{ borderColor: EKARI.hair }}
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2
                                className="text-sm font-extrabold"
                                style={{ color: EKARI.text }}
                            >
                                Items
                            </h2>
                            <p className="text-xs" style={{ color: EKARI.dim }}>
                                Concrete things people can list in the market, ordered
                                alphabetically by name.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                type="text"
                                placeholder="Search by name or category"
                                className="border rounded-full px-3 py-1 text-xs md:text-sm w-40 md:w-60"
                                value={itemSearch}
                                onChange={(e) => setItemSearch(e.target.value)}
                            />
                            <select
                                className="border rounded-full px-3 py-1 text-xs md:text-sm"
                                value={itemFilterType}
                                onChange={(e) =>
                                    setItemFilterType(
                                        (e.target.value as MarketType | "all") || "all"
                                    )
                                }
                            >
                                <option value="all">All types</option>
                                {typeOptions.map((t) => (
                                    <option key={t} value={t}>
                                        {TYPE_LABEL[t] ?? t}
                                    </option>
                                ))}
                            </select>
                            <label className="flex items-center gap-1 text-xs">
                                <input
                                    type="checkbox"
                                    checked={showArchivedItems}
                                    onChange={(e) => setShowArchivedItems(e.target.checked)}
                                />
                                <span style={{ color: EKARI.dim }}>Show archived</span>
                            </label>
                            <button
                                className="px-3 py-1.5 rounded-full text-xs font-semibold"
                                style={{
                                    backgroundColor: EKARI.forest,
                                    color: EKARI.sand,
                                }}
                                onClick={handleCreateItem}
                            >
                                + New item
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-[11px] md:text-xs border rounded-xl overflow-hidden">
                            <thead>
                                <tr
                                    className="bg-gray-50 text-gray-600"
                                    style={{ backgroundColor: "#F9FAFB" }}
                                >
                                    <th className="p-2 text-left">ID</th>
                                    <th className="p-2 text-left">Type</th>
                                    <th className="p-2 text-left">Category</th>
                                    <th className="p-2 text-left">Name</th>
                                    <th className="p-2 text-left">Pack</th>
                                    <th className="p-2 text-left">Unit</th>
                                    <th className="p-2 text-left">Use-case</th>
                                    <th className="p-2 text-left">Active</th>
                                    <th className="p-2" />
                                </tr>
                            </thead>
                            <tbody>
                                {pagedItems.map((i) => (
                                    <tr
                                        key={i.id}
                                        className="border-t"
                                        style={{ borderColor: EKARI.hair }}
                                    >
                                        <td className="p-2 max-w-[220px] truncate" title={i.id}>
                                            {i.id}
                                        </td>
                                        <td className="p-2">{TYPE_LABEL[i.type] ?? i.type}</td>
                                        <td className="p-2">{i.category}</td>
                                        <td className="p-2">{i.name}</td>
                                        <td className="p-2">{i.typicalPackSize ?? ""}</td>
                                        <td className="p-2">{i.unit ?? ""}</td>
                                        <td
                                            className="p-2 max-w-[220px] truncate"
                                            title={i.useCase ?? ""}
                                        >
                                            {i.useCase ?? ""}
                                        </td>
                                        <td className="p-2">{i.active ? "Yes" : "No"}</td>
                                        <td className="p-2 text-right space-x-2">
                                            <button
                                                className="text-emerald-700 text-xs font-semibold"
                                                onClick={() => handleEditItem(i)}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                className="text-red-600 text-xs font-semibold"
                                                onClick={() => handleDeleteItem(i)}
                                            >
                                                Archive
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {pagedItems.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={9}
                                            className="p-3 text-center text-xs"
                                            style={{ color: EKARI.dim }}
                                        >
                                            No items found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination controls */}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] md:text-xs">
                        <div style={{ color: EKARI.dim }}>
                            Showing{" "}
                            {searchedItems.length === 0
                                ? 0
                                : (itemPage - 1) * ITEMS_PER_PAGE + 1}{" "}
                            –{" "}
                            {Math.min(itemPage * ITEMS_PER_PAGE, searchedItems.length)} of{" "}
                            {searchedItems.length} items
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                className="px-2 py-1 border rounded-full disabled:opacity-40 text-xs"
                                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                disabled={itemPage <= 1}
                                onClick={() => setItemPage((p) => Math.max(1, p - 1))}
                            >
                                Previous
                            </button>
                            <span style={{ color: EKARI.dim }}>
                                Page {itemPage} of {totalItemPages}
                            </span>
                            <button
                                className="px-2 py-1 border rounded-full disabled:opacity-40 text-xs"
                                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                disabled={itemPage >= totalItemPages}
                                onClick={() =>
                                    setItemPage((p) => Math.min(totalItemPages, p + 1))
                                }
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </section>

                {/* ---------- Edit Type Modal ---------- */}
                {editingType && (
                    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl shadow-lg p-4 md:p-5 w-full max-w-md space-y-3 border"
                            style={{ borderColor: EKARI.hair }}
                        >
                            <h3
                                className="font-semibold text-sm md:text-base"
                                style={{ color: EKARI.text }}
                            >
                                {types.find((t) => t.id === editingType.id)
                                    ? "Edit type"
                                    : "New type"}
                            </h3>

                            <label className="block text-sm">
                                <span
                                    className="block text-xs mb-1"
                                    style={{ color: EKARI.dim }}
                                >
                                    ID
                                </span>
                                <input
                                    className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                    style={{ borderColor: EKARI.hair }}
                                    value={editingType.id}
                                    onChange={(e) =>
                                        setEditingType((prev: any) =>
                                            prev ? { ...prev, id: e.target.value as MarketType } : prev
                                        )
                                    }
                                />
                            </label>

                            <label className="block text-sm">
                                <span
                                    className="block text-xs mb-1"
                                    style={{ color: EKARI.dim }}
                                >
                                    Label
                                </span>
                                <input
                                    className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                    style={{ borderColor: EKARI.hair }}
                                    value={editingType.label}
                                    onChange={(e) =>
                                        setEditingType((prev) =>
                                            prev ? { ...prev, label: e.target.value } : prev
                                        )
                                    }
                                />
                            </label>

                            <label className="block text-sm">
                                <span
                                    className="block text-xs mb-1"
                                    style={{ color: EKARI.dim }}
                                >
                                    Order
                                </span>
                                <input
                                    type="number"
                                    className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                    style={{ borderColor: EKARI.hair }}
                                    value={editingType.order}
                                    onChange={(e) =>
                                        setEditingType((prev) =>
                                            prev
                                                ? { ...prev, order: Number(e.target.value) || 0 }
                                                : prev
                                        )
                                    }
                                />
                            </label>

                            <label className="inline-flex items-center text-xs font-semibold gap-2">
                                <input
                                    type="checkbox"
                                    checked={editingType.active}
                                    onChange={(e) =>
                                        setEditingType((prev) =>
                                            prev ? { ...prev, active: e.target.checked } : prev
                                        )
                                    }
                                />
                                <span style={{ color: EKARI.text }}>Active</span>
                            </label>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    className="px-3 py-1.5 text-xs md:text-sm rounded-lg border"
                                    style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                    onClick={() => setEditingType(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="px-3 py-1.5 text-xs md:text-sm rounded-lg"
                                    style={{ backgroundColor: EKARI.forest, color: EKARI.sand }}
                                    onClick={handleSaveType}
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ---------- Edit Category Modal ---------- */}
                {editingCategory && (
                    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl shadow-lg p-4 md:p-5 w-full max-w-md space-y-3 border"
                            style={{ borderColor: EKARI.hair }}
                        >
                            <h3
                                className="font-semibold text-sm md:text-base"
                                style={{ color: EKARI.text }}
                            >
                                {categories.find((c) => c.id === editingCategory.id)
                                    ? "Edit category"
                                    : "New category"}
                            </h3>

                            <label className="block text-sm">
                                <span
                                    className="block text-xs mb-1"
                                    style={{ color: EKARI.dim }}
                                >
                                    ID (auto if empty for new)
                                </span>
                                <input
                                    className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                    style={{ borderColor: EKARI.hair }}
                                    value={editingCategory.id}
                                    onChange={(e) =>
                                        setEditingCategory((prev) =>
                                            prev ? { ...prev, id: e.target.value } : prev
                                        )
                                    }
                                    placeholder="Leave blank to auto-generate"
                                />
                            </label>

                            <label className="block text-sm">
                                <span
                                    className="block text-xs mb-1"
                                    style={{ color: EKARI.dim }}
                                >
                                    Type
                                </span>
                                <select
                                    className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                                    style={{ borderColor: EKARI.hair }}
                                    value={editingCategory.typeId}
                                    onChange={(e) =>
                                        setEditingCategory((prev) =>
                                            prev
                                                ? { ...prev, typeId: e.target.value as MarketType }
                                                : prev
                                        )
                                    }
                                >
                                    {typeOptions.map((t) => (
                                        <option key={t} value={t}>
                                            {TYPE_LABEL[t] ?? t}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="block text-sm">
                                <span
                                    className="block text-xs mb-1"
                                    style={{ color: EKARI.dim }}
                                >
                                    Name
                                </span>
                                <input
                                    className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                    style={{ borderColor: EKARI.hair }}
                                    value={editingCategory.name}
                                    onChange={(e) =>
                                        setEditingCategory((prev) =>
                                            prev ? { ...prev, name: e.target.value } : prev
                                        )
                                    }
                                />
                            </label>

                            {/* Order field removed from UI on purpose */}

                            <label className="inline-flex items-center text-xs font-semibold gap-2">
                                <input
                                    type="checkbox"
                                    checked={editingCategory.active !== false}
                                    onChange={(e) =>
                                        setEditingCategory((prev) =>
                                            prev ? { ...prev, active: e.target.checked } : prev
                                        )
                                    }
                                />
                                <span style={{ color: EKARI.text }}>Active</span>
                            </label>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    className="px-3 py-1.5 text-xs md:text-sm rounded-lg border"
                                    style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                    onClick={() => setEditingCategory(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="px-3 py-1.5 text-xs md:text-sm rounded-lg"
                                    style={{ backgroundColor: EKARI.forest, color: EKARI.sand }}
                                    onClick={handleSaveCategory}
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ---------- Edit Item Modal ---------- */}
                {editingItem && (
                    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl shadow-lg p-4 md:p-5 w-full max-w-lg space-y-3 text-sm border"
                            style={{ borderColor: EKARI.hair }}
                        >
                            <h3
                                className="font-semibold text-sm md:text-base"
                                style={{ color: EKARI.text }}
                            >
                                {items.find((i) => i.id === editingItem.id)
                                    ? "Edit item"
                                    : "New item"}
                            </h3>

                            <label className="block">
                                <span
                                    className="block text-xs mb-1"
                                    style={{ color: EKARI.dim }}
                                >
                                    ID (auto if empty for new)
                                </span>
                                <input
                                    className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                    style={{ borderColor: EKARI.hair }}
                                    value={editingItem.id}
                                    onChange={(e) =>
                                        setEditingItem((prev) =>
                                            prev ? { ...prev, id: e.target.value } : prev
                                        )
                                    }
                                    placeholder="Leave blank to auto-generate"
                                />
                            </label>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <label className="block">
                                    <span
                                        className="block text-xs mb-1"
                                        style={{ color: EKARI.dim }}
                                    >
                                        Type
                                    </span>
                                    <select
                                        className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                                        style={{ borderColor: EKARI.hair }}
                                        value={editingItem.type}
                                        onChange={(e) =>
                                            setEditingItem((prev) =>
                                                prev
                                                    ? {
                                                        ...prev,
                                                        type: e.target.value as MarketType,
                                                        category: "",
                                                    }
                                                    : prev
                                            )
                                        }
                                    >
                                        {typeOptions.map((t) => (
                                            <option key={t} value={t}>
                                                {TYPE_LABEL[t] ?? t}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span
                                        className="block text-xs mb-1"
                                        style={{ color: EKARI.dim }}
                                    >
                                        Category
                                    </span>
                                    {itemModalCategories.length > 0 ? (
                                        <select
                                            className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                                            style={{ borderColor: EKARI.hair }}
                                            value={editingItem.category}
                                            onChange={(e) =>
                                                setEditingItem((prev) =>
                                                    prev ? { ...prev, category: e.target.value } : prev
                                                )
                                            }
                                        >
                                            <option value="">Select category…</option>
                                            {itemModalCategories.map((c) => (
                                                <option key={c.id} value={c.name}>
                                                    {c.name}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                            style={{ borderColor: EKARI.hair }}
                                            value={editingItem.category}
                                            onChange={(e) =>
                                                setEditingItem((prev) =>
                                                    prev ? { ...prev, category: e.target.value } : prev
                                                )
                                            }
                                            placeholder="e.g. Cereals"
                                        />
                                    )}
                                </label>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <label className="block">
                                    <span
                                        className="block text-xs mb-1"
                                        style={{ color: EKARI.dim }}
                                    >
                                        Name
                                    </span>
                                    <input
                                        className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                        style={{ borderColor: EKARI.hair }}
                                        value={editingItem.name}
                                        onChange={(e) =>
                                            setEditingItem((prev) =>
                                                prev ? { ...prev, name: e.target.value } : prev
                                            )
                                        }
                                        placeholder="e.g. Maize grain"
                                    />
                                </label>

                                <label className="block">
                                    <span
                                        className="block text-xs mb-1"
                                        style={{ color: EKARI.dim }}
                                    >
                                        Variety (optional)
                                    </span>
                                    <input
                                        className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                        style={{ borderColor: EKARI.hair }}
                                        value={editingItem.variety ?? ""}
                                        onChange={(e) =>
                                            setEditingItem((prev) =>
                                                prev
                                                    ? { ...prev, variety: e.target.value || null }
                                                    : prev
                                            )
                                        }
                                        placeholder="e.g. Hybrid"
                                    />
                                </label>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <label className="block">
                                    <span
                                        className="block text-xs mb-1"
                                        style={{ color: EKARI.dim }}
                                    >
                                        Typical pack size
                                    </span>
                                    <input
                                        className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                        style={{ borderColor: EKARI.hair }}
                                        value={
                                            editingItem.typicalPackSize != null
                                                ? String(editingItem.typicalPackSize)
                                                : ""
                                        }
                                        onChange={(e) =>
                                            setEditingItem((prev) =>
                                                prev
                                                    ? {
                                                        ...prev,
                                                        typicalPackSize: e.target.value
                                                            ? Number(e.target.value)
                                                            : null,
                                                    }
                                                    : prev
                                            )
                                        }
                                        placeholder="e.g. 1"
                                    />
                                </label>

                                <label className="block">
                                    <span
                                        className="block text-xs mb-1"
                                        style={{ color: EKARI.dim }}
                                    >
                                        Unit
                                    </span>
                                    <input
                                        className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                        style={{ borderColor: EKARI.hair }}
                                        value={editingItem.unit ?? ""}
                                        onChange={(e) =>
                                            setEditingItem((prev) =>
                                                prev ? { ...prev, unit: e.target.value || null } : prev
                                            )
                                        }
                                        placeholder="e.g. acre, kg, bag"
                                    />
                                </label>
                            </div>

                            <label className="block">
                                <span
                                    className="block text-xs mb-1"
                                    style={{ color: EKARI.dim }}
                                >
                                    Use-case (optional)
                                </span>
                                <textarea
                                    className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                    style={{ borderColor: EKARI.hair }}
                                    rows={2}
                                    value={editingItem.useCase ?? ""}
                                    onChange={(e) =>
                                        setEditingItem((prev) =>
                                            prev ? { ...prev, useCase: e.target.value || null } : prev
                                        )
                                    }
                                    placeholder="Short note about main use or recommendation"
                                />
                            </label>

                            <label className="inline-flex items-center gap-2 text-xs font-semibold">
                                <input
                                    type="checkbox"
                                    checked={editingItem.active !== false}
                                    onChange={(e) =>
                                        setEditingItem((prev) =>
                                            prev ? { ...prev, active: e.target.checked } : prev
                                        )
                                    }
                                />
                                <span style={{ color: EKARI.text }}>Active</span>
                            </label>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    className="px-3 py-1.5 text-xs md:text-sm rounded-lg border"
                                    style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                    onClick={() => setEditingItem(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="px-3 py-1.5 text-xs md:text-sm rounded-lg"
                                    style={{ backgroundColor: EKARI.forest, color: EKARI.sand }}
                                    onClick={handleSaveItem}
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Confirm modal for archive actions */}
            <ConfirmModal
                open={!!confirmConfig}
                title={confirmConfig?.title || ""}
                message={confirmConfig?.message || ""}
                confirmText={confirmConfig?.confirmText || "Confirm"}
                cancelText={confirmConfig?.cancelText || "Cancel"}
                onConfirm={() => {
                    if (confirmConfig?.onConfirm) {
                        confirmConfig.onConfirm();
                    } else {
                        setConfirmConfig(null);
                    }
                }}
                onCancel={() => setConfirmConfig(null)}
            />
        </>
    );
}
