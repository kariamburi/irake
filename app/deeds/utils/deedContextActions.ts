import type { Deed } from "@/app/deeds/data/deedsFeedWeb";

export type DeedMarketSuggestion = {
    label: string;
    shortLabel: string;
    query: string;
};

function deedContextText(deed?: Deed | null): string {
    if (!deed) return "";

    return [
        deed.text ?? "",
        ...(Array.isArray(deed.tags) ? deed.tags : []),
    ]
        .join(" ")
        .toLowerCase();
}

export function getDeedAiSuggestions(
    deed?: Deed | null
): string[] {
    if (!deed) {
        return [
            "Farming tips",
            "Market advice",
            "Ask ekari AI",
        ];
    }

    const content = deedContextText(deed);

    if (/maize|corn|mahindi/.test(content)) {
        return [
            "Maize growing tips",
            "Best maize fertilizer",
            "Maize pest control",
        ];
    }

    if (/spring onion|spring onions|green onion|green onions|scallion|scallions/.test(content)) {
        return [
            "Spring onion growing tips",
            "Regrow spring onions",
            "Improve spring onion yield",
        ];
    }

    if (/onion|onions/.test(content)) {
        return [
            "Onion farming tips",
            "Onion diseases",
            "Best onion fertilizer",
        ];
    }

    if (/tomato|tomatoes/.test(content)) {
        return [
            "Tomato growing tips",
            "Tomato diseases",
            "Improve tomato yield",
        ];
    }

    if (/potato|potatoes|waru/.test(content)) {
        return [
            "Potato farming tips",
            "Potato diseases",
            "Improve potato yield",
        ];
    }

    if (/cabbage|cabbages/.test(content)) {
        return [
            "Cabbage growing tips",
            "Cabbage pest control",
            "Best cabbage fertilizer",
        ];
    }

    if (/avocado|avocados/.test(content)) {
        return [
            "Avocado farming tips",
            "Avocado disease control",
            "Improve avocado yield",
        ];
    }

    if (/orange|oranges|pixie/.test(content)) {
        return [
            "Orange farming tips",
            "Citrus pest control",
            "Improve citrus yield",
        ];
    }

    if (/banana|bananas/.test(content)) {
        return [
            "Banana farming tips",
            "Banana disease control",
            "Improve banana yield",
        ];
    }

    if (/coffee/.test(content)) {
        return [
            "Coffee farming tips",
            "Coffee disease control",
            "Improve coffee yield",
        ];
    }

    if (/tea/.test(content)) {
        return [
            "Tea farming tips",
            "Tea crop management",
            "Improve tea yield",
        ];
    }

    if (/cow|cows|cattle|dairy|milk/.test(content)) {
        return [
            "Dairy farming tips",
            "Improve milk production",
            "Cattle feeding advice",
        ];
    }

    if (/chicken|poultry|kienyeji|layers|broiler/.test(content)) {
        return [
            "Poultry farming tips",
            "Chicken feeding guide",
            "Prevent poultry diseases",
        ];
    }

    if (/goat|goats/.test(content)) {
        return [
            "Goat farming tips",
            "Goat feeding guide",
            "Common goat diseases",
        ];
    }

    if (/sheep/.test(content)) {
        return [
            "Sheep farming tips",
            "Sheep feeding guide",
            "Common sheep diseases",
        ];
    }

    if (/pig|pigs|piggery/.test(content)) {
        return [
            "Pig farming tips",
            "Pig feeding guide",
            "Improve pig production",
        ];
    }

    if (/bee|bees|beehive|beehives|beekeeping|honey/.test(content)) {
        return [
            "Beekeeping tips",
            "Improve honey yield",
            "Best hive location",
        ];
    }

    if (/fertilizer|fertiliser|dap|can|npk|manure/.test(content)) {
        return [
            "Best fertilizer choice",
            "DAP vs CAN",
            "Improve soil fertility",
        ];
    }

    if (/pest|disease|fungus|fungal|blight|aphid/.test(content)) {
        return [
            "Identify this problem",
            "Treatment options",
            "Prevent it next time",
        ];
    }

    if (/irrigation|water|drip|drought/.test(content)) {
        return [
            "Irrigation advice",
            "Save water",
            "Best watering schedule",
        ];
    }

    if (/weather|rain|rainfall|forecast|climate/.test(content)) {
        return [
            "Farming in this weather",
            "Rain preparation",
            "Best farm activities",
        ];
    }

    if (/market|price|prices|sell|selling|buyer/.test(content)) {
        return [
            "Market opportunities",
            "Improve selling price",
            "When should I sell?",
        ];
    }

    if (/soil|compost|composting|organic/.test(content)) {
        return [
            "Improve soil health",
            "Composting tips",
            "Use organic matter",
        ];
    }

    if (/vegetable|vegetables|veggie|veggies/.test(content)) {
        return [
            "Vegetable growing tips",
            "Improve vegetable yield",
            "Vegetable pest control",
        ];
    }

    return [
        "Explain this deed",
        "Farming tips",
        "How can this help me?",
    ];
}

export function getPrimaryDeedAiSuggestion(
    deed?: Deed | null
): string {
    return getDeedAiSuggestions(deed)[0] ?? "Ask ekari AI";
}

export function buildDeedAiPrompt(
    deed: Deed | null | undefined,
    suggestion: string
): string {
    if (!deed?.text) {
        return suggestion;
    }

    const hashtags =
        Array.isArray(deed.tags) && deed.tags.length
            ? `\nHashtags: ${deed.tags
                .map((tag) =>
                    String(tag).startsWith("#")
                        ? String(tag)
                        : `#${String(tag)}`
                )
                .join(" ")}`
            : "";

    return `${suggestion}

I am viewing this ekarihub deed:
"${deed.text}"${hashtags}

Give me practical agricultural advice related to this deed. Keep it clear and actionable.`;
}

export function getDeedMarketSuggestion(
    deed?: Deed | null
): DeedMarketSuggestion | null {
    if (!deed) return null;

    const content = deedContextText(deed);

    if (/spring onion|spring onions|green onion|green onions|scallion|scallions/.test(content)) {
        return {
            label: "Find spring onions in ekariMarket",
            shortLabel: "Spring onions",
            query: "spring onions",
        };
    }

    if (/cabbage|cabbages/.test(content)) {
        return {
            label: "Find cabbage in ekariMarket",
            shortLabel: "Cabbage",
            query: "cabbage",
        };
    }

    if (/onion|onions/.test(content)) {
        return {
            label: "Find onions in ekariMarket",
            shortLabel: "Onions",
            query: "onions",
        };
    }

    if (/tomato|tomatoes/.test(content)) {
        return {
            label: "Find tomatoes in ekariMarket",
            shortLabel: "Tomatoes",
            query: "tomatoes",
        };
    }

    if (/maize|corn|mahindi/.test(content)) {
        return {
            label: "Find maize in ekariMarket",
            shortLabel: "Maize",
            query: "maize",
        };
    }

    if (/potato|potatoes|waru/.test(content)) {
        return {
            label: "Find potatoes in ekariMarket",
            shortLabel: "Potatoes",
            query: "potatoes",
        };
    }

    if (/avocado|avocados/.test(content)) {
        return {
            label: "Find avocados in ekariMarket",
            shortLabel: "Avocados",
            query: "avocado",
        };
    }

    if (/orange|oranges|pixie/.test(content)) {
        return {
            label: "Find oranges in ekariMarket",
            shortLabel: "Oranges",
            query: "orange",
        };
    }

    if (/banana|bananas/.test(content)) {
        return {
            label: "Find bananas in ekariMarket",
            shortLabel: "Bananas",
            query: "banana",
        };
    }

    if (/coffee/.test(content)) {
        return {
            label: "Find coffee in ekariMarket",
            shortLabel: "Coffee",
            query: "coffee",
        };
    }

    if (/fertilizer|fertiliser|dap|can|npk|manure/.test(content)) {
        return {
            label: "Find fertilizers in ekariMarket",
            shortLabel: "Fertilizers",
            query: "fertilizer",
        };
    }

    if (/bee|bees|beehive|beehives|beekeeping/.test(content)) {
        return {
            label: "Find bee hives in ekariMarket",
            shortLabel: "Bee hives",
            query: "bee hive",
        };
    }

    if (/chicken|poultry|kienyeji|layers|broiler/.test(content)) {
        return {
            label: "Find poultry supplies in ekariMarket",
            shortLabel: "Poultry supplies",
            query: "poultry",
        };
    }

    if (/cow|cows|cattle|dairy|milk/.test(content)) {
        return {
            label: "Find dairy supplies in ekariMarket",
            shortLabel: "Dairy supplies",
            query: "dairy",
        };
    }

    if (/goat|goats/.test(content)) {
        return {
            label: "Find goat supplies in ekariMarket",
            shortLabel: "Goat supplies",
            query: "goat",
        };
    }

    if (/irrigation|drip/.test(content)) {
        return {
            label: "Find irrigation supplies in ekariMarket",
            shortLabel: "Irrigation supplies",
            query: "irrigation",
        };
    }

    if (/seed|seeds|seedling|seedlings/.test(content)) {
        return {
            label: "Find seeds in ekariMarket",
            shortLabel: "Seeds",
            query: "seeds",
        };
    }

    if (/vegetable|vegetables|veggie|veggies/.test(content)) {
        return {
            label: "Find vegetables in ekariMarket",
            shortLabel: "Vegetables",
            query: "vegetables",
        };
    }

    return null;
}