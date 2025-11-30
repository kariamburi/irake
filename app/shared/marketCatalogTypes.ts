// shared/marketCatalogTypes.ts

import { MarketType } from "./market_master_catalog";
export type MarketTypeDoc = {
    id: MarketType;
    label: string;
    description?: string;
    iconName?: string;
    order: number;
    active: boolean;
};

export type MarketCategoryDoc = {
    id: string;
    typeId: MarketType;
    name: string;
    description?: string;
    order: number;
    active: boolean;
};

export type CategoryOptionsByType = Record<MarketType, string[]>;
