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
    deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MarketTypeDoc } from "@/app/shared/marketCatalogTypes";
import { MarketType } from "@/utils/market_master_catalog";

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
        setEditingType({ ...row });
    };

    const handleCreateType = () => {
        setEditingType({ ...EMPTY_TYPE });
    };

    const handleSaveType = async () => {
        if (!editingType) return;
        const id = editingType.id as MarketType;
        const ref = doc(db, "market_types", id);
        await setDoc(ref, editingType, { merge: true });
        setEditingType(null);
    };

    const handleDeleteType = async (row: MarketTypeDoc) => {
        if (!window.confirm(`Soft delete type "${row.id}" (set active: false)?`))
            return;
        const ref = doc(db, "market_types", row.id);
        await setDoc(ref, { active: false }, { merge: true });
    };

    /* ---------- Category handlers ---------- */

    const handleEditCategory = (row: MarketCategoryDoc) => {
        setEditingCategory({ ...row });
    };

    const handleCreateCategory = () => {
        setEditingCategory({ ...EMPTY_CATEGORY });
    };

    const handleSaveCategory = async () => {
        if (!editingCategory) return;

        const baseName = editingCategory.name.trim();
        if (!baseName) {
            alert("Category name is required");
            return;
        }

        const typeId = editingCategory.typeId as MarketType;

        const id =
            editingCategory.id && editingCategory.id.trim().length > 0
                ? editingCategory.id.trim()
                : `${typeId}_${slugify(baseName)}`;

        const ref = doc(db, "market_categories", id);
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
    };

    const handleDeleteCategory = async (row: MarketCategoryDoc) => {
        if (!window.confirm(`Soft delete category "${row.name}"?`)) return;
        const ref = doc(db, "market_categories", row.id);
        await setDoc(ref, { active: false }, { merge: true });
    };

    /* ---------- Item handlers ---------- */

    const handleEditItem = (row: MarketItemDoc) => {
        setEditingItem({ ...row });
    };

    const handleCreateItem = () => {
        setEditingItem({ ...EMPTY_ITEM });
    };

    const handleSaveItem = async () => {
        if (!editingItem) return;

        const baseName = editingItem.name.trim();
        const baseCat = editingItem.category.trim();
        if (!baseName || !baseCat) {
            alert("Item name and category are required");
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
        } catch (err) {
            console.error("Error saving item:", err);
            alert("Failed to save item – see console for details.");
        }
    };

    const handleDeleteItem = async (row: MarketItemDoc) => {
        if (!window.confirm(`Soft delete item "${row.name}"?`)) return;
        const ref = doc(db, "market_items", row.id);
        await setDoc(ref, { active: false }, { merge: true });
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

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-xl font-bold">
                Market Catalog – Types, Categories & Items
            </h1>

            {/* ---------- Types ---------- 
            <section className="space-y-2">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold">Types</h2>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1 text-xs text-gray-600">
                            <input
                                type="checkbox"
                                checked={showArchivedTypes}
                                onChange={(e) => setShowArchivedTypes(e.target.checked)}
                            />
                            <span>Show archived</span>
                        </label>
                        <button
                            className="px-3 py-1 rounded bg-emerald-600 text-white text-sm"
                            onClick={handleCreateType}
                        >
                            + New Type
                        </button>
                    </div>
                </div>

                <table className="w-full text-sm border">
                    <thead>
                        <tr className="bg-gray-50">
                            <th className="p-2 text-left">ID</th>
                            <th className="p-2 text-left">Label</th>
                            <th className="p-2 text-left">Order</th>
                            <th className="p-2 text-left">Active</th>
                            <th className="p-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {visibleTypes.map((t) => (
                            <tr key={t.id} className="border-t">
                                <td className="p-2">{t.id}</td>
                                <td className="p-2">{t.label}</td>
                                <td className="p-2">{t.order}</td>
                                <td className="p-2">{t.active ? "Yes" : "No"}</td>
                                <td className="p-2 text-right space-x-2">
                                    <button
                                        className="text-emerald-700 text-xs underline"
                                        onClick={() => handleEditType(t)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        className="text-red-600 text-xs underline"
                                        onClick={() => handleDeleteType(t)}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {visibleTypes.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-3 text-center text-gray-500">
                                    No types found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </section>*/}

            {/* ---------- Categories ---------- */}
            <section className="space-y-2">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold">Categories</h2>
                    <div className="flex items-center gap-3">
                        <select
                            className="border rounded px-2 py-1 text-sm"
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
                        <label className="flex items-center gap-1 text-xs text-gray-600">
                            <input
                                type="checkbox"
                                checked={showArchivedCategories}
                                onChange={(e) => setShowArchivedCategories(e.target.checked)}
                            />
                            <span>Show archived</span>
                        </label>
                        <button
                            className="px-3 py-1 rounded bg-emerald-600 text-white text-sm"
                            onClick={handleCreateCategory}
                        >
                            + New Category
                        </button>
                    </div>
                </div>

                <table className="w-full text-sm border">
                    <thead>
                        <tr className="bg-gray-50">
                            <th className="p-2 text-left">ID</th>
                            <th className="p-2 text-left">Type</th>
                            <th className="p-2 text-left">Name</th>
                            <th className="p-2 text-left">Order</th>
                            <th className="p-2 text-left">Active</th>
                            <th className="p-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCategories.map((c) => (
                            <tr key={c.id} className="border-t">
                                <td className="p-2 max-w-[220px] truncate" title={c.id}>
                                    {c.id}
                                </td>
                                <td className="p-2">{c.typeId}</td>
                                <td className="p-2">{c.name}</td>
                                <td className="p-2">{c.order ?? ""}</td>
                                <td className="p-2">{c.active ? "Yes" : "No"}</td>
                                <td className="p-2 text-right space-x-2">
                                    <button
                                        className="text-emerald-700 text-xs underline"
                                        onClick={() => handleEditCategory(c)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        className="text-red-600 text-xs underline"
                                        onClick={() => handleDeleteCategory(c)}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredCategories.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-3 text-center text-gray-500">
                                    No categories found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </section>

            {/* ---------- Items ---------- */}
            <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-semibold">Items</h2>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="text"
                            placeholder="Search by name or category"
                            className="border rounded px-2 py-1 text-xs md:text-sm w-40 md:w-60"
                            value={itemSearch}
                            onChange={(e) => setItemSearch(e.target.value)}
                        />
                        <select
                            className="border rounded px-2 py-1 text-sm"
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
                        <label className="flex items-center gap-1 text-xs text-gray-600">
                            <input
                                type="checkbox"
                                checked={showArchivedItems}
                                onChange={(e) => setShowArchivedItems(e.target.checked)}
                            />
                            <span>Show archived</span>
                        </label>
                        <button
                            className="px-3 py-1 rounded bg-emerald-600 text-white text-sm"
                            onClick={handleCreateItem}
                        >
                            + New Item
                        </button>
                    </div>
                </div>

                <table className="w-full text-xs border">
                    <thead>
                        <tr className="bg-gray-50">
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
                            <tr key={i.id} className="border-t">
                                <td className="p-2 max-w-[220px] truncate" title={i.id}>
                                    {i.id}
                                </td>
                                <td className="p-2">{i.type}</td>
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
                                        className="text-emerald-700 text-xs underline"
                                        onClick={() => handleEditItem(i)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        className="text-red-600 text-xs underline"
                                        onClick={() => handleDeleteItem(i)}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {pagedItems.length === 0 && (
                            <tr>
                                <td colSpan={9} className="p-3 text-center text-gray-500">
                                    No items found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Pagination controls */}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                    <div>
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
                            className="px-2 py-1 border rounded disabled:opacity-40"
                            disabled={itemPage <= 1}
                            onClick={() => setItemPage((p) => Math.max(1, p - 1))}
                        >
                            Previous
                        </button>
                        <span>
                            Page {itemPage} of {totalItemPages}
                        </span>
                        <button
                            className="px-2 py-1 border rounded disabled:opacity-40"
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
                    <div className="bg-white rounded-lg shadow p-4 w-full max-w-md space-y-3">
                        <h3 className="font-semibold">
                            {types.find((t) => t.id === editingType.id)
                                ? "Edit Type"
                                : "New Type"}
                        </h3>

                        <label className="block text-sm">
                            <span className="block text-xs text-gray-500 mb-1">ID</span>
                            <input
                                className="w-full border rounded px-2 py-1 text-sm"
                                value={editingType.id}
                                onChange={(e) =>
                                    setEditingType((prev: any) =>
                                        prev ? { ...prev, id: e.target.value as MarketType } : prev
                                    )
                                }
                            />
                        </label>

                        <label className="block text-sm">
                            <span className="block text-xs text-gray-500 mb-1">Label</span>
                            <input
                                className="w-full border rounded px-2 py-1 text-sm"
                                value={editingType.label}
                                onChange={(e) =>
                                    setEditingType((prev) =>
                                        prev ? { ...prev, label: e.target.value } : prev
                                    )
                                }
                            />
                        </label>

                        <label className="block text-sm">
                            <span className="block text-xs text-gray-500 mb-1">Order</span>
                            <input
                                type="number"
                                className="w-full border rounded px-2 py-1 text-sm"
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

                        <label className="inline-flex items-center text-sm space-x-2">
                            <input
                                type="checkbox"
                                checked={editingType.active}
                                onChange={(e) =>
                                    setEditingType((prev) =>
                                        prev ? { ...prev, active: e.target.checked } : prev
                                    )
                                }
                            />
                            <span>Active</span>
                        </label>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                className="px-3 py-1 text-sm rounded border"
                                onClick={() => setEditingType(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-3 py-1 text-sm rounded bg-emerald-600 text-white"
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
                    <div className="bg-white rounded-lg shadow p-4 w-full max-w-md space-y-3">
                        <h3 className="font-semibold">
                            {categories.find((c) => c.id === editingCategory.id)
                                ? "Edit Category"
                                : "New Category"}
                        </h3>

                        <label className="block text-sm">
                            <span className="block text-xs text-gray-500 mb-1">
                                ID (auto if empty for new)
                            </span>
                            <input
                                className="w-full border rounded px-2 py-1 text-sm"
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
                            <span className="block text-xs text-gray-500 mb-1">Type</span>
                            <select
                                className="w-full border rounded px-2 py-1 text-sm"
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
                            <span className="block text-xs text-gray-500 mb-1">Name</span>
                            <input
                                className="w-full border rounded px-2 py-1 text-sm"
                                value={editingCategory.name}
                                onChange={(e) =>
                                    setEditingCategory((prev) =>
                                        prev ? { ...prev, name: e.target.value } : prev
                                    )
                                }
                            />
                        </label>

                        <label className="block text-sm">
                            <span className="block text-xs text-gray-500 mb-1">Order</span>
                            <input
                                type="number"
                                className="w-full border rounded px-2 py-1 text-sm"
                                value={editingCategory.order ?? 0}
                                onChange={(e) =>
                                    setEditingCategory((prev) =>
                                        prev
                                            ? { ...prev, order: Number(e.target.value) || 0 }
                                            : prev
                                    )
                                }
                            />
                        </label>

                        <label className="inline-flex items-center text-sm space-x-2">
                            <input
                                type="checkbox"
                                checked={editingCategory.active !== false}
                                onChange={(e) =>
                                    setEditingCategory((prev) =>
                                        prev ? { ...prev, active: e.target.checked } : prev
                                    )
                                }
                            />
                            <span>Active</span>
                        </label>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                className="px-3 py-1 text-sm rounded border"
                                onClick={() => setEditingCategory(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-3 py-1 text-sm rounded bg-emerald-600 text-white"
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
                    <div className="bg-white rounded-lg shadow p-4 w-full max-w-lg space-y-3 text-sm">
                        <h3 className="font-semibold">
                            {items.find((i) => i.id === editingItem.id)
                                ? "Edit Item"
                                : "New Item"}
                        </h3>

                        <label className="block">
                            <span className="block text-xs text-gray-500 mb-1">
                                ID (auto if empty for new)
                            </span>
                            <input
                                className="w-full border rounded px-2 py-1 text-sm"
                                value={editingItem.id}
                                onChange={(e) =>
                                    setEditingItem((prev) =>
                                        prev ? { ...prev, id: e.target.value } : prev
                                    )
                                }
                                placeholder="Leave blank to auto-generate"
                            />
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                                <span className="block text-xs text-gray-500 mb-1">Type</span>
                                <select
                                    className="w-full border rounded px-2 py-1 text-sm"
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
                                <span className="block text-xs text-gray-500 mb-1">
                                    Category
                                </span>
                                {itemModalCategories.length > 0 ? (
                                    <select
                                        className="w-full border rounded px-2 py-1 text-sm"
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
                                        className="w-full border rounded px-2 py-1 text-sm"
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

                        <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                                <span className="block text-xs text-gray-500 mb-1">Name</span>
                                <input
                                    className="w-full border rounded px-2 py-1 text-sm"
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
                                <span className="block text-xs text-gray-500 mb-1">
                                    Variety (optional)
                                </span>
                                <input
                                    className="w-full border rounded px-2 py-1 text-sm"
                                    value={editingItem.variety ?? ""}
                                    onChange={(e) =>
                                        setEditingItem((prev) =>
                                            prev ? { ...prev, variety: e.target.value || null } : prev
                                        )
                                    }
                                    placeholder="e.g. Hybrid"
                                />
                            </label>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                                <span className="block text-xs text-gray-500 mb-1">
                                    Typical Pack Size
                                </span>
                                <input
                                    className="w-full border rounded px-2 py-1 text-sm"
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
                                <span className="block text-xs text-gray-500 mb-1">Unit</span>
                                <input
                                    className="w-full border rounded px-2 py-1 text-sm"
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
                            <span className="block text-xs text-gray-500 mb-1">
                                Use-case (optional)
                            </span>
                            <textarea
                                className="w-full border rounded px-2 py-1 text-sm"
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

                        <label className="inline-flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={editingItem.active !== false}
                                onChange={(e) =>
                                    setEditingItem((prev) =>
                                        prev ? { ...prev, active: e.target.checked } : prev
                                    )
                                }
                            />
                            <span>Active</span>
                        </label>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                className="px-3 py-1 text-sm rounded border"
                                onClick={() => setEditingItem(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-3 py-1 text-sm rounded bg-emerald-600 text-white"
                                onClick={handleSaveItem}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
