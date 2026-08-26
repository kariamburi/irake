import type { Deed } from "@/app/deeds/data/deedsFeedWeb";

export type DeedMarketSuggestion = {
    label: string;
    shortLabel: string;
    query: string;
};

/* -------------------------------------------------------------------------- */
/*                         DEED CONTEXT TEXT                                  */
/* -------------------------------------------------------------------------- */

function deedContextText(
    deed?: Deed | null
): string {
    if (!deed) {
        return "";
    }

    return [
        deed.text ?? "",
        ...(Array.isArray(deed.tags)
            ? deed.tags
            : []),
    ]
        .join(" ")
        .toLowerCase();
}

/* -------------------------------------------------------------------------- */
/*                         AI SUGGESTIONS                                     */
/* -------------------------------------------------------------------------- */

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

    const content =
        deedContextText(deed);

    if (/maize|corn|mahindi/.test(content)) {
        return [
            "Maize growing tips",
            "Best maize fertilizer",
            "Maize pest control",
        ];
    }

    if (
        /spring onion|spring onions|green onion|green onions|scallion|scallions/.test(
            content
        )
    ) {
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

    if (
        /cow|cows|cattle|dairy|milk/.test(
            content
        )
    ) {
        return [
            "Dairy farming tips",
            "Improve milk production",
            "Cattle feeding advice",
        ];
    }

    if (
        /chicken|poultry|kienyeji|layers|broiler/.test(
            content
        )
    ) {
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

    if (
        /bee|bees|beehive|beehives|beekeeping|honey/.test(
            content
        )
    ) {
        return [
            "Beekeeping tips",
            "Improve honey yield",
            "Best hive location",
        ];
    }

    if (
        /fertilizer|fertiliser|\bdap\b|\bcan fertilizer\b|\bnpk\b|manure/.test(
            content
        )
    ) {
        return [
            "Best fertilizer choice",
            "DAP vs CAN",
            "Improve soil fertility",
        ];
    }

    if (
        /pest|disease|fungus|fungal|blight|aphid/.test(
            content
        )
    ) {
        return [
            "Identify this problem",
            "Treatment options",
            "Prevent it next time",
        ];
    }

    if (
        /irrigation|water|drip|drought/.test(
            content
        )
    ) {
        return [
            "Irrigation advice",
            "Save water",
            "Best watering schedule",
        ];
    }

    if (
        /weather|rain|rainfall|forecast|climate/.test(
            content
        )
    ) {
        return [
            "Farming in this weather",
            "Rain preparation",
            "Best farm activities",
        ];
    }

    if (
        /market|price|prices|sell|selling|buyer/.test(
            content
        )
    ) {
        return [
            "Market opportunities",
            "Improve selling price",
            "When should I sell?",
        ];
    }

    if (
        /soil|compost|composting|organic/.test(
            content
        )
    ) {
        return [
            "Improve soil health",
            "Composting tips",
            "Use organic matter",
        ];
    }

    if (
        /vegetable|vegetables|veggie|veggies/.test(
            content
        )
    ) {
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

/* -------------------------------------------------------------------------- */
/*                      PRIMARY AI SUGGESTION                                 */
/* -------------------------------------------------------------------------- */

export function getPrimaryDeedAiSuggestion(
    deed?: Deed | null
): string {
    return (
        getDeedAiSuggestions(
            deed
        )[0] ??
        "Ask ekari AI"
    );
}

/* -------------------------------------------------------------------------- */
/*                         BUILD AI PROMPT                                    */
/* -------------------------------------------------------------------------- */

export function buildDeedAiPrompt(
    deed:
        | Deed
        | null
        | undefined,

    suggestion: string
): string {
    if (!deed?.text) {
        return suggestion;
    }

    const hashtags =
        Array.isArray(
            deed.tags
        ) &&
            deed.tags.length
            ? `\nHashtags: ${deed.tags
                .map(
                    (
                        tag
                    ) =>
                        String(
                            tag
                        ).startsWith(
                            "#"
                        )
                            ? String(
                                tag
                            )
                            : `#${String(
                                tag
                            )}`
                )
                .join(
                    " "
                )}`
            : "";

    return `${suggestion}

I am viewing this ekarihub deed:
"${deed.text}"${hashtags}

Give me practical agricultural advice related to this deed. Keep it clear and actionable.`;
}

/* -------------------------------------------------------------------------- */
/*                         MARKET MATCHER                                     */
/* -------------------------------------------------------------------------- */

type MarketProductMatcher = {
    pattern: RegExp;
    label: string;
    shortLabel: string;
    query: string;
};

function escapeRegExp(
    value: string
): string {
    return value.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}

function marketProduct(
    shortLabel: string,
    query: string,
    terms: string[],
    label?: string
): MarketProductMatcher {
    const sortedTerms = [
        ...terms,
    ].sort(
        (a, b) =>
            b.length - a.length
    );

    return {
        pattern: new RegExp(
            `\\b(?:${sortedTerms
                .map(
                    escapeRegExp
                )
                .join("|")})\\b`,
            "i"
        ),

        label:
            label ??
            `Find ${shortLabel} in ekariMarket`,

        shortLabel,

        query,
    };
}

/* -------------------------------------------------------------------------- */
/*                         MARKET PRODUCTS                                    */
/* -------------------------------------------------------------------------- */

const MARKET_PRODUCT_MATCHERS: MarketProductMatcher[] = [
    /* LEAFY VEGETABLES */

    marketProduct(
        "Kales",
        "kales",
        [
            "sukuma wiki",
            "sukuma",
            "collard greens",
            "collard green",
            "kales",
            "kale",
        ]
    ),

    marketProduct(
        "Spinach",
        "spinach",
        [
            "spinaches",
            "spinach",
        ]
    ),

    marketProduct(
        "Cabbage",
        "cabbage",
        [
            "cabbages",
            "cabbage",
        ]
    ),

    marketProduct(
        "Lettuce",
        "lettuce",
        [
            "lettuces",
            "lettuce",
        ]
    ),

    marketProduct(
        "Amaranth",
        "amaranth",
        [
            "amaranth leaves",
            "amaranth",
            "terere",
            "mchicha",
        ]
    ),

    marketProduct(
        "Managu",
        "managu",
        [
            "black nightshade",
            "african nightshade",
            "nightshade",
            "managu",
        ]
    ),

    marketProduct(
        "Saget",
        "saget",
        [
            "spider plants",
            "spider plant",
            "sagaa",
            "saget",
        ]
    ),

    marketProduct(
        "Mitoo",
        "mitoo",
        [
            "slender leaf",
            "slenderleaf",
            "mitoo",
        ]
    ),

    marketProduct(
        "Kunde",
        "kunde",
        [
            "cowpea leaves",
            "cowpea leaf",
            "kunde",
        ]
    ),

    marketProduct(
        "Mrenda",
        "mrenda",
        [
            "jute mallow",
            "mrenda",
            "murere",
        ]
    ),

    marketProduct(
        "Pumpkin leaves",
        "pumpkin leaves",
        [
            "pumpkin leaves",
            "pumpkin leaf",
        ]
    ),

    /* LEGUMES */

    marketProduct(
        "French beans",
        "french beans",
        [
            "french beans",
            "french bean",
        ]
    ),

    marketProduct(
        "Green beans",
        "green beans",
        [
            "green beans",
            "green bean",
        ]
    ),

    marketProduct(
        "Green grams",
        "green grams",
        [
            "green grams",
            "green gram",
            "mung beans",
            "mung bean",
            "ndengu",
        ]
    ),

    marketProduct(
        "Pigeon peas",
        "pigeon peas",
        [
            "pigeon peas",
            "pigeon pea",
            "mbaazi",
        ]
    ),

    marketProduct(
        "Chickpeas",
        "chickpeas",
        [
            "chick peas",
            "chick pea",
            "chickpeas",
            "chickpea",
        ]
    ),

    marketProduct(
        "Cowpeas",
        "cowpeas",
        [
            "cow peas",
            "cow pea",
            "cowpeas",
            "cowpea",
        ]
    ),

    marketProduct(
        "Soybeans",
        "soybeans",
        [
            "soya beans",
            "soya bean",
            "soy beans",
            "soy bean",
            "soybeans",
            "soybean",
            "soya",
        ]
    ),

    marketProduct(
        "Kidney beans",
        "kidney beans",
        [
            "kidney beans",
            "kidney bean",
        ]
    ),

    marketProduct(
        "Black beans",
        "black beans",
        [
            "black beans",
            "black bean",
        ]
    ),

    marketProduct(
        "Beans",
        "beans",
        [
            "maharagwe",
            "beans",
            "bean",
        ]
    ),

    marketProduct(
        "Peas",
        "peas",
        [
            "garden peas",
            "garden pea",
            "peas",
            "pea",
        ]
    ),

    marketProduct(
        "Lentils",
        "lentils",
        [
            "lentils",
            "lentil",
        ]
    ),

    /* CEREALS */

    marketProduct(
        "Maize",
        "maize",
        [
            "mahindi",
            "maize",
            "corn",
        ]
    ),

    marketProduct(
        "Wheat",
        "wheat",
        [
            "wheat",
            "ngano",
        ]
    ),

    marketProduct(
        "Rice",
        "rice",
        [
            "paddy rice",
            "paddy",
            "rice",
            "mchele",
        ]
    ),

    marketProduct(
        "Sorghum",
        "sorghum",
        [
            "sorghum",
            "mtama",
        ]
    ),

    marketProduct(
        "Finger millet",
        "finger millet",
        [
            "finger millet",
            "wimbi",
        ]
    ),

    marketProduct(
        "Millet",
        "millet",
        [
            "pearl millet",
            "millet",
        ]
    ),

    marketProduct(
        "Barley",
        "barley",
        [
            "barley",
        ]
    ),

    marketProduct(
        "Oats",
        "oats",
        [
            "oats",
            "oat",
        ]
    ),

    /* ROOTS / TUBERS */

    marketProduct(
        "Sweet potatoes",
        "sweet potatoes",
        [
            "sweet potatoes",
            "sweet potato",
        ]
    ),

    marketProduct(
        "Potatoes",
        "potatoes",
        [
            "irish potatoes",
            "irish potato",
            "potatoes",
            "potato",
            "waru",
        ]
    ),

    marketProduct(
        "Arrowroots",
        "arrowroots",
        [
            "arrow roots",
            "arrow root",
            "arrowroots",
            "arrowroot",
            "nduma",
        ]
    ),

    marketProduct(
        "Cassava",
        "cassava",
        [
            "cassava",
            "mihogo",
        ]
    ),

    marketProduct(
        "Yams",
        "yams",
        [
            "yams",
            "yam",
        ]
    ),

    marketProduct(
        "Carrots",
        "carrots",
        [
            "carrots",
            "carrot",
        ]
    ),

    marketProduct(
        "Beetroot",
        "beetroot",
        [
            "beet roots",
            "beet root",
            "beetroots",
            "beetroot",
        ]
    ),

    marketProduct(
        "Radish",
        "radish",
        [
            "radishes",
            "radish",
        ]
    ),

    /* VEGETABLES */

    marketProduct(
        "Spring onions",
        "spring onions",
        [
            "spring onions",
            "spring onion",
            "green onions",
            "green onion",
            "scallions",
            "scallion",
        ]
    ),

    marketProduct(
        "Onions",
        "onions",
        [
            "red onions",
            "red onion",
            "white onions",
            "white onion",
            "vitunguu",
            "kitunguu",
            "onions",
            "onion",
        ]
    ),

    marketProduct(
        "Tomatoes",
        "tomatoes",
        [
            "tomatoes",
            "tomato",
            "nyanya",
        ]
    ),

    marketProduct(
        "Capsicum",
        "capsicum",
        [
            "bell peppers",
            "bell pepper",
            "capsicums",
            "capsicum",
            "hoho",
        ]
    ),

    marketProduct(
        "Chillies",
        "chillies",
        [
            "hot peppers",
            "hot pepper",
            "chillies",
            "chilli",
            "chilies",
            "chili",
        ]
    ),

    marketProduct(
        "Cucumber",
        "cucumber",
        [
            "cucumbers",
            "cucumber",
        ]
    ),

    marketProduct(
        "Courgettes",
        "courgettes",
        [
            "courgettes",
            "courgette",
            "zucchinis",
            "zucchini",
        ]
    ),

    marketProduct(
        "Eggplants",
        "eggplant",
        [
            "eggplants",
            "eggplant",
            "aubergines",
            "aubergine",
            "biringanya",
        ]
    ),

    marketProduct(
        "Okra",
        "okra",
        [
            "lady fingers",
            "lady finger",
            "okra",
        ]
    ),

    marketProduct(
        "Broccoli",
        "broccoli",
        [
            "broccoli",
        ]
    ),

    marketProduct(
        "Cauliflower",
        "cauliflower",
        [
            "cauliflowers",
            "cauliflower",
        ]
    ),

    marketProduct(
        "Pumpkins",
        "pumpkin",
        [
            "pumpkins",
            "pumpkin",
            "malenge",
        ]
    ),

    marketProduct(
        "Butternut",
        "butternut",
        [
            "butternut squash",
            "butternuts",
            "butternut",
        ]
    ),

    marketProduct(
        "Celery",
        "celery",
        [
            "celery",
        ]
    ),

    marketProduct(
        "Leeks",
        "leeks",
        [
            "leeks",
            "leek",
        ]
    ),

    marketProduct(
        "Asparagus",
        "asparagus",
        [
            "asparagus",
        ]
    ),

    /* FRUITS */

    marketProduct(
        "Avocados",
        "avocado",
        [
            "hass avocados",
            "hass avocado",
            "fuerte avocados",
            "fuerte avocado",
            "avocados",
            "avocado",
        ]
    ),

    marketProduct(
        "Bananas",
        "banana",
        [
            "bananas",
            "banana",
            "ndizi",
        ]
    ),

    marketProduct(
        "Plantains",
        "plantain",
        [
            "plantains",
            "plantain",
        ]
    ),

    marketProduct(
        "Oranges",
        "orange",
        [
            "pixie oranges",
            "pixie orange",
            "pixies",
            "pixie",
            "oranges",
            "orange",
        ]
    ),

    marketProduct(
        "Lemons",
        "lemon",
        [
            "lemons",
            "lemon",
        ]
    ),

    marketProduct(
        "Limes",
        "lime",
        [
            "limes",
            "lime",
        ]
    ),

    marketProduct(
        "Mangoes",
        "mango",
        [
            "mangoes",
            "mangos",
            "mango",
        ]
    ),

    marketProduct(
        "Pineapples",
        "pineapple",
        [
            "pineapples",
            "pineapple",
            "mananasi",
        ]
    ),

    marketProduct(
        "Watermelons",
        "watermelon",
        [
            "watermelons",
            "watermelon",
        ]
    ),

    marketProduct(
        "Pawpaws",
        "pawpaw",
        [
            "papayas",
            "papaya",
            "pawpaws",
            "pawpaw",
        ]
    ),

    marketProduct(
        "Passion fruits",
        "passion fruit",
        [
            "passion fruits",
            "passion fruit",
            "passionfruits",
            "passionfruit",
        ]
    ),

    marketProduct(
        "Strawberries",
        "strawberry",
        [
            "strawberries",
            "strawberry",
        ]
    ),

    marketProduct(
        "Blueberries",
        "blueberries",
        [
            "blueberries",
            "blueberry",
        ]
    ),

    marketProduct(
        "Raspberries",
        "raspberries",
        [
            "raspberries",
            "raspberry",
        ]
    ),

    marketProduct(
        "Grapes",
        "grapes",
        [
            "grapes",
            "grape",
        ]
    ),

    marketProduct(
        "Apples",
        "apple",
        [
            "apples",
            "apple",
        ]
    ),

    marketProduct(
        "Pears",
        "pear",
        [
            "pears",
            "pear",
        ]
    ),

    marketProduct(
        "Guavas",
        "guava",
        [
            "guavas",
            "guava",
        ]
    ),

    marketProduct(
        "Tree tomatoes",
        "tree tomato",
        [
            "tree tomatoes",
            "tree tomato",
            "tamarillos",
            "tamarillo",
        ]
    ),

    marketProduct(
        "Dragon fruit",
        "dragon fruit",
        [
            "dragon fruits",
            "dragon fruit",
        ]
    ),

    marketProduct(
        "Kiwi",
        "kiwi",
        [
            "kiwi fruits",
            "kiwi fruit",
            "kiwis",
            "kiwi",
        ]
    ),

    marketProduct(
        "Peaches",
        "peach",
        [
            "peaches",
            "peach",
        ]
    ),

    marketProduct(
        "Plums",
        "plum",
        [
            "plums",
            "plum",
        ]
    ),

    /* HERBS */

    marketProduct(
        "Coriander",
        "coriander",
        [
            "coriander",
            "cilantro",
            "dhania",
        ]
    ),

    marketProduct(
        "Garlic",
        "garlic",
        [
            "kitunguu saumu",
            "garlic",
        ]
    ),

    marketProduct(
        "Ginger",
        "ginger",
        [
            "tangawizi",
            "ginger",
        ]
    ),

    marketProduct(
        "Turmeric",
        "turmeric",
        [
            "turmeric",
            "manjano",
        ]
    ),

    marketProduct(
        "Basil",
        "basil",
        [
            "basil",
        ]
    ),

    marketProduct(
        "Mint",
        "mint",
        [
            "mint leaves",
            "mint",
        ]
    ),

    marketProduct(
        "Rosemary",
        "rosemary",
        [
            "rosemary",
        ]
    ),

    marketProduct(
        "Parsley",
        "parsley",
        [
            "parsley",
        ]
    ),

    marketProduct(
        "Black pepper",
        "black pepper",
        [
            "black pepper",
            "peppercorns",
            "peppercorn",
        ]
    ),

    /* CASH CROPS */

    marketProduct(
        "Coffee",
        "coffee",
        [
            "coffee beans",
            "coffee bean",
            "coffee",
        ]
    ),

    marketProduct(
        "Tea",
        "tea",
        [
            "tea leaves",
            "tea leaf",
            "tea",
        ]
    ),

    marketProduct(
        "Sugarcane",
        "sugarcane",
        [
            "sugar cane",
            "sugarcane",
        ]
    ),

    marketProduct(
        "Pyrethrum",
        "pyrethrum",
        [
            "pyrethrum",
        ]
    ),

    marketProduct(
        "Cotton",
        "cotton",
        [
            "cotton",
        ]
    ),

    marketProduct(
        "Sisal",
        "sisal",
        [
            "sisal",
        ]
    ),

    /* NUTS */

    marketProduct(
        "Groundnuts",
        "groundnuts",
        [
            "ground nuts",
            "ground nut",
            "groundnuts",
            "groundnut",
            "peanuts",
            "peanut",
            "njugu",
        ]
    ),

    marketProduct(
        "Macadamia",
        "macadamia",
        [
            "macadamia nuts",
            "macadamia nut",
            "macadamias",
            "macadamia",
        ]
    ),

    marketProduct(
        "Cashew nuts",
        "cashew",
        [
            "cashew nuts",
            "cashew nut",
            "cashews",
            "cashew",
        ]
    ),

    marketProduct(
        "Sunflower",
        "sunflower",
        [
            "sunflower seeds",
            "sunflower seed",
            "sunflowers",
            "sunflower",
        ]
    ),

    marketProduct(
        "Sesame",
        "sesame",
        [
            "sesame seeds",
            "sesame seed",
            "sesame",
            "simsim",
        ]
    ),

    marketProduct(
        "Coconuts",
        "coconut",
        [
            "coconuts",
            "coconut",
            "nazi",
        ]
    ),

    /* LIVESTOCK */

    marketProduct(
        "Dairy cattle",
        "dairy cattle",
        [
            "dairy cattle",
            "dairy cows",
            "dairy cow",
            "friesian cows",
            "friesian cow",
            "friesian",
            "holstein cows",
            "holstein cow",
            "holstein",
        ]
    ),

    marketProduct(
        "Cattle",
        "cattle",
        [
            "beef cattle",
            "cattle",
            "cows",
            "cow",
            "bulls",
            "bull",
            "heifers",
            "heifer",
            "calves",
            "calf",
        ]
    ),

    marketProduct(
        "Goats",
        "goat",
        [
            "dairy goats",
            "dairy goat",
            "boer goats",
            "boer goat",
            "goats",
            "goat",
        ]
    ),

    marketProduct(
        "Sheep",
        "sheep",
        [
            "dorper sheep",
            "sheep",
            "rams",
            "ram",
            "ewes",
            "ewe",
            "lambs",
            "lamb",
        ]
    ),

    marketProduct(
        "Pigs",
        "pig",
        [
            "piglets",
            "piglet",
            "piggery",
            "pigs",
            "pig",
        ]
    ),

    marketProduct(
        "Rabbits",
        "rabbit",
        [
            "rabbits",
            "rabbit",
        ]
    ),

    /* POULTRY */

    marketProduct(
        "Kienyeji chicken",
        "kienyeji chicken",
        [
            "kienyeji chickens",
            "kienyeji chicken",
            "kienyeji",
        ]
    ),

    marketProduct(
        "Broilers",
        "broilers",
        [
            "broiler chickens",
            "broiler chicken",
            "broilers",
            "broiler",
        ]
    ),

    marketProduct(
        "Layers",
        "layers",
        [
            "layer chickens",
            "layer chicken",
            "layers",
            "layer",
        ]
    ),

    marketProduct(
        "Chicks",
        "chicks",
        [
            "day old chicks",
            "day-old chicks",
            "chicks",
            "chick",
        ]
    ),

    marketProduct(
        "Chicken",
        "chicken",
        [
            "chickens",
            "chicken",
            "poultry",
            "hens",
            "hen",
        ]
    ),

    marketProduct(
        "Ducks",
        "duck",
        [
            "ducklings",
            "duckling",
            "ducks",
            "duck",
        ]
    ),

    marketProduct(
        "Turkeys",
        "turkey",
        [
            "turkeys",
            "turkey",
        ]
    ),

    marketProduct(
        "Quails",
        "quail",
        [
            "quails",
            "quail",
        ]
    ),

    marketProduct(
        "Eggs",
        "eggs",
        [
            "tray of eggs",
            "trays of eggs",
            "chicken eggs",
            "eggs",
            "egg",
        ]
    ),

    /* ANIMAL PRODUCTS */

    marketProduct(
        "Milk",
        "milk",
        [
            "fresh milk",
            "cow milk",
            "goat milk",
            "milk",
        ]
    ),

    marketProduct(
        "Honey",
        "honey",
        [
            "raw honey",
            "pure honey",
            "honey",
        ]
    ),

    marketProduct(
        "Bee hives",
        "bee hive",
        [
            "langstroth hives",
            "langstroth hive",
            "kenya top bar hives",
            "kenya top bar hive",
            "bee hives",
            "bee hive",
            "beehives",
            "beehive",
            "beekeeping",
        ]
    ),

    /* FISH */

    marketProduct(
        "Tilapia",
        "tilapia",
        [
            "tilapia fish",
            "tilapias",
            "tilapia",
        ]
    ),

    marketProduct(
        "Catfish",
        "catfish",
        [
            "cat fish",
            "catfish",
        ]
    ),

    marketProduct(
        "Trout",
        "trout",
        [
            "trout fish",
            "trout",
        ]
    ),

    marketProduct(
        "Fish",
        "fish",
        [
            "fishes",
            "fish",
        ]
    ),

    marketProduct(
        "Fingerlings",
        "fingerlings",
        [
            "fish fingerlings",
            "fingerlings",
            "fingerling",
        ]
    ),

    /* SEEDS */

    marketProduct(
        "Maize seeds",
        "maize seeds",
        [
            "maize seeds",
            "maize seed",
        ]
    ),

    marketProduct(
        "Bean seeds",
        "bean seeds",
        [
            "bean seeds",
            "bean seed",
        ]
    ),

    marketProduct(
        "Vegetable seeds",
        "vegetable seeds",
        [
            "vegetable seeds",
            "vegetable seed",
        ]
    ),

    marketProduct(
        "Fruit seedlings",
        "fruit seedlings",
        [
            "fruit tree seedlings",
            "fruit seedlings",
            "fruit seedling",
        ]
    ),

    marketProduct(
        "Seedlings",
        "seedlings",
        [
            "seedlings",
            "seedling",
        ]
    ),

    marketProduct(
        "Seeds",
        "seeds",
        [
            "seeds",
            "seed",
        ]
    ),

    /* FERTILIZER */

    marketProduct(
        "DAP fertilizer",
        "DAP fertilizer",
        [
            "dap fertilizer",
            "dap fertiliser",
            "dap",
        ]
    ),

    marketProduct(
        "CAN fertilizer",
        "CAN fertilizer",
        [
            "can fertilizer",
            "can fertiliser",
        ]
    ),

    marketProduct(
        "NPK fertilizer",
        "NPK fertilizer",
        [
            "npk fertilizer",
            "npk fertiliser",
            "npk",
        ]
    ),

    marketProduct(
        "Urea fertilizer",
        "urea fertilizer",
        [
            "urea fertilizer",
            "urea fertiliser",
            "urea",
        ]
    ),

    marketProduct(
        "Manure",
        "manure",
        [
            "farmyard manure",
            "farm yard manure",
            "organic manure",
            "animal manure",
            "manure",
        ]
    ),

    marketProduct(
        "Compost",
        "compost",
        [
            "compost manure",
            "organic compost",
            "compost",
        ]
    ),

    marketProduct(
        "Fertilizers",
        "fertilizer",
        [
            "fertilizers",
            "fertilizer",
            "fertilisers",
            "fertiliser",
        ]
    ),

    marketProduct(
        "Lime",
        "agricultural lime",
        [
            "agricultural lime",
            "agri lime",
            "soil lime",
        ]
    ),

    /* CROP PROTECTION */

    marketProduct(
        "Pesticides",
        "pesticide",
        [
            "pesticides",
            "pesticide",
        ]
    ),

    marketProduct(
        "Insecticides",
        "insecticide",
        [
            "insecticides",
            "insecticide",
        ]
    ),

    marketProduct(
        "Fungicides",
        "fungicide",
        [
            "fungicides",
            "fungicide",
        ]
    ),

    marketProduct(
        "Herbicides",
        "herbicide",
        [
            "weed killers",
            "weed killer",
            "herbicides",
            "herbicide",
        ]
    ),

    marketProduct(
        "Acaricides",
        "acaricide",
        [
            "acaricides",
            "acaricide",
        ]
    ),

    /* FEEDS */

    marketProduct(
        "Chick mash",
        "chick mash",
        [
            "chick mash feed",
            "chick mash",
        ]
    ),

    marketProduct(
        "Growers mash",
        "growers mash",
        [
            "growers mash",
            "grower mash",
        ]
    ),

    marketProduct(
        "Layers mash",
        "layers mash",
        [
            "layers mash",
            "layer mash",
        ]
    ),

    marketProduct(
        "Broiler starter",
        "broiler starter",
        [
            "broiler starter mash",
            "broiler starter",
        ]
    ),

    marketProduct(
        "Broiler finisher",
        "broiler finisher",
        [
            "broiler finisher mash",
            "broiler finisher",
        ]
    ),

    marketProduct(
        "Dairy meal",
        "dairy meal",
        [
            "dairy meal",
            "dairy feed",
        ]
    ),

    marketProduct(
        "Calf pellets",
        "calf pellets",
        [
            "calf pellets",
            "calf pellet",
        ]
    ),

    marketProduct(
        "Pig feed",
        "pig feed",
        [
            "pig feeds",
            "pig feed",
        ]
    ),

    marketProduct(
        "Rabbit pellets",
        "rabbit pellets",
        [
            "rabbit pellets",
            "rabbit feed",
        ]
    ),

    marketProduct(
        "Fish feed",
        "fish feed",
        [
            "fish feeds",
            "fish feed",
        ]
    ),

    marketProduct(
        "Animal feeds",
        "animal feeds",
        [
            "livestock feeds",
            "livestock feed",
            "animal feeds",
            "animal feed",
        ]
    ),

    marketProduct(
        "Hay",
        "hay",
        [
            "hay bales",
            "hay bale",
            "hay",
        ]
    ),

    marketProduct(
        "Silage",
        "silage",
        [
            "maize silage",
            "silage",
        ]
    ),

    /* IRRIGATION */

    marketProduct(
        "Drip irrigation",
        "drip irrigation",
        [
            "drip irrigation kits",
            "drip irrigation kit",
            "drip irrigation",
            "drip kits",
            "drip kit",
        ]
    ),

    marketProduct(
        "Water pumps",
        "water pump",
        [
            "irrigation pumps",
            "irrigation pump",
            "water pumps",
            "water pump",
        ]
    ),

    marketProduct(
        "Solar pumps",
        "solar water pump",
        [
            "solar water pumps",
            "solar water pump",
            "solar pumps",
            "solar pump",
        ]
    ),

    marketProduct(
        "Sprinklers",
        "sprinkler",
        [
            "irrigation sprinklers",
            "sprinklers",
            "sprinkler",
        ]
    ),

    marketProduct(
        "Water tanks",
        "water tank",
        [
            "water storage tanks",
            "water storage tank",
            "water tanks",
            "water tank",
        ]
    ),

    marketProduct(
        "Irrigation supplies",
        "irrigation",
        [
            "irrigation equipment",
            "irrigation supplies",
            "irrigation system",
            "irrigation",
        ]
    ),

    /* MACHINERY / TOOLS */

    marketProduct(
        "Tractors",
        "tractor",
        [
            "farm tractors",
            "farm tractor",
            "tractors",
            "tractor",
        ]
    ),

    marketProduct(
        "Walking tractors",
        "walking tractor",
        [
            "walking tractors",
            "walking tractor",
            "power tillers",
            "power tiller",
        ]
    ),

    marketProduct(
        "Ploughs",
        "plough",
        [
            "disc ploughs",
            "disc plough",
            "ploughs",
            "plough",
            "plows",
            "plow",
        ]
    ),

    marketProduct(
        "Sprayers",
        "sprayer",
        [
            "knapsack sprayers",
            "knapsack sprayer",
            "motorized sprayers",
            "motorized sprayer",
            "sprayers",
            "sprayer",
        ]
    ),

    marketProduct(
        "Wheelbarrows",
        "wheelbarrow",
        [
            "wheelbarrows",
            "wheelbarrow",
        ]
    ),

    marketProduct(
        "Hoes",
        "hoe",
        [
            "jembes",
            "jembe",
            "hoes",
            "hoe",
        ]
    ),

    marketProduct(
        "Pangas",
        "panga",
        [
            "machetes",
            "machete",
            "pangas",
            "panga",
        ]
    ),

    marketProduct(
        "Forks",
        "farm fork",
        [
            "garden forks",
            "garden fork",
            "farm forks",
            "farm fork",
        ]
    ),

    marketProduct(
        "Rakes",
        "rake",
        [
            "garden rakes",
            "garden rake",
            "rakes",
            "rake",
        ]
    ),

    marketProduct(
        "Secateurs",
        "secateurs",
        [
            "pruning shears",
            "secateurs",
            "secateur",
        ]
    ),

    marketProduct(
        "Milking machines",
        "milking machine",
        [
            "milking machines",
            "milking machine",
        ]
    ),

    marketProduct(
        "Chaff cutters",
        "chaff cutter",
        [
            "chaff cutters",
            "chaff cutter",
        ]
    ),

    marketProduct(
        "Maize shellers",
        "maize sheller",
        [
            "maize shellers",
            "maize sheller",
            "corn shellers",
            "corn sheller",
        ]
    ),

    marketProduct(
        "Incubators",
        "egg incubator",
        [
            "egg incubators",
            "egg incubator",
            "incubators",
            "incubator",
        ]
    ),

    /* GREENHOUSE */

    marketProduct(
        "Greenhouse supplies",
        "greenhouse",
        [
            "greenhouse kits",
            "greenhouse kit",
            "greenhouses",
            "greenhouse",
            "green houses",
            "green house",
        ]
    ),

    marketProduct(
        "Shade nets",
        "shade net",
        [
            "shade nets",
            "shade net",
            "shade cloth",
        ]
    ),

    marketProduct(
        "Mulching materials",
        "mulching",
        [
            "mulching papers",
            "mulching paper",
            "mulching films",
            "mulching film",
            "mulch paper",
        ]
    ),

    marketProduct(
        "Seedling trays",
        "seedling tray",
        [
            "seedling trays",
            "seedling tray",
            "nursery trays",
            "nursery tray",
        ]
    ),

    /* LIVESTOCK SUPPLIES */

    marketProduct(
        "Mineral supplements",
        "livestock mineral supplements",
        [
            "mineral supplements",
            "mineral supplement",
            "mineral licks",
            "mineral lick",
        ]
    ),

    marketProduct(
        "Dewormers",
        "livestock dewormer",
        [
            "deworming medicine",
            "dewormers",
            "dewormer",
        ]
    ),

    marketProduct(
        "Cattle salt",
        "cattle salt",
        [
            "livestock salt",
            "cattle salt",
        ]
    ),

    /* GENERIC FALLBACKS — ALWAYS KEEP LAST */

    marketProduct(
        "Fruits",
        "fruits",
        [
            "fruits",
            "fruit",
        ]
    ),

    marketProduct(
        "Vegetables",
        "vegetables",
        [
            "vegetables",
            "vegetable",
            "veggies",
            "veggie",
        ]
    ),

    marketProduct(
        "Livestock",
        "livestock",
        [
            "livestock",
        ]
    ),

    marketProduct(
        "Farm equipment",
        "farm equipment",
        [
            "farming equipment",
            "farm machinery",
            "agricultural machinery",
            "farm equipment",
        ]
    ),
];

/* -------------------------------------------------------------------------- */
/*                         MARKET SUGGESTION                                  */
/* -------------------------------------------------------------------------- */

export function getDeedMarketSuggestion(
    deed?: Deed | null
): DeedMarketSuggestion | null {
    if (!deed) {
        return null;
    }

    const content =
        deedContextText(
            deed
        );

    const match =
        MARKET_PRODUCT_MATCHERS.find(
            (
                product
            ) =>
                product.pattern.test(
                    content
                )
        );

    if (!match) {
        return null;
    }

    return {
        label:
            match.label,

        shortLabel:
            match.shortLabel,

        query:
            match.query,
    };
}