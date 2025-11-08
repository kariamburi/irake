// AUTO-GENERATED Market Master Catalog
export type MarketType = "product" | "tree" | "animal" | "lease" | "service";

export type MarketCatalogEntry = {
  type: MarketType;
  category: string;
  subCategory?: string;
  name: string;
  variety?: string;
  form?: string;
  useCase?: string;
  typicalPackSize?: number | string;
  unit?: string;
  grade?: string;
  rate?: string;         // for lease/service
  billingUnit?: string;  // for lease/service
  extras?: Record<string, any>;
};

export const MARKET_CATALOG: MarketCatalogEntry[] = [
  {
    "type": "product",
    "category": "Oilseed",
    "subCategory": "",
    "name": "Soybean",
    "variety": "",
    "form": "Dry grain / Crude oil / Meal",
    "useCase": "Food/Feed/Oil",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "Export",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GAP, Non-GMO/Organic (opt.)",
      "HS Code (placeholder)": "1201/1507",
      "Tags": "top,heavyweight,globally-traded"
    }
  },
  {
    "type": "product",
    "category": "Oilseed",
    "subCategory": "Tropical oils",
    "name": "Oil palm (FFB)",
    "variety": "Tenera",
    "form": "FFB/Crude palm oil/Kernel",
    "useCase": "Oil/Biofuel",
    "typicalPackSize": "1.0",
    "unit": "ton",
    "grade": "Mill-grade",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "RSPO (opt.)",
      "HS Code (placeholder)": "1207/1511",
      "Tags": "top,heavyweight,RSPO"
    }
  },
  {
    "type": "product",
    "category": "Grain & Cereal",
    "subCategory": "",
    "name": "Maize/Corn",
    "variety": "Yellow dent/White",
    "form": "Dry grain/Flour/Starch",
    "useCase": "Food/Feed/Ethanol",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "Grade 1-3",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GAP",
      "HS Code (placeholder)": "1005",
      "Tags": "top,heavyweight,staple"
    }
  },
  {
    "type": "product",
    "category": "Grain & Cereal",
    "subCategory": "",
    "name": "Wheat",
    "variety": "Bread/Durum",
    "form": "Dry grain/Flour/Semolina",
    "useCase": "Food",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "Milling grade",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GAP",
      "HS Code (placeholder)": "1001",
      "Tags": "top,heavyweight,staple"
    }
  },
  {
    "type": "product",
    "category": "Grain & Cereal",
    "subCategory": "",
    "name": "Rice (paddy)",
    "variety": "Basmati/Jasmine/Long grain",
    "form": "Paddy/Milled/Parboiled",
    "useCase": "Food",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "Export",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GAP",
      "HS Code (placeholder)": "1006",
      "Tags": "top,heavyweight,staple"
    }
  },
  {
    "type": "product",
    "category": "Beverage crop",
    "subCategory": "",
    "name": "Coffee",
    "variety": "Arabica/Robusta",
    "form": "Green beans/Roasted/Ground",
    "useCase": "Beverage",
    "typicalPackSize": "60.0",
    "unit": "kg jute bag",
    "grade": "AA/AB/FAQ",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "Fairtrade, RA, Organic",
      "HS Code (placeholder)": "0901",
      "Tags": "top,high-value,beverage"
    }
  },
  {
    "type": "product",
    "category": "Beverage crop",
    "subCategory": "",
    "name": "Cocoa",
    "variety": "Forastero/Trinitario/Criollo",
    "form": "Beans/Liquor/Butter/Powder",
    "useCase": "Chocolate/Confectionery",
    "typicalPackSize": "62.5",
    "unit": "kg bag",
    "grade": "Export",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "Fairtrade, RA, Organic",
      "HS Code (placeholder)": "1801",
      "Tags": "top,high-value,beverage"
    }
  },
  {
    "type": "product",
    "category": "Fiber",
    "subCategory": "",
    "name": "Cotton",
    "variety": "Upland/Extra-long staple",
    "form": "Lint/Seed",
    "useCase": "Textile/Oil",
    "typicalPackSize": "227.0",
    "unit": "kg bale",
    "grade": "Middling/Strict Middling",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "BCI",
      "HS Code (placeholder)": "5201/5203",
      "Tags": "top,fiber,global"
    }
  },
  {
    "type": "product",
    "category": "Sweetener",
    "subCategory": "",
    "name": "Sugarcane",
    "variety": "",
    "form": "Cane/Raw sugar/Refined",
    "useCase": "Food/Ethanol",
    "typicalPackSize": "1.0",
    "unit": "ton",
    "grade": "Mill-grade",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "Bonsucro",
      "HS Code (placeholder)": "1701",
      "Tags": "top,sweetener,biofuel"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Root & tuber",
    "name": "Potato",
    "variety": "Table/Processing",
    "form": "Fresh/Chilled/Frozen/Flakes",
    "useCase": "Food/Processing",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "Export",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0701",
      "Tags": "top,staple,processing"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Fruiting",
    "name": "Tomato",
    "variety": "Roma/Cherry/Beef",
    "form": "Fresh/Paste/Puree",
    "useCase": "Food/Processing",
    "typicalPackSize": "6.0",
    "unit": "kg crate",
    "grade": "Export",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0702/2002",
      "Tags": "top,processing"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Tropical",
    "name": "Banana",
    "variety": "Cavendish",
    "form": "Fresh/Dried/Chips",
    "useCase": "Food",
    "typicalPackSize": "18.14",
    "unit": "kg carton",
    "grade": "Class I/Extra",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P., Fairtrade",
      "HS Code (placeholder)": "0803",
      "Tags": "top,tropical,export"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Vine",
    "name": "Grape",
    "variety": "Table/Wine",
    "form": "Fresh/Raisin/Wine",
    "useCase": "Food/Beverage",
    "typicalPackSize": "4.5",
    "unit": "kg punnet/carton",
    "grade": "Class I/Extra",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0806/2204",
      "Tags": "top,fruit,wine"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Citrus",
    "name": "Citrus",
    "variety": "Orange/Lemon/Lime",
    "form": "Fresh/Juice",
    "useCase": "Food/Juice",
    "typicalPackSize": "15.0",
    "unit": "kg carton",
    "grade": "Class I/Extra",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0805",
      "Tags": "top,citrus,juice"
    }
  },
  {
    "type": "product",
    "category": "Oilseed",
    "subCategory": "",
    "name": "Rapeseed/Canola",
    "variety": "",
    "form": "Seed/Crude oil/Meal",
    "useCase": "Oil/Feed",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "Export",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GAP",
      "HS Code (placeholder)": "1205/1514",
      "Tags": "top,oilseed"
    }
  },
  {
    "type": "product",
    "category": "Oilseed",
    "subCategory": "",
    "name": "Sunflower seed",
    "variety": "",
    "form": "Seed/Crude oil/Cake",
    "useCase": "Oil/Feed",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "Export",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GAP",
      "HS Code (placeholder)": "1206/1512",
      "Tags": "top,oilseed"
    }
  },
  {
    "type": "product",
    "category": "Industrial",
    "subCategory": "",
    "name": "Natural rubber",
    "variety": "Hevea brasiliensis",
    "form": "Latex/Sheet/Crumb",
    "useCase": "Tires/Manufacturing",
    "typicalPackSize": "1.0",
    "unit": "ton",
    "grade": "RSS/SIR",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "Sustainability stds.",
      "HS Code (placeholder)": "4001",
      "Tags": "top,industrial"
    }
  },
  {
    "type": "product",
    "category": "Beverage crop",
    "subCategory": "",
    "name": "Tea",
    "variety": "Black/Green/Orthodox/CTC",
    "form": "Made tea",
    "useCase": "Beverage",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "BP/BPF/PD/Dust",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "Fairtrade, RA",
      "HS Code (placeholder)": "0902",
      "Tags": "top,beverage,export"
    }
  },
  {
    "type": "product",
    "category": "Starch crop",
    "subCategory": "",
    "name": "Cassava",
    "variety": "",
    "form": "Fresh/Chips/Starch",
    "useCase": "Food/Feed/Industrial",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "Export",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GAP",
      "HS Code (placeholder)": "0714/1108",
      "Tags": "top,starch"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Allium",
    "name": "Onion",
    "variety": "Red/White/Yellow",
    "form": "Fresh/Dehydrated",
    "useCase": "Food",
    "typicalPackSize": "20.0",
    "unit": "kg bag",
    "grade": "Export",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0703",
      "Tags": "top,allium"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Allium",
    "name": "Garlic",
    "variety": "",
    "form": "Fresh/Dehydrated",
    "useCase": "Food",
    "typicalPackSize": "10.0",
    "unit": "kg carton",
    "grade": "Export",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0703",
      "Tags": "top,allium"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Tropical",
    "name": "Avocado",
    "variety": "Hass/Fuerte",
    "form": "Fresh/Oil",
    "useCase": "Food/Oil",
    "typicalPackSize": "4.0",
    "unit": "kg carton",
    "grade": "Class I/Extra",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0804",
      "Tags": "high-value,export"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Berry",
    "name": "Berries (mix)",
    "variety": "Blueberry/Strawberry/Raspberry",
    "form": "Fresh/Frozen",
    "useCase": "Food",
    "typicalPackSize": "2.0",
    "unit": "kg carton",
    "grade": "Class I/Extra",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0811/0810",
      "Tags": "high-value,perishable"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Fruiting",
    "name": "Chili/Peppers",
    "variety": "Bell/Jalape\u00f1o/Cayenne",
    "form": "Fresh/Dried/Powder",
    "useCase": "Food/Spice",
    "typicalPackSize": "5.0",
    "unit": "kg crate",
    "grade": "Export",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0709/0904",
      "Tags": "high-value,spice"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Tropical",
    "name": "Mango",
    "variety": "Tommy/Haden/Keitt",
    "form": "Fresh/Puree/Dried",
    "useCase": "Food/Juice",
    "typicalPackSize": "4.0",
    "unit": "kg carton",
    "grade": "Class I/Extra",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0804",
      "Tags": "tropical,export"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Tropical",
    "name": "Pineapple",
    "variety": "MD2/Smooth Cayenne",
    "form": "Fresh/Juice",
    "useCase": "Food/Juice",
    "typicalPackSize": "12.0",
    "unit": "kg carton",
    "grade": "Class I/Extra",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0804",
      "Tags": "tropical,export"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Tropical",
    "name": "Papaya",
    "variety": "Solo/Red Lady",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "8.0",
    "unit": "kg carton",
    "grade": "Class I/Extra",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0807",
      "Tags": "tropical"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Tropical",
    "name": "Passion fruit",
    "variety": "Purple/Yellow",
    "form": "Fresh/Pulp",
    "useCase": "Food/Juice",
    "typicalPackSize": "2.0",
    "unit": "kg carton",
    "grade": "Class I/Extra",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0810",
      "Tags": "tropical,juice"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Tropical",
    "name": "Guava",
    "variety": "",
    "form": "Fresh/Puree",
    "useCase": "Food",
    "typicalPackSize": "4.0",
    "unit": "kg carton",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0804/0810",
      "Tags": "tropical"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Tropical",
    "name": "Lychee",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "2.0",
    "unit": "kg carton",
    "grade": "Export",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0810",
      "Tags": "exotic"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Specialty",
    "name": "Dragon fruit",
    "variety": "Red/White",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "4.0",
    "unit": "kg carton",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0810",
      "Tags": "exotic"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Arid/Desert",
    "name": "Dates",
    "variety": "Medjool/Deglet",
    "form": "Fresh/Dried",
    "useCase": "Food",
    "typicalPackSize": "5.0",
    "unit": "kg carton",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0804/0806",
      "Tags": "arid"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Mediterranean",
    "name": "Figs",
    "variety": "",
    "form": "Fresh/Dried",
    "useCase": "Food",
    "typicalPackSize": "2.0",
    "unit": "kg carton",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0804/0806",
      "Tags": "mediterranean"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Arid/Desert",
    "name": "Pomegranate",
    "variety": "Wonderful/Kandhari",
    "form": "Fresh/Arils/Juice",
    "useCase": "Food/Juice",
    "typicalPackSize": "5.0",
    "unit": "kg carton",
    "grade": "Export",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0810",
      "Tags": "arid"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Temperate",
    "name": "Apple",
    "variety": "Gala/Fuji/Granny",
    "form": "Fresh/Juice",
    "useCase": "Food/Juice",
    "typicalPackSize": "18.0",
    "unit": "kg carton",
    "grade": "Class I/Extra",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0808",
      "Tags": "temperate"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Temperate",
    "name": "Pear",
    "variety": "Packham/Bartlett",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "12.0",
    "unit": "kg carton",
    "grade": "Class I/Extra",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0808",
      "Tags": "temperate"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Stone",
    "name": "Peach",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "5.0",
    "unit": "kg carton",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0809",
      "Tags": "stonefruit"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Stone",
    "name": "Plum",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "5.0",
    "unit": "kg carton",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0809",
      "Tags": "stonefruit"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Stone",
    "name": "Apricot",
    "variety": "",
    "form": "Fresh/Dried",
    "useCase": "Food",
    "typicalPackSize": "5.0",
    "unit": "kg carton",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0809",
      "Tags": "stonefruit"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Stone",
    "name": "Cherry",
    "variety": "Sweet/Sour",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "5.0",
    "unit": "kg carton",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0809",
      "Tags": "stonefruit"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Melon",
    "name": "Watermelon",
    "variety": "Seedless/Crimson",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "1.0",
    "unit": "piece",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0807",
      "Tags": "melon"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Melon",
    "name": "Cantaloupe",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "10.0",
    "unit": "kg carton",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0807",
      "Tags": "melon"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Vine",
    "name": "Kiwifruit",
    "variety": "Hayward/Gold",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "10.0",
    "unit": "kg carton",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0810",
      "Tags": "temperate"
    }
  },
  {
    "type": "product",
    "category": "Fruit",
    "subCategory": "Tropical",
    "name": "Coconut",
    "variety": "",
    "form": "Fresh/Copra/Water",
    "useCase": "Food/Oil/Beverage",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "Export",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "Organic (opt.)",
      "HS Code (placeholder)": "0801/1203/2202",
      "Tags": "tropical,oil,beverage"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Fruiting",
    "name": "Eggplant/Aubergine",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "6.0",
    "unit": "kg crate",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0709",
      "Tags": "nightshade"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Fruiting",
    "name": "Okra",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "4.0",
    "unit": "kg crate",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0709",
      "Tags": "okra"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Fruiting",
    "name": "Cucumber",
    "variety": "Slicer/Gherkin",
    "form": "Fresh/Pickled",
    "useCase": "Food",
    "typicalPackSize": "6.0",
    "unit": "kg crate",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0707/2001",
      "Tags": "gourd"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Fruiting",
    "name": "Zucchini/Courgette",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "5.0",
    "unit": "kg crate",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0709",
      "Tags": "gourd"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Fruiting",
    "name": "Pumpkin",
    "variety": "",
    "form": "Fresh/Pur\u00e9e",
    "useCase": "Food",
    "typicalPackSize": "10.0",
    "unit": "kg crate",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0709/2008",
      "Tags": "gourd"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Fruiting",
    "name": "Squash (butternut etc.)",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "10.0",
    "unit": "kg crate",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0709",
      "Tags": "gourd"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Leafy",
    "name": "Lettuce (all types)",
    "variety": "Iceberg/Romaine/Leaf",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "12.0",
    "unit": "heads/carton",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0705",
      "Tags": "leafy"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Leafy",
    "name": "Spinach",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "5.0",
    "unit": "kg crate",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0709",
      "Tags": "leafy"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Leafy",
    "name": "Kale",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "5.0",
    "unit": "kg crate",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0709",
      "Tags": "leafy"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Leafy/Brassica",
    "name": "Cabbage",
    "variety": "Green/Red/Savoy",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "20.0",
    "unit": "kg bag",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0704",
      "Tags": "brassica"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Brassica",
    "name": "Broccoli",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "5.0",
    "unit": "kg carton",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0704",
      "Tags": "brassica"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Brassica",
    "name": "Cauliflower",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "5.0",
    "unit": "kg carton",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0704",
      "Tags": "brassica"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Brassica",
    "name": "Brussels sprouts",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "5.0",
    "unit": "kg carton",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0704",
      "Tags": "brassica"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Root",
    "name": "Carrot",
    "variety": "",
    "form": "Fresh/Processed",
    "useCase": "Food",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0706",
      "Tags": "root"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Root",
    "name": "Beetroot",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "20.0",
    "unit": "kg bag",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0706",
      "Tags": "root"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Root",
    "name": "Radish",
    "variety": "Daikon/Red globe",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "10.0",
    "unit": "kg bag",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0706",
      "Tags": "root"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Root",
    "name": "Turnip",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "10.0",
    "unit": "kg bag",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0706",
      "Tags": "root"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Root",
    "name": "Parsnip",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "10.0",
    "unit": "kg bag",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0706",
      "Tags": "root"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Root & tuber",
    "name": "Sweet potato",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "20.0",
    "unit": "kg bag",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0714",
      "Tags": "root"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Root & tuber",
    "name": "Yam",
    "variety": "Dioscorea spp.",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "20.0",
    "unit": "kg bag",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0714",
      "Tags": "root"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Root & tuber",
    "name": "Taro",
    "variety": "Cocoyam",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "20.0",
    "unit": "kg bag",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0714",
      "Tags": "root"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Stem",
    "name": "Celery",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "10.0",
    "unit": "kg carton",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0709",
      "Tags": "stem"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Stem",
    "name": "Asparagus",
    "variety": "Green/White",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "5.0",
    "unit": "kg carton",
    "grade": "Class I/Extra",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0709",
      "Tags": "premium"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Legume (fresh)",
    "name": "Green beans",
    "variety": "French/Snap",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "5.0",
    "unit": "kg carton",
    "grade": "Class I/Extra",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0708",
      "Tags": "export"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Legume (fresh)",
    "name": "Sugar snap peas",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "5.0",
    "unit": "kg carton",
    "grade": "Class I/Extra",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0708",
      "Tags": "export"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Legume (fresh)",
    "name": "Snow peas",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "5.0",
    "unit": "kg carton",
    "grade": "Class I/Extra",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0708",
      "Tags": "export"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Allium",
    "name": "Spring onion/Scallion",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "5.0",
    "unit": "kg carton",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0703",
      "Tags": "allium"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Allium",
    "name": "Leek",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "10.0",
    "unit": "kg carton",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0703",
      "Tags": "allium"
    }
  },
  {
    "type": "product",
    "category": "Herb",
    "subCategory": "Culinary",
    "name": "Herbs (assorted)",
    "variety": "Basil/Coriander/Parsley/Mint etc.",
    "form": "Fresh",
    "useCase": "Culinary",
    "typicalPackSize": "1.0",
    "unit": "kg carton",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0709",
      "Tags": "herbs,mixed"
    }
  },
  {
    "type": "product",
    "category": "Grain & Cereal",
    "subCategory": "",
    "name": "Barley",
    "variety": "Malting/Feed",
    "form": "Dry grain",
    "useCase": "Brewing/Feed",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "Malting grade",
    "extras": {
      "HS Code (placeholder)": "1003",
      "Tags": "brewing"
    }
  },
  {
    "type": "product",
    "category": "Grain & Cereal",
    "subCategory": "",
    "name": "Oats",
    "variety": "",
    "form": "Grain/Flakes",
    "useCase": "Food/Feed",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "1004",
      "Tags": "cereal"
    }
  },
  {
    "type": "product",
    "category": "Grain & Cereal",
    "subCategory": "",
    "name": "Rye",
    "variety": "",
    "form": "Grain/Flour",
    "useCase": "Food",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "1002",
      "Tags": "cereal"
    }
  },
  {
    "type": "product",
    "category": "Grain & Cereal",
    "subCategory": "",
    "name": "Sorghum",
    "variety": "White/Red",
    "form": "Grain/Flour",
    "useCase": "Food/Feed",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "1007",
      "Tags": "cereal,dryland"
    }
  },
  {
    "type": "product",
    "category": "Grain & Cereal",
    "subCategory": "Small grains",
    "name": "Millet",
    "variety": "Pearl/Foxtail/Finger",
    "form": "Grain/Flour",
    "useCase": "Food/Feed",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "1008",
      "Tags": "cereal,dryland"
    }
  },
  {
    "type": "product",
    "category": "Grain & Cereal",
    "subCategory": "",
    "name": "Teff",
    "variety": "",
    "form": "Grain/Flour",
    "useCase": "Food",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "Gluten-free",
      "HS Code (placeholder)": "1008",
      "Tags": "cereal,gluten-free"
    }
  },
  {
    "type": "product",
    "category": "Grain & Cereal",
    "subCategory": "Pseudo-cereal",
    "name": "Quinoa",
    "variety": "",
    "form": "Grain/Flour",
    "useCase": "Food",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "Organic (opt.)",
      "HS Code (placeholder)": "1008/1102",
      "Tags": "premium"
    }
  },
  {
    "type": "product",
    "category": "Grain & Cereal",
    "subCategory": "Pseudo-cereal",
    "name": "Buckwheat",
    "variety": "",
    "form": "Grain/Flour",
    "useCase": "Food",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "1008/1102",
      "Tags": "niche"
    }
  },
  {
    "type": "product",
    "category": "Grain & Cereal",
    "subCategory": "Pseudo-cereal",
    "name": "Amaranth",
    "variety": "",
    "form": "Grain/Flour",
    "useCase": "Food",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "1008/1102",
      "Tags": "niche"
    }
  },
  {
    "type": "product",
    "category": "Pulse (dry)",
    "subCategory": "",
    "name": "Common beans",
    "variety": "Red kidney/Black/Navy",
    "form": "Dry",
    "useCase": "Food",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "Export",
    "extras": {
      "HS Code (placeholder)": "0713",
      "Tags": "pulse"
    }
  },
  {
    "type": "product",
    "category": "Pulse (dry)",
    "subCategory": "",
    "name": "Chickpeas",
    "variety": "Kabuli/Desi",
    "form": "Dry",
    "useCase": "Food",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "Export",
    "extras": {
      "HS Code (placeholder)": "0713",
      "Tags": "pulse"
    }
  },
  {
    "type": "product",
    "category": "Pulse (dry)",
    "subCategory": "",
    "name": "Lentils",
    "variety": "Red/Green",
    "form": "Dry",
    "useCase": "Food",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "Export",
    "extras": {
      "HS Code (placeholder)": "0713",
      "Tags": "pulse"
    }
  },
  {
    "type": "product",
    "category": "Pulse (dry)",
    "subCategory": "",
    "name": "Pigeon peas",
    "variety": "",
    "form": "Dry",
    "useCase": "Food",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "Export",
    "extras": {
      "HS Code (placeholder)": "0713",
      "Tags": "pulse"
    }
  },
  {
    "type": "product",
    "category": "Pulse (dry)",
    "subCategory": "",
    "name": "Cowpeas",
    "variety": "",
    "form": "Dry",
    "useCase": "Food",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "Export",
    "extras": {
      "HS Code (placeholder)": "0713",
      "Tags": "pulse"
    }
  },
  {
    "type": "product",
    "category": "Pulse (dry)",
    "subCategory": "",
    "name": "Mung beans (green gram)",
    "variety": "",
    "form": "Dry",
    "useCase": "Food",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "Export",
    "extras": {
      "HS Code (placeholder)": "0713",
      "Tags": "pulse"
    }
  },
  {
    "type": "product",
    "category": "Pulse (dry)",
    "subCategory": "",
    "name": "Urad/Black gram",
    "variety": "",
    "form": "Dry",
    "useCase": "Food",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "Export",
    "extras": {
      "HS Code (placeholder)": "0713",
      "Tags": "pulse"
    }
  },
  {
    "type": "product",
    "category": "Pulse (dry)",
    "subCategory": "",
    "name": "Faba/Broad beans",
    "variety": "",
    "form": "Dry",
    "useCase": "Food",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "Export",
    "extras": {
      "HS Code (placeholder)": "0713",
      "Tags": "pulse"
    }
  },
  {
    "type": "product",
    "category": "Pulse (dry)",
    "subCategory": "",
    "name": "Split peas",
    "variety": "Yellow/Green",
    "form": "Dry",
    "useCase": "Food",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "Export",
    "extras": {
      "HS Code (placeholder)": "0713",
      "Tags": "pulse"
    }
  },
  {
    "type": "product",
    "category": "Oilseed",
    "subCategory": "",
    "name": "Groundnut/Peanut",
    "variety": "Runner/Virginia",
    "form": "In-shell/Kernels/Crude oil/Cake",
    "useCase": "Food/Oil",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "AFLA-compliant",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "HACCP (processing)",
      "HS Code (placeholder)": "1202/1508",
      "Tags": "oilseed"
    }
  },
  {
    "type": "product",
    "category": "Oilseed",
    "subCategory": "",
    "name": "Sesame",
    "variety": "White/Black",
    "form": "Seed/Oil",
    "useCase": "Food/Oil",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "Export",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "Organic (opt.)",
      "HS Code (placeholder)": "1207/1515",
      "Tags": "high-value,oilseed"
    }
  },
  {
    "type": "product",
    "category": "Oilseed",
    "subCategory": "",
    "name": "Safflower",
    "variety": "",
    "form": "Seed/Oil",
    "useCase": "Food/Oil",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "1207/1512",
      "Tags": "niche"
    }
  },
  {
    "type": "product",
    "category": "Oilseed",
    "subCategory": "",
    "name": "Linseed/Flax",
    "variety": "",
    "form": "Seed/Oil",
    "useCase": "Food/Oil",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "Cold-pressed",
      "HS Code (placeholder)": "1204/1515",
      "Tags": "niche"
    }
  },
  {
    "type": "product",
    "category": "Oilseed",
    "subCategory": "",
    "name": "Camelina",
    "variety": "",
    "form": "Seed/Oil",
    "useCase": "Food/Oil/Biofuel",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "1207",
      "Tags": "niche"
    }
  },
  {
    "type": "product",
    "category": "Oilseed",
    "subCategory": "Tropical oils",
    "name": "Coconut products",
    "variety": "Copra",
    "form": "Crude oil/Desiccated",
    "useCase": "Food/Oil",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "Organic (opt.)",
      "HS Code (placeholder)": "1203/1513",
      "Tags": "tropical"
    }
  },
  {
    "type": "product",
    "category": "Oilseed",
    "subCategory": "Tropical oils",
    "name": "Shea",
    "variety": "",
    "form": "Nuts/Butter",
    "useCase": "Cosmetic/Food",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "Organic (opt.)",
      "HS Code (placeholder)": "1207/1515",
      "Tags": "cosmetic"
    }
  },
  {
    "type": "product",
    "category": "Oilseed",
    "subCategory": "",
    "name": "Castor",
    "variety": "",
    "form": "Seed/Crude oil",
    "useCase": "Industrial",
    "typicalPackSize": "50.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "1207/1515",
      "Tags": "industrial"
    }
  },
  {
    "type": "product",
    "category": "Oilseed",
    "subCategory": "Tree seed oils",
    "name": "Olive",
    "variety": "Arbequina/Picual",
    "form": "Table/Oil",
    "useCase": "Food",
    "typicalPackSize": "5.0",
    "unit": "kg tin",
    "grade": "EVOO/VOO",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "PDO/PGI (where app.)",
      "HS Code (placeholder)": "1509/0709",
      "Tags": "mediterranean"
    }
  },
  {
    "type": "product",
    "category": "Oilseed",
    "subCategory": "Tree seed oils",
    "name": "Avocado oil (from culls)",
    "variety": "Hass",
    "form": "Crude/Refined oil",
    "useCase": "Food/Cosmetic",
    "typicalPackSize": "20.0",
    "unit": "L jerrycan",
    "grade": "Food grade",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "HACCP",
      "HS Code (placeholder)": "1515",
      "Tags": "value-add"
    }
  },
  {
    "type": "product",
    "category": "Nut",
    "subCategory": "",
    "name": "Cashew",
    "variety": "",
    "form": "Raw kernels/W320 etc.",
    "useCase": "Food",
    "typicalPackSize": "22.68",
    "unit": "kg carton",
    "grade": "W320/W240",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "Organic (opt.)",
      "HS Code (placeholder)": "0801",
      "Tags": "high-value"
    }
  },
  {
    "type": "product",
    "category": "Nut",
    "subCategory": "",
    "name": "Macadamia",
    "variety": "",
    "form": "In-shell/Kernels",
    "useCase": "Food",
    "typicalPackSize": "25.0",
    "unit": "kg carton",
    "grade": "Style 1-4",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "Organic (opt.)",
      "HS Code (placeholder)": "0802",
      "Tags": "premium"
    }
  },
  {
    "type": "product",
    "category": "Nut",
    "subCategory": "",
    "name": "Almond",
    "variety": "",
    "form": "Kernels",
    "useCase": "Food",
    "typicalPackSize": "22.68",
    "unit": "kg carton",
    "grade": "Nonpareil/Carmel",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "US/EU stds.",
      "HS Code (placeholder)": "0802",
      "Tags": "nut"
    }
  },
  {
    "type": "product",
    "category": "Nut",
    "subCategory": "",
    "name": "Pistachio",
    "variety": "",
    "form": "In-shell/Kernels",
    "useCase": "Food",
    "typicalPackSize": "22.68",
    "unit": "kg carton",
    "grade": "Grade 1",
    "extras": {
      "HS Code (placeholder)": "0802",
      "Tags": "nut"
    }
  },
  {
    "type": "product",
    "category": "Nut",
    "subCategory": "",
    "name": "Walnut",
    "variety": "",
    "form": "In-shell/Kernels",
    "useCase": "Food",
    "typicalPackSize": "25.0",
    "unit": "kg bag/carton",
    "grade": "Light/Extra Light",
    "extras": {
      "HS Code (placeholder)": "0802",
      "Tags": "nut"
    }
  },
  {
    "type": "product",
    "category": "Nut",
    "subCategory": "",
    "name": "Hazelnut",
    "variety": "",
    "form": "In-shell/Kernels",
    "useCase": "Food",
    "typicalPackSize": "25.0",
    "unit": "kg bag/carton",
    "grade": "Extra",
    "extras": {
      "HS Code (placeholder)": "0802",
      "Tags": "nut"
    }
  },
  {
    "type": "product",
    "category": "Nut",
    "subCategory": "",
    "name": "Pecan",
    "variety": "",
    "form": "In-shell/Kernels",
    "useCase": "Food",
    "typicalPackSize": "22.68",
    "unit": "kg carton",
    "grade": "Fancy",
    "extras": {
      "HS Code (placeholder)": "0802",
      "Tags": "nut"
    }
  },
  {
    "type": "product",
    "category": "Nut",
    "subCategory": "",
    "name": "Brazil nut",
    "variety": "",
    "form": "In-shell/Kernels",
    "useCase": "Food",
    "typicalPackSize": "20.0",
    "unit": "kg bag/carton",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "0801",
      "Tags": "nut"
    }
  },
  {
    "type": "product",
    "category": "Nut",
    "subCategory": "",
    "name": "Chestnut",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "10.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "0802",
      "Tags": "seasonal"
    }
  },
  {
    "type": "product",
    "category": "Nut",
    "subCategory": "",
    "name": "Pine nut",
    "variety": "",
    "form": "Kernels",
    "useCase": "Food",
    "typicalPackSize": "10.0",
    "unit": "kg carton",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "0802",
      "Tags": "premium"
    }
  },
  {
    "type": "product",
    "category": "Nut",
    "subCategory": "",
    "name": "Tiger nut (chufa)",
    "variety": "",
    "form": "Dried",
    "useCase": "Food/Drink (horchata)",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "0714/0802",
      "Tags": "niche"
    }
  },
  {
    "type": "product",
    "category": "Spice",
    "subCategory": "",
    "name": "Black pepper",
    "variety": "",
    "form": "Whole/Ground",
    "useCase": "Culinary",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "ASTA grade",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "HACCP",
      "HS Code (placeholder)": "0904",
      "Tags": "high-value"
    }
  },
  {
    "type": "product",
    "category": "Spice",
    "subCategory": "",
    "name": "Cardamom (green)",
    "variety": "",
    "form": "Whole/Ground",
    "useCase": "Culinary",
    "typicalPackSize": "5.0",
    "unit": "kg carton",
    "grade": "AGD grades",
    "extras": {
      "HS Code (placeholder)": "0908",
      "Tags": "premium"
    }
  },
  {
    "type": "product",
    "category": "Spice",
    "subCategory": "",
    "name": "Cardamom (black)",
    "variety": "",
    "form": "Pods",
    "useCase": "Culinary",
    "typicalPackSize": "5.0",
    "unit": "kg carton",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "0908",
      "Tags": "niche"
    }
  },
  {
    "type": "product",
    "category": "Spice",
    "subCategory": "",
    "name": "Cloves",
    "variety": "",
    "form": "Whole/Ground",
    "useCase": "Culinary",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "Hand-picked",
    "extras": {
      "HS Code (placeholder)": "0907",
      "Tags": "high-value"
    }
  },
  {
    "type": "product",
    "category": "Spice",
    "subCategory": "",
    "name": "Cinnamon (Ceylon)",
    "variety": "",
    "form": "Quills/Ground",
    "useCase": "Culinary",
    "typicalPackSize": "10.0",
    "unit": "kg carton",
    "grade": "True cinnamon",
    "extras": {
      "HS Code (placeholder)": "0906",
      "Tags": "premium"
    }
  },
  {
    "type": "product",
    "category": "Spice",
    "subCategory": "",
    "name": "Cassia cinnamon",
    "variety": "",
    "form": "Sticks/Ground",
    "useCase": "Culinary",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "0906",
      "Tags": "bulk"
    }
  },
  {
    "type": "product",
    "category": "Spice",
    "subCategory": "",
    "name": "Nutmeg & Mace",
    "variety": "",
    "form": "Whole/Ground",
    "useCase": "Culinary",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "0908",
      "Tags": "high-value"
    }
  },
  {
    "type": "product",
    "category": "Spice",
    "subCategory": "",
    "name": "Cumin",
    "variety": "",
    "form": "Whole/Ground",
    "useCase": "Culinary",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "0909",
      "Tags": "spice"
    }
  },
  {
    "type": "product",
    "category": "Spice",
    "subCategory": "",
    "name": "Coriander seed",
    "variety": "",
    "form": "Whole/Ground",
    "useCase": "Culinary",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "0909",
      "Tags": "spice"
    }
  },
  {
    "type": "product",
    "category": "Spice",
    "subCategory": "",
    "name": "Fennel",
    "variety": "",
    "form": "Seed",
    "useCase": "Culinary",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "0909",
      "Tags": "spice"
    }
  },
  {
    "type": "product",
    "category": "Spice",
    "subCategory": "",
    "name": "Fenugreek",
    "variety": "",
    "form": "Seed",
    "useCase": "Culinary",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "0910",
      "Tags": "spice"
    }
  },
  {
    "type": "product",
    "category": "Spice",
    "subCategory": "",
    "name": "Mustard seed",
    "variety": "",
    "form": "Seed",
    "useCase": "Culinary",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "1207",
      "Tags": "spice"
    }
  },
  {
    "type": "product",
    "category": "Spice",
    "subCategory": "",
    "name": "Turmeric",
    "variety": "",
    "form": "Fresh/Dried Powder",
    "useCase": "Culinary",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "Curcumin %",
    "extras": {
      "HS Code (placeholder)": "0910",
      "Tags": "spice"
    }
  },
  {
    "type": "product",
    "category": "Spice",
    "subCategory": "",
    "name": "Ginger",
    "variety": "",
    "form": "Fresh/Dried Powder",
    "useCase": "Culinary",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "Fibre %",
    "extras": {
      "HS Code (placeholder)": "0910",
      "Tags": "spice"
    }
  },
  {
    "type": "product",
    "category": "Spice",
    "subCategory": "",
    "name": "Paprika/Chili powder",
    "variety": "",
    "form": "Powder/Flakes",
    "useCase": "Culinary",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "ASTA color",
    "extras": {
      "HS Code (placeholder)": "0904",
      "Tags": "spice"
    }
  },
  {
    "type": "product",
    "category": "Spice",
    "subCategory": "",
    "name": "Vanilla",
    "variety": "",
    "form": "Beans/Extract",
    "useCase": "Culinary",
    "typicalPackSize": "1.0",
    "unit": "kg bundle",
    "grade": "Gourmet/Extract grade",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "Organic (opt.)",
      "HS Code (placeholder)": "0905",
      "Tags": "ultra-premium"
    }
  },
  {
    "type": "product",
    "category": "Spice",
    "subCategory": "",
    "name": "Saffron",
    "variety": "",
    "form": "Threads/Powder",
    "useCase": "Culinary",
    "typicalPackSize": "0.5",
    "unit": "kg",
    "grade": "ISO 3632 cat.",
    "extras": {
      "HS Code (placeholder)": "0910",
      "Tags": "ultra-premium"
    }
  },
  {
    "type": "product",
    "category": "Spice",
    "subCategory": "",
    "name": "Allspice",
    "variety": "",
    "form": "Whole/Ground",
    "useCase": "Culinary",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "0904",
      "Tags": "spice"
    }
  },
  {
    "type": "product",
    "category": "Fiber",
    "subCategory": "",
    "name": "Sisal",
    "variety": "",
    "form": "Fiber/bales",
    "useCase": "Rope/Twine",
    "typicalPackSize": "250.0",
    "unit": "kg bale",
    "grade": "UG/I/UG grades",
    "extras": {
      "HS Code (placeholder)": "5304",
      "Tags": "fiber"
    }
  },
  {
    "type": "product",
    "category": "Fiber",
    "subCategory": "",
    "name": "Jute",
    "variety": "",
    "form": "Fiber/bales",
    "useCase": "Bags/Textiles",
    "typicalPackSize": "180.0",
    "unit": "kg bale",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "5303",
      "Tags": "fiber"
    }
  },
  {
    "type": "product",
    "category": "Fiber",
    "subCategory": "",
    "name": "Kenaf",
    "variety": "",
    "form": "Fiber/bales",
    "useCase": "Paper",
    "typicalPackSize": "200.0",
    "unit": "kg bale",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "5302",
      "Tags": "fiber"
    }
  },
  {
    "type": "product",
    "category": "Fiber",
    "subCategory": "",
    "name": "Flax (linen)",
    "variety": "",
    "form": "Fiber/bales",
    "useCase": "Textile",
    "typicalPackSize": "200.0",
    "unit": "kg bale",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "5301",
      "Tags": "fiber"
    }
  },
  {
    "type": "product",
    "category": "Fiber",
    "subCategory": "",
    "name": "Hemp (industrial)",
    "variety": "",
    "form": "Fiber/Hurd",
    "useCase": "Textile/Biocomposite",
    "typicalPackSize": "200.0",
    "unit": "kg bale",
    "grade": "",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "Compliant licensing",
      "HS Code (placeholder)": "5302",
      "Tags": "fiber,industrial"
    }
  },
  {
    "type": "product",
    "category": "Fiber",
    "subCategory": "",
    "name": "Coir (coconut fiber)",
    "variety": "",
    "form": "Fiber",
    "useCase": "Mats/Substrate",
    "typicalPackSize": "100.0",
    "unit": "kg bale",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "5305",
      "Tags": "fiber"
    }
  },
  {
    "type": "product",
    "category": "Fiber",
    "subCategory": "",
    "name": "Bamboo poles/fiber",
    "variety": "",
    "form": "Poles/Strips/Fiber",
    "useCase": "Construction/Crafts",
    "typicalPackSize": "1.0",
    "unit": "ton",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "1401/4407",
      "Tags": "fiber,construction"
    }
  },
  {
    "type": "product",
    "category": "Floriculture",
    "subCategory": "Cut flower",
    "name": "Roses",
    "variety": "T-hybrid/Spray",
    "form": "Fresh cut",
    "useCase": "Ornamental",
    "typicalPackSize": "10.0",
    "unit": "stems/bunch",
    "grade": "Export Class",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "MPS/GlobalG.A.P.",
      "HS Code (placeholder)": "0603",
      "Tags": "floriculture"
    }
  },
  {
    "type": "product",
    "category": "Floriculture",
    "subCategory": "Cut flower",
    "name": "Carnations",
    "variety": "",
    "form": "Fresh cut",
    "useCase": "Ornamental",
    "typicalPackSize": "10.0",
    "unit": "stems/bunch",
    "grade": "Export Class",
    "extras": {
      "HS Code (placeholder)": "0603",
      "Tags": "floriculture"
    }
  },
  {
    "type": "product",
    "category": "Floriculture",
    "subCategory": "Cut flower",
    "name": "Chrysanthemums",
    "variety": "",
    "form": "Fresh cut",
    "useCase": "Ornamental",
    "typicalPackSize": "10.0",
    "unit": "stems/bunch",
    "grade": "Export Class",
    "extras": {
      "HS Code (placeholder)": "0603",
      "Tags": "floriculture"
    }
  },
  {
    "type": "product",
    "category": "Floriculture",
    "subCategory": "Cut flower",
    "name": "Alstroemeria",
    "variety": "",
    "form": "Fresh cut",
    "useCase": "Ornamental",
    "typicalPackSize": "10.0",
    "unit": "stems/bunch",
    "grade": "Export Class",
    "extras": {
      "HS Code (placeholder)": "0603",
      "Tags": "floriculture"
    }
  },
  {
    "type": "product",
    "category": "Floriculture",
    "subCategory": "Filler",
    "name": "Gypsophila",
    "variety": "",
    "form": "Fresh cut",
    "useCase": "Ornamental",
    "typicalPackSize": "10.0",
    "unit": "stems/bunch",
    "grade": "Export Class",
    "extras": {
      "HS Code (placeholder)": "0603",
      "Tags": "floriculture"
    }
  },
  {
    "type": "product",
    "category": "Floriculture",
    "subCategory": "Cut flower",
    "name": "Lilies",
    "variety": "",
    "form": "Fresh cut",
    "useCase": "Ornamental",
    "typicalPackSize": "5.0",
    "unit": "stems/bunch",
    "grade": "Export Class",
    "extras": {
      "HS Code (placeholder)": "0603",
      "Tags": "floriculture"
    }
  },
  {
    "type": "product",
    "category": "Floriculture",
    "subCategory": "Cut flower",
    "name": "Gerbera",
    "variety": "",
    "form": "Fresh cut",
    "useCase": "Ornamental",
    "typicalPackSize": "10.0",
    "unit": "stems/bunch",
    "grade": "Export Class",
    "extras": {
      "HS Code (placeholder)": "0603",
      "Tags": "floriculture"
    }
  },
  {
    "type": "product",
    "category": "Floriculture",
    "subCategory": "Cut foliage",
    "name": "Foliage (assorted)",
    "variety": "Ruscus/Eucalyptus/Leatherleaf",
    "form": "Fresh cut",
    "useCase": "Ornamental",
    "typicalPackSize": "10.0",
    "unit": "stems/bunch",
    "grade": "Export Class",
    "extras": {
      "HS Code (placeholder)": "0604",
      "Tags": "foliage"
    }
  },
  {
    "type": "product",
    "category": "Industrial/Beverage",
    "subCategory": "",
    "name": "Hops",
    "variety": "Aroma/Bittering",
    "form": "Pellets/Cones",
    "useCase": "Brewing",
    "typicalPackSize": "5.0",
    "unit": "kg foil pack",
    "grade": "Alpha acid %",
    "extras": {
      "HS Code (placeholder)": "1210",
      "Tags": "brewing"
    }
  },
  {
    "type": "product",
    "category": "Beverage crop",
    "subCategory": "",
    "name": "Yerba mate",
    "variety": "",
    "form": "Dried leaves",
    "useCase": "Beverage",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "0903",
      "Tags": "beverage"
    }
  },
  {
    "type": "product",
    "category": "Beverage crop",
    "subCategory": "",
    "name": "Kava",
    "variety": "",
    "form": "Dried root powder",
    "useCase": "Beverage/Medicinal",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "1211",
      "Tags": "botanical"
    }
  },
  {
    "type": "product",
    "category": "Sweetener/Botanical",
    "subCategory": "",
    "name": "Stevia",
    "variety": "",
    "form": "Dry leaves/Extract",
    "useCase": "Sweetener",
    "typicalPackSize": "20.0",
    "unit": "kg bag",
    "grade": "Reb A %",
    "extras": {
      "HS Code (placeholder)": "1211/1702",
      "Tags": "natural-sweetener"
    }
  },
  {
    "type": "product",
    "category": "Sweetener",
    "subCategory": "",
    "name": "Agave",
    "variety": "Blue Weber",
    "form": "Syrup/Agave hearts",
    "useCase": "Sweetener/Spirits",
    "typicalPackSize": "25.0",
    "unit": "kg",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "1212/1702/2208",
      "Tags": "sweetener"
    }
  },
  {
    "type": "product",
    "category": "Industrial",
    "subCategory": "",
    "name": "Tobacco (where permitted)",
    "variety": "Virginia/Burley",
    "form": "Leaf",
    "useCase": "Cigarette/Cigar",
    "typicalPackSize": "50.0",
    "unit": "kg bale",
    "grade": "Grades per market",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "Compliance req.",
      "HS Code (placeholder)": "2401",
      "Tags": "regulated"
    }
  },
  {
    "type": "product",
    "category": "Industrial/Botanical",
    "subCategory": "",
    "name": "Gum arabic (Acacia)",
    "variety": "",
    "form": "Kibbled/ powder",
    "useCase": "Food/Pharma",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "Kordofan/Hashab",
    "extras": {
      "HS Code (placeholder)": "1301",
      "Tags": "gum"
    }
  },
  {
    "type": "product",
    "category": "Industrial/Botanical",
    "subCategory": "",
    "name": "Frankincense/Myrrh",
    "variety": "",
    "form": "Resin",
    "useCase": "Incense/Perfume",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "1301",
      "Tags": "resin"
    }
  },
  {
    "type": "product",
    "category": "Industrial",
    "subCategory": "",
    "name": "Natural latex (centrifuged)",
    "variety": "",
    "form": "Latex",
    "useCase": "Manufacturing",
    "typicalPackSize": "1.0",
    "unit": "ton",
    "grade": "DRC %",
    "extras": {
      "HS Code (placeholder)": "4001",
      "Tags": "industrial"
    }
  },
  {
    "type": "product",
    "category": "Botanical",
    "subCategory": "",
    "name": "Moringa",
    "variety": "Leaf/Seed",
    "form": "Dried leaf powder/Oil",
    "useCase": "Nutraceutical/Cosmetic",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "Organic (opt.)",
      "HS Code (placeholder)": "1211/1515",
      "Tags": "superfood"
    }
  },
  {
    "type": "product",
    "category": "Botanical",
    "subCategory": "",
    "name": "Aloe vera",
    "variety": "",
    "form": "Fresh leaf/Gel/Powder",
    "useCase": "Cosmetic/Nutraceutical",
    "typicalPackSize": "20.0",
    "unit": "kg box",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "1211",
      "Tags": "cosmetic"
    }
  },
  {
    "type": "product",
    "category": "Botanical",
    "subCategory": "",
    "name": "Neem",
    "variety": "",
    "form": "Leaf/Seed oil",
    "useCase": "Biopesticide/Cosmetic",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "1211",
      "Tags": "biocontrol"
    }
  },
  {
    "type": "product",
    "category": "Botanical",
    "subCategory": "",
    "name": "Artemisia annua",
    "variety": "",
    "form": "Dried herb",
    "useCase": "Pharma",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "Artemisinin %",
    "extras": {
      "HS Code (placeholder)": "1211",
      "Tags": "pharma"
    }
  },
  {
    "type": "product",
    "category": "Botanical",
    "subCategory": "",
    "name": "Calendula",
    "variety": "",
    "form": "Dried flowers",
    "useCase": "Cosmetic",
    "typicalPackSize": "10.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "1211",
      "Tags": "cosmetic"
    }
  },
  {
    "type": "product",
    "category": "Botanical",
    "subCategory": "",
    "name": "Chamomile",
    "variety": "",
    "form": "Dried flowers",
    "useCase": "Tea/Cosmetic",
    "typicalPackSize": "10.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "1211",
      "Tags": "botanical"
    }
  },
  {
    "type": "product",
    "category": "Botanical",
    "subCategory": "",
    "name": "Lavender",
    "variety": "",
    "form": "Dried flowers/Oil",
    "useCase": "Cosmetic",
    "typicalPackSize": "10.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "Organic (opt.)",
      "HS Code (placeholder)": "1211/3301",
      "Tags": "essential-oil"
    }
  },
  {
    "type": "product",
    "category": "Botanical",
    "subCategory": "",
    "name": "Tea tree",
    "variety": "",
    "form": "Essential oil",
    "useCase": "Cosmetic/Antiseptic",
    "typicalPackSize": "5.0",
    "unit": "kg can",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "3301",
      "Tags": "essential-oil"
    }
  },
  {
    "type": "product",
    "category": "Botanical",
    "subCategory": "",
    "name": "Witch hazel",
    "variety": "",
    "form": "Extract/Distillate",
    "useCase": "Cosmetic",
    "typicalPackSize": "20.0",
    "unit": "kg can",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "3301/1211",
      "Tags": "cosmetic"
    }
  },
  {
    "type": "product",
    "category": "Mushroom",
    "subCategory": "",
    "name": "Button mushroom",
    "variety": "Agaricus bisporus",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "2.0",
    "unit": "kg punnet/carton",
    "grade": "Class I",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "GlobalG.A.P.",
      "HS Code (placeholder)": "0709",
      "Tags": "fungi"
    }
  },
  {
    "type": "product",
    "category": "Mushroom",
    "subCategory": "",
    "name": "Oyster mushroom",
    "variety": "Pleurotus ostreatus",
    "form": "Fresh/Dried",
    "useCase": "Food",
    "typicalPackSize": "2.0",
    "unit": "kg punnet/carton",
    "grade": "Class I",
    "extras": {
      "HS Code (placeholder)": "0709/0712",
      "Tags": "fungi"
    }
  },
  {
    "type": "product",
    "category": "Mushroom",
    "subCategory": "",
    "name": "Shiitake",
    "variety": "Lentinula edodes",
    "form": "Fresh/Dried",
    "useCase": "Food",
    "typicalPackSize": "2.0",
    "unit": "kg punnet/carton",
    "grade": "Class I",
    "extras": {
      "HS Code (placeholder)": "0709/0712",
      "Tags": "fungi"
    }
  },
  {
    "type": "product",
    "category": "Mushroom",
    "subCategory": "",
    "name": "Lion's mane",
    "variety": "Hericium erinaceus",
    "form": "Fresh/Dried",
    "useCase": "Food/Nutraceutical",
    "typicalPackSize": "1.0",
    "unit": "kg carton",
    "grade": "Class I",
    "extras": {
      "HS Code (placeholder)": "0709/0712",
      "Tags": "fungi"
    }
  },
  {
    "type": "product",
    "category": "Mushroom",
    "subCategory": "",
    "name": "Enoki",
    "variety": "Flammulina velutipes",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "1.0",
    "unit": "kg carton",
    "grade": "Class I",
    "extras": {
      "HS Code (placeholder)": "0709",
      "Tags": "fungi"
    }
  },
  {
    "type": "product",
    "category": "Mushroom",
    "subCategory": "",
    "name": "King oyster",
    "variety": "Pleurotus eryngii",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "1.0",
    "unit": "kg carton",
    "grade": "Class I",
    "extras": {
      "HS Code (placeholder)": "0709",
      "Tags": "fungi"
    }
  },
  {
    "type": "product",
    "category": "Mushroom",
    "subCategory": "",
    "name": "Wood ear",
    "variety": "Auricularia spp.",
    "form": "Dried",
    "useCase": "Food",
    "typicalPackSize": "5.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "HS Code (placeholder)": "0712",
      "Tags": "fungi"
    }
  },
  {
    "type": "product",
    "category": "Aquatic plant",
    "subCategory": "",
    "name": "Kelp/Seaweed",
    "variety": "Kombu/Wakame/Nori",
    "form": "Dried/Sheets",
    "useCase": "Food",
    "typicalPackSize": "25.0",
    "unit": "kg bag",
    "grade": "",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "Organic (opt.)",
      "HS Code (placeholder)": "1212",
      "Tags": "seaweed"
    }
  },
  {
    "type": "product",
    "category": "Aquatic plant",
    "subCategory": "",
    "name": "Spirulina",
    "variety": "Arthrospira",
    "form": "Powder/Tablets",
    "useCase": "Food/Nutraceutical",
    "typicalPackSize": "5.0",
    "unit": "kg can",
    "grade": "",
    "extras": {
      "Certifications (Organic/GAP/Fairtrade/etc.)": "Food-safe",
      "HS Code (placeholder)": "2106/1212",
      "Tags": "microalgae"
    }
  },
  {
    "type": "product",
    "category": "Vegetable",
    "subCategory": "Leafy aquatic",
    "name": "Watercress",
    "variety": "",
    "form": "Fresh",
    "useCase": "Food",
    "typicalPackSize": "2.0",
    "unit": "kg carton",
    "grade": "Class I",
    "extras": {
      "HS Code (placeholder)": "0709",
      "Tags": "aquatic"
    }
  },
  {
    "type": "tree",
    "category": "Medicinal & Aromatic",
    "subCategory": "",
    "name": "Sandalwood",
    "variety": "",
    "form": "",
    "useCase": "Perfumery, medicine, cosmetics",
    "typicalPackSize": "",
    "unit": "kg/litre",
    "grade": "",
    "extras": {
      "Primary Products": "Heartwood oil, powder",
      "Byproducts": "Incense, soap, perfume",
      "Region of Origin / Prevalence": "India, Australia, Pacific",
      "Certifications / Standards": "Organic, CITES",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "CITES-listed",
      "Tags": "sandalwood,oil,perfume,cosmetic"
    }
  },
  {
    "type": "tree",
    "category": "Medicinal & Aromatic",
    "subCategory": "",
    "name": "Agarwood (Oud)",
    "variety": "",
    "form": "",
    "useCase": "Perfume, incense, luxury products",
    "typicalPackSize": "",
    "unit": "kg",
    "grade": "",
    "extras": {
      "Primary Products": "Resinous wood, oil",
      "Byproducts": "Chips, incense",
      "Region of Origin / Prevalence": "Asia, Middle East",
      "Certifications / Standards": "Organic, CITES",
      "Carbon Credit Potential": "Medium",
      "CITES / Conservation Status": "CITES-listed",
      "Tags": "agarwood,oud,perfume,resin"
    }
  },
  {
    "type": "tree",
    "category": "Medicinal & Aromatic",
    "subCategory": "",
    "name": "Frankincense",
    "variety": "",
    "form": "",
    "useCase": "Cosmetics, incense, aromatherapy",
    "typicalPackSize": "",
    "unit": "kg",
    "grade": "",
    "extras": {
      "Primary Products": "Resin, essential oil",
      "Byproducts": "Powder, perfume base",
      "Region of Origin / Prevalence": "Somalia, Oman, Arabia",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Partially protected",
      "Tags": "frankincense,resin,oil"
    }
  },
  {
    "type": "tree",
    "category": "Medicinal & Aromatic",
    "subCategory": "",
    "name": "Myrrh",
    "variety": "",
    "form": "",
    "useCase": "Pharma, perfume, antiseptic",
    "typicalPackSize": "",
    "unit": "kg",
    "grade": "",
    "extras": {
      "Primary Products": "Resin, oil",
      "Byproducts": "Powder, incense",
      "Region of Origin / Prevalence": "Horn of Africa, Arabia",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Protected",
      "Tags": "myrrh,resin,essentialoil"
    }
  },
  {
    "type": "tree",
    "category": "Aromatic & Industrial",
    "subCategory": "",
    "name": "Eucalyptus",
    "variety": "",
    "form": "",
    "useCase": "Medicine, timber, essential oil",
    "typicalPackSize": "",
    "unit": "Litre, ton",
    "grade": "",
    "extras": {
      "Primary Products": "Oil, leaves",
      "Byproducts": "Timber, sawdust",
      "Region of Origin / Prevalence": "Australia, Africa",
      "Certifications / Standards": "GAP, Organic",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Not listed",
      "Tags": "eucalyptus,oil,industrial"
    }
  },
  {
    "type": "tree",
    "category": "Medicinal & Aromatic",
    "subCategory": "",
    "name": "Tea Tree",
    "variety": "",
    "form": "",
    "useCase": "Antiseptic, cosmetics",
    "typicalPackSize": "",
    "unit": "Litre",
    "grade": "",
    "extras": {
      "Primary Products": "Essential oil",
      "Byproducts": "Residue",
      "Region of Origin / Prevalence": "Australia",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Not listed",
      "Tags": "tea-tree,essentialoil"
    }
  },
  {
    "type": "tree",
    "category": "Aromatic",
    "subCategory": "",
    "name": "Camphor",
    "variety": "",
    "form": "",
    "useCase": "Medicinal, insect repellent",
    "typicalPackSize": "",
    "unit": "kg",
    "grade": "",
    "extras": {
      "Primary Products": "Oil, resin",
      "Byproducts": "Crystals",
      "Region of Origin / Prevalence": "Asia",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "Medium",
      "CITES / Conservation Status": "Not listed",
      "Tags": "camphor,oil,resin"
    }
  },
  {
    "type": "tree",
    "category": "Aromatic",
    "subCategory": "",
    "name": "Cajeput",
    "variety": "",
    "form": "",
    "useCase": "Medicine, antiseptic",
    "typicalPackSize": "",
    "unit": "Litre",
    "grade": "",
    "extras": {
      "Primary Products": "Oil",
      "Byproducts": "Leaves",
      "Region of Origin / Prevalence": "Asia",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "Medium",
      "CITES / Conservation Status": "Not listed",
      "Tags": "cajeput,oil"
    }
  },
  {
    "type": "tree",
    "category": "Aromatic",
    "subCategory": "",
    "name": "Bay Laurel",
    "variety": "",
    "form": "",
    "useCase": "Food flavor, fragrance",
    "typicalPackSize": "",
    "unit": "kg",
    "grade": "",
    "extras": {
      "Primary Products": "Leaf oil",
      "Byproducts": "Timber",
      "Region of Origin / Prevalence": "Mediterranean",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "Medium",
      "CITES / Conservation Status": "Not listed",
      "Tags": "bayleaf,oil,fragrance"
    }
  },
  {
    "type": "tree",
    "category": "Timber & Forestry",
    "subCategory": "",
    "name": "Teak",
    "variety": "",
    "form": "",
    "useCase": "Furniture, shipbuilding, flooring",
    "typicalPackSize": "",
    "unit": "Cubic meter",
    "grade": "",
    "extras": {
      "Primary Products": "Hardwood",
      "Byproducts": "Sawdust, oil",
      "Region of Origin / Prevalence": "Asia, Africa, Latin America",
      "Certifications / Standards": "FSC, PEFC",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Not listed",
      "Tags": "teak,timber,wood"
    }
  },
  {
    "type": "tree",
    "category": "Timber & Forestry",
    "subCategory": "",
    "name": "Mahogany",
    "variety": "",
    "form": "",
    "useCase": "Furniture, joinery, boats",
    "typicalPackSize": "",
    "unit": "Cubic meter",
    "grade": "",
    "extras": {
      "Primary Products": "Hardwood",
      "Byproducts": "Veneer, sawdust",
      "Region of Origin / Prevalence": "Tropics worldwide",
      "Certifications / Standards": "FSC",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Partially protected",
      "Tags": "mahogany,timber,wood"
    }
  },
  {
    "type": "tree",
    "category": "Timber & Forestry",
    "subCategory": "",
    "name": "Rosewood",
    "variety": "",
    "form": "",
    "useCase": "Furniture, instruments, carvings",
    "typicalPackSize": "",
    "unit": "Cubic meter",
    "grade": "",
    "extras": {
      "Primary Products": "Timber",
      "Byproducts": "Resin, sawdust",
      "Region of Origin / Prevalence": "Africa, Asia, Latin America",
      "Certifications / Standards": "CITES",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "CITES-listed",
      "Tags": "rosewood,timber,luxury"
    }
  },
  {
    "type": "tree",
    "category": "Timber & Forestry",
    "subCategory": "",
    "name": "Ebony",
    "variety": "",
    "form": "",
    "useCase": "Musical instruments, carvings",
    "typicalPackSize": "",
    "unit": "Cubic meter",
    "grade": "",
    "extras": {
      "Primary Products": "Dark hardwood",
      "Byproducts": "Shavings",
      "Region of Origin / Prevalence": "Africa, Asia",
      "Certifications / Standards": "CITES",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "CITES-listed",
      "Tags": "ebony,timber,instrument"
    }
  },
  {
    "type": "tree",
    "category": "Timber & Forestry",
    "subCategory": "",
    "name": "Pine",
    "variety": "",
    "form": "",
    "useCase": "Construction, resin",
    "typicalPackSize": "",
    "unit": "Cubic meter",
    "grade": "",
    "extras": {
      "Primary Products": "Softwood",
      "Byproducts": "Resin, turpentine",
      "Region of Origin / Prevalence": "Global",
      "Certifications / Standards": "FSC",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Not listed",
      "Tags": "pine,timber,resin"
    }
  },
  {
    "type": "tree",
    "category": "Timber & Aromatic",
    "subCategory": "",
    "name": "Cedar",
    "variety": "",
    "form": "",
    "useCase": "Furniture, fragrance, flooring",
    "typicalPackSize": "",
    "unit": "Cubic meter",
    "grade": "",
    "extras": {
      "Primary Products": "Timber, oil",
      "Byproducts": "Bark, sawdust",
      "Region of Origin / Prevalence": "Global",
      "Certifications / Standards": "FSC",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Not listed",
      "Tags": "cedar,timber,oil"
    }
  },
  {
    "type": "tree",
    "category": "Timber & Aromatic",
    "subCategory": "",
    "name": "Cypress",
    "variety": "",
    "form": "",
    "useCase": "Aromatic wood, flooring",
    "typicalPackSize": "",
    "unit": "Cubic meter",
    "grade": "",
    "extras": {
      "Primary Products": "Timber, oil",
      "Byproducts": "Cones",
      "Region of Origin / Prevalence": "Europe, Africa",
      "Certifications / Standards": "FSC",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Not listed",
      "Tags": "cypress,wood,oil"
    }
  },
  {
    "type": "tree",
    "category": "Timber & Industrial",
    "subCategory": "",
    "name": "Oak",
    "variety": "",
    "form": "",
    "useCase": "Furniture, wine barrels",
    "typicalPackSize": "",
    "unit": "Cubic meter",
    "grade": "",
    "extras": {
      "Primary Products": "Hardwood",
      "Byproducts": "Bark, tannin",
      "Region of Origin / Prevalence": "Europe, America",
      "Certifications / Standards": "FSC",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Not listed",
      "Tags": "oak,timber,wine"
    }
  },
  {
    "type": "tree",
    "category": "Industrial",
    "subCategory": "",
    "name": "Bamboo",
    "variety": "",
    "form": "",
    "useCase": "Construction, paper, fiber",
    "typicalPackSize": "",
    "unit": "Ton",
    "grade": "",
    "extras": {
      "Primary Products": "Poles",
      "Byproducts": "Charcoal, pulp, fiber",
      "Region of Origin / Prevalence": "Asia, Africa",
      "Certifications / Standards": "FSC",
      "Carbon Credit Potential": "Very High",
      "CITES / Conservation Status": "Not listed",
      "Tags": "bamboo,timber,fiber"
    }
  },
  {
    "type": "tree",
    "category": "Timber & Gum",
    "subCategory": "",
    "name": "Acacia",
    "variety": "",
    "form": "",
    "useCase": "Furniture, gum production",
    "typicalPackSize": "",
    "unit": "Cubic meter",
    "grade": "",
    "extras": {
      "Primary Products": "Timber, gum arabic",
      "Byproducts": "Resin, charcoal",
      "Region of Origin / Prevalence": "Africa, Asia",
      "Certifications / Standards": "FSC",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Not listed",
      "Tags": "acacia,timber,gum"
    }
  },
  {
    "type": "tree",
    "category": "Industrial & Oil",
    "subCategory": "",
    "name": "Oil Palm",
    "variety": "",
    "form": "",
    "useCase": "Food oil, biofuel, soap",
    "typicalPackSize": "",
    "unit": "Ton",
    "grade": "",
    "extras": {
      "Primary Products": "Palm oil, kernel",
      "Byproducts": "Empty bunch fiber, shells",
      "Region of Origin / Prevalence": "Global tropics",
      "Certifications / Standards": "RSPO, Organic",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Not listed",
      "Tags": "palm,oil,biofuel"
    }
  },
  {
    "type": "tree",
    "category": "Industrial",
    "subCategory": "",
    "name": "Rubber Tree",
    "variety": "",
    "form": "",
    "useCase": "Rubber products, gloves, tires",
    "typicalPackSize": "",
    "unit": "kg",
    "grade": "",
    "extras": {
      "Primary Products": "Natural latex",
      "Byproducts": "Timber, seeds, oil",
      "Region of Origin / Prevalence": "Asia, Africa",
      "Certifications / Standards": "FSC",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Not listed",
      "Tags": "rubber,latex"
    }
  },
  {
    "type": "tree",
    "category": "Industrial",
    "subCategory": "",
    "name": "Jatropha",
    "variety": "",
    "form": "",
    "useCase": "Biofuel",
    "typicalPackSize": "",
    "unit": "Litre",
    "grade": "",
    "extras": {
      "Primary Products": "Oil",
      "Byproducts": "Seed cake (fertilizer)",
      "Region of Origin / Prevalence": "Tropics",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Not listed",
      "Tags": "jatropha,oil,biofuel"
    }
  },
  {
    "type": "tree",
    "category": "Industrial",
    "subCategory": "",
    "name": "Castor",
    "variety": "",
    "form": "",
    "useCase": "Industrial lubricant, pharma",
    "typicalPackSize": "",
    "unit": "kg",
    "grade": "",
    "extras": {
      "Primary Products": "Castor oil",
      "Byproducts": "Cake, husk",
      "Region of Origin / Prevalence": "Asia, Africa",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Not listed",
      "Tags": "castor,oil,industrial"
    }
  },
  {
    "type": "tree",
    "category": "Industrial",
    "subCategory": "",
    "name": "Pongamia (Karanja)",
    "variety": "",
    "form": "",
    "useCase": "Biofuel",
    "typicalPackSize": "",
    "unit": "Litre",
    "grade": "",
    "extras": {
      "Primary Products": "Oil",
      "Byproducts": "Seed cake",
      "Region of Origin / Prevalence": "Asia",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Not listed",
      "Tags": "pongamia,karanja,oil"
    }
  },
  {
    "type": "tree",
    "category": "Industrial",
    "subCategory": "",
    "name": "Tung Tree",
    "variety": "",
    "form": "",
    "useCase": "Paints, coatings",
    "typicalPackSize": "",
    "unit": "Litre",
    "grade": "",
    "extras": {
      "Primary Products": "Tung oil",
      "Byproducts": "Resin",
      "Region of Origin / Prevalence": "China, Asia",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "Medium",
      "CITES / Conservation Status": "Not listed",
      "Tags": "tung,oil,paint"
    }
  },
  {
    "type": "tree",
    "category": "Industrial & Medicinal",
    "subCategory": "",
    "name": "Calophyllum (Tamanu)",
    "variety": "",
    "form": "",
    "useCase": "Cosmetics, medicine",
    "typicalPackSize": "",
    "unit": "Litre",
    "grade": "",
    "extras": {
      "Primary Products": "Tamanu oil",
      "Byproducts": "Cake, bark",
      "Region of Origin / Prevalence": "Pacific, SE Asia",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "Medium",
      "CITES / Conservation Status": "Not listed",
      "Tags": "tamanu,oil,cosmetic"
    }
  },
  {
    "type": "tree",
    "category": "Agroforestry & Carbon",
    "subCategory": "",
    "name": "Moringa",
    "variety": "",
    "form": "",
    "useCase": "Nutrition, feed, carbon sink",
    "typicalPackSize": "",
    "unit": "kg",
    "grade": "",
    "extras": {
      "Primary Products": "Leaves, seeds",
      "Byproducts": "Oil, powder, pods",
      "Region of Origin / Prevalence": "Africa, India",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "Very High",
      "CITES / Conservation Status": "Not listed",
      "Tags": "moringa,carbon,nutrition"
    }
  },
  {
    "type": "tree",
    "category": "Agroforestry & Medicinal",
    "subCategory": "",
    "name": "Neem",
    "variety": "",
    "form": "",
    "useCase": "Biocontrol, cosmetics",
    "typicalPackSize": "",
    "unit": "kg",
    "grade": "",
    "extras": {
      "Primary Products": "Oil, leaves",
      "Byproducts": "Pesticide, timber",
      "Region of Origin / Prevalence": "Asia, Africa",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Not listed",
      "Tags": "neem,pesticide,cosmetic"
    }
  },
  {
    "type": "tree",
    "category": "Agroforestry",
    "subCategory": "",
    "name": "Gliricidia",
    "variety": "",
    "form": "",
    "useCase": "Fodder, soil fertility",
    "typicalPackSize": "",
    "unit": "kg",
    "grade": "",
    "extras": {
      "Primary Products": "Fodder",
      "Byproducts": "Fuelwood",
      "Region of Origin / Prevalence": "Tropics",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Not listed",
      "Tags": "gliricidia,fodder,greenmanure"
    }
  },
  {
    "type": "tree",
    "category": "Agroforestry",
    "subCategory": "",
    "name": "Leucaena",
    "variety": "",
    "form": "",
    "useCase": "Feed, soil improvement",
    "typicalPackSize": "",
    "unit": "kg",
    "grade": "",
    "extras": {
      "Primary Products": "Fodder, poles",
      "Byproducts": "Seed meal",
      "Region of Origin / Prevalence": "Tropics",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Not listed",
      "Tags": "leucaena,fodder,carbon"
    }
  },
  {
    "type": "tree",
    "category": "Agroforestry",
    "subCategory": "",
    "name": "Grevillea robusta",
    "variety": "",
    "form": "",
    "useCase": "Agroforestry shade tree",
    "typicalPackSize": "",
    "unit": "Cubic meter",
    "grade": "",
    "extras": {
      "Primary Products": "Timber",
      "Byproducts": "Shade, mulch",
      "Region of Origin / Prevalence": "Africa, Australia",
      "Certifications / Standards": "FSC",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Not listed",
      "Tags": "grevillea,shade,timber"
    }
  },
  {
    "type": "tree",
    "category": "Agroforestry",
    "subCategory": "",
    "name": "Calliandra",
    "variety": "",
    "form": "",
    "useCase": "Soil enrichment, feed",
    "typicalPackSize": "",
    "unit": "kg",
    "grade": "",
    "extras": {
      "Primary Products": "Fodder",
      "Byproducts": "Charcoal",
      "Region of Origin / Prevalence": "Africa",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Not listed",
      "Tags": "calliandra,fodder,charcoal"
    }
  },
  {
    "type": "tree",
    "category": "Agroforestry",
    "subCategory": "",
    "name": "Faidherbia albida",
    "variety": "",
    "form": "",
    "useCase": "Nitrogen fixer, soil fertility",
    "typicalPackSize": "",
    "unit": "kg",
    "grade": "",
    "extras": {
      "Primary Products": "Pods",
      "Byproducts": "Leaves",
      "Region of Origin / Prevalence": "Africa",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Not listed",
      "Tags": "faidherbia,nitrogen,agroforestry"
    }
  },
  {
    "type": "tree",
    "category": "Agroforestry",
    "subCategory": "",
    "name": "Acacia senegal",
    "variety": "",
    "form": "",
    "useCase": "Resin, soil stabilizer",
    "typicalPackSize": "",
    "unit": "kg",
    "grade": "",
    "extras": {
      "Primary Products": "Gum arabic",
      "Byproducts": "Pods",
      "Region of Origin / Prevalence": "Sahel region",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Not listed",
      "Tags": "acacia,gum,resin"
    }
  },
  {
    "type": "tree",
    "category": "Agroforestry & Medicinal",
    "subCategory": "",
    "name": "Baobab",
    "variety": "",
    "form": "",
    "useCase": "Food supplement, carbon sink",
    "typicalPackSize": "",
    "unit": "kg",
    "grade": "",
    "extras": {
      "Primary Products": "Fruit pulp",
      "Byproducts": "Leaves, seeds",
      "Region of Origin / Prevalence": "Africa",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "High",
      "CITES / Conservation Status": "Protected",
      "Tags": "baobab,carbon,superfood"
    }
  },
  {
    "type": "tree",
    "category": "Specialty & Dye",
    "subCategory": "",
    "name": "Henna (Lawsonia inermis)",
    "variety": "",
    "form": "",
    "useCase": "Cosmetic dye, hair color",
    "typicalPackSize": "",
    "unit": "kg",
    "grade": "",
    "extras": {
      "Primary Products": "Leaves (dye)",
      "Byproducts": "Oil, powder",
      "Region of Origin / Prevalence": "Asia, Africa",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "Medium",
      "CITES / Conservation Status": "Not listed",
      "Tags": "henna,dye,cosmetic"
    }
  },
  {
    "type": "tree",
    "category": "Specialty & Dye",
    "subCategory": "",
    "name": "Logwood",
    "variety": "",
    "form": "",
    "useCase": "Textile dye, ink",
    "typicalPackSize": "",
    "unit": "kg",
    "grade": "",
    "extras": {
      "Primary Products": "Heartwood (dye)",
      "Byproducts": "Extract",
      "Region of Origin / Prevalence": "Caribbean, Central America",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "Medium",
      "CITES / Conservation Status": "Not listed",
      "Tags": "logwood,dye"
    }
  },
  {
    "type": "tree",
    "category": "Specialty & Dye",
    "subCategory": "",
    "name": "Indigofera (Indigo)",
    "variety": "",
    "form": "",
    "useCase": "Textile dye",
    "typicalPackSize": "",
    "unit": "kg",
    "grade": "",
    "extras": {
      "Primary Products": "Leaves (dye)",
      "Byproducts": "Seeds",
      "Region of Origin / Prevalence": "Asia, Africa",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "Medium",
      "CITES / Conservation Status": "Not listed",
      "Tags": "indigo,dye,textile"
    }
  },
  {
    "type": "tree",
    "category": "Specialty & Industrial",
    "subCategory": "",
    "name": "Tallow Tree",
    "variety": "",
    "form": "",
    "useCase": "Soap, oil production",
    "typicalPackSize": "",
    "unit": "kg",
    "grade": "",
    "extras": {
      "Primary Products": "Fat",
      "Byproducts": "Soap, candles",
      "Region of Origin / Prevalence": "Asia",
      "Certifications / Standards": "Organic",
      "Carbon Credit Potential": "Medium",
      "CITES / Conservation Status": "Not listed",
      "Tags": "tallow,soap,oil"
    }
  },
  {
    "type": "lease",
    "category": "Power & Land Prep",
    "subCategory": "Power unit",
    "name": "Tractor",
    "variety": "2WD, 4WD, Crawler, Orchard, Compact",
    "form": "",
    "useCase": "Towing & multi-field work",
    "typicalPackSize": "35\u2013300 HP",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Diesel 35\u2013300 HP",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "John Deere; Massey Ferguson; New Holland; Kubota; Mahindra; Fendt",
      "Availability (Buy/Lease/Rent)": "Buy/Lease/Rent",
      "Ekarimarket Tags": "tractor,power,land"
    }
  },
  {
    "type": "lease",
    "category": "Power & Land Prep",
    "subCategory": "Earthmoving",
    "name": "Bulldozer",
    "variety": "Medium/large dozer",
    "form": "",
    "useCase": "Land clearing, dam works",
    "typicalPackSize": "120\u2013350 HP",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Diesel 90\u2013350 HP",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Caterpillar; Komatsu; Shantui",
      "Availability (Buy/Lease/Rent)": "Lease/Rent/Buy",
      "Ekarimarket Tags": "dozer,landclearing"
    }
  },
  {
    "type": "lease",
    "category": "Power & Land Prep",
    "subCategory": "Earthmoving",
    "name": "Excavator",
    "variety": "Crawler/wheeled",
    "form": "",
    "useCase": "Dams, ponds, trenching",
    "typicalPackSize": "0.2\u20131.5 m\u00b3 bucket",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Diesel 70\u2013250 HP",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Caterpillar; SANY; Hitachi",
      "Availability (Buy/Lease/Rent)": "Lease/Rent/Buy",
      "Ekarimarket Tags": "excavator,earthworks"
    }
  },
  {
    "type": "lease",
    "category": "Power & Land Prep",
    "subCategory": "Loader",
    "name": "Front-end Loader",
    "variety": "Backhoe/loader",
    "form": "",
    "useCase": "Loading manure, grain, soil",
    "typicalPackSize": "1\u20133 m\u00b3 bucket",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Diesel 70\u2013200 HP",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "JCB; CAT; SDLG",
      "Availability (Buy/Lease/Rent)": "Lease/Rent/Buy",
      "Ekarimarket Tags": "loader,material"
    }
  },
  {
    "type": "lease",
    "category": "Power & Land Prep",
    "subCategory": "Primary tillage",
    "name": "Plough",
    "variety": "Moldboard; Disc; Chisel",
    "form": "",
    "useCase": "Soil inversion",
    "typicalPackSize": "2\u20136 furrows",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "PTO/Drawbar",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Lemken; Fieldking; Baldan",
      "Availability (Buy/Lease/Rent)": "Buy/Lease/Rent",
      "Ekarimarket Tags": "plough,tillage"
    }
  },
  {
    "type": "lease",
    "category": "Power & Land Prep",
    "subCategory": "Secondary tillage",
    "name": "Harrow",
    "variety": "Disc; Spike; Spring-tooth",
    "form": "",
    "useCase": "Clod breaking & leveling",
    "typicalPackSize": "1.5\u20136 m width",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "PTO/Drawbar",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Baldan; Lemken",
      "Availability (Buy/Lease/Rent)": "Buy/Lease/Rent",
      "Ekarimarket Tags": "harrow,leveling"
    }
  },
  {
    "type": "lease",
    "category": "Power & Land Prep",
    "subCategory": "Deep tillage",
    "name": "Subsoiler/Ripper",
    "variety": "1\u20135 tine",
    "form": "",
    "useCase": "Compaction relief",
    "typicalPackSize": "30\u201360 cm depth",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Tractor 60\u2013200 HP",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Baldan; Fieldking",
      "Availability (Buy/Lease/Rent)": "Buy/Lease/Rent",
      "Ekarimarket Tags": "subsoiler,ripper"
    }
  },
  {
    "type": "lease",
    "category": "Power & Land Prep",
    "subCategory": "Seedbed",
    "name": "Rotavator",
    "variety": "Rotary tiller",
    "form": "",
    "useCase": "Fine tilth preparation",
    "typicalPackSize": "1\u20133 m width",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Tractor 40\u2013120 HP",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Mahindra; Kubota",
      "Availability (Buy/Lease/Rent)": "Buy/Lease/Rent",
      "Ekarimarket Tags": "rotavator,seedbed"
    }
  },
  {
    "type": "lease",
    "category": "Power & Land Prep",
    "subCategory": "Bed formation",
    "name": "Ridger/Bed Maker",
    "variety": "2\u20136 row",
    "form": "",
    "useCase": "Ridges & raised beds",
    "typicalPackSize": "1\u20133 m",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Tractor 40\u2013100 HP",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Fieldking; Khedut",
      "Availability (Buy/Lease/Rent)": "Buy/Lease/Rent",
      "Ekarimarket Tags": "ridger,beds"
    }
  },
  {
    "type": "lease",
    "category": "Power & Land Prep",
    "subCategory": "Leveling",
    "name": "Laser Land Leveler",
    "variety": "Laser-guided",
    "form": "",
    "useCase": "Precision land leveling",
    "typicalPackSize": "2\u20135 m blade",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Tractor PTO",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Trimble; Mahindra",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "laser,leveler,precision"
    }
  },
  {
    "type": "lease",
    "category": "Power & Land Prep",
    "subCategory": "Compaction",
    "name": "Soil Compactor/Roller",
    "variety": "Smooth/padfoot",
    "form": "",
    "useCase": "Farm roads, pads",
    "typicalPackSize": "2\u201310 ton",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Diesel",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Dynapac; Hamm",
      "Availability (Buy/Lease/Rent)": "Lease/Rent/Buy",
      "Ekarimarket Tags": "roller,compactor"
    }
  },
  {
    "type": "lease",
    "category": "Planting & Seeding",
    "subCategory": "Cereals",
    "name": "Seed Drill",
    "variety": "Mechanical; Pneumatic",
    "form": "",
    "useCase": "Uniform seed and fertilizer placement",
    "typicalPackSize": "2\u201316 row",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Tractor PTO",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Great Plains; John Deere",
      "Availability (Buy/Lease/Rent)": "Buy/Lease/Rent",
      "Ekarimarket Tags": "seeddrill,planting"
    }
  },
  {
    "type": "lease",
    "category": "Planting & Seeding",
    "subCategory": "Row crops",
    "name": "Precision Planter",
    "variety": "Vacuum/air planter",
    "form": "",
    "useCase": "Precision sowing",
    "typicalPackSize": "2\u201316 row",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Tractor PTO",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Monosem; Case IH",
      "Availability (Buy/Lease/Rent)": "Buy/Lease/Rent",
      "Ekarimarket Tags": "planter,precision"
    }
  },
  {
    "type": "lease",
    "category": "Planting & Seeding",
    "subCategory": "Seed/Fertilizer",
    "name": "Broadcast Spreader",
    "variety": "PTO or trailed",
    "form": "",
    "useCase": "Broadcast application",
    "typicalPackSize": "300\u20131500 L",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "PTO/Electric",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Bogballe; Kuhn",
      "Availability (Buy/Lease/Rent)": "Buy/Lease/Rent",
      "Ekarimarket Tags": "spreader,broadcast"
    }
  },
  {
    "type": "lease",
    "category": "Planting & Seeding",
    "subCategory": "Rice/Vegetable",
    "name": "Transplanter",
    "variety": "Walk-behind; Tractor-mounted",
    "form": "",
    "useCase": "Seedling transplant",
    "typicalPackSize": "2\u201312 row",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Engine/PTO",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Kubota; Yanmar",
      "Availability (Buy/Lease/Rent)": "Buy/Lease/Rent",
      "Ekarimarket Tags": "transplanter,seedling"
    }
  },
  {
    "type": "lease",
    "category": "Planting & Seeding",
    "subCategory": "Nursery",
    "name": "Nursery Seeder/Tray Filler",
    "variety": "Automatic/semiauto",
    "form": "",
    "useCase": "Tray seeding & filling",
    "typicalPackSize": "500\u20133000 trays/hr",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Electric",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "URBINATI; Demtec",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "nursery,seeder"
    }
  },
  {
    "type": "lease",
    "category": "Planting & Seeding",
    "subCategory": "Seed treatment",
    "name": "Seed Treater",
    "variety": "Batch/continuous",
    "form": "",
    "useCase": "Coating & dressing",
    "typicalPackSize": "1\u201310 t/hr",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Electric",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Bayer; Cimbria",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "seed,treatment"
    }
  },
  {
    "type": "lease",
    "category": "Irrigation & Water",
    "subCategory": "Pumping",
    "name": "Solar Water Pump",
    "variety": "Submersible/Surface",
    "form": "",
    "useCase": "Off-grid irrigation",
    "typicalPackSize": "0.5\u201320 kW",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Solar",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Lorentz; SunCulture",
      "Availability (Buy/Lease/Rent)": "Buy/Lease/Rent",
      "Ekarimarket Tags": "solar,pump,irrigation"
    }
  },
  {
    "type": "lease",
    "category": "Irrigation & Water",
    "subCategory": "Pumping",
    "name": "Diesel Water Pump",
    "variety": "Portable",
    "form": "",
    "useCase": "Surface/river pumping",
    "typicalPackSize": "2\u201340 HP",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Diesel",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Kirloskar; Honda",
      "Availability (Buy/Lease/Rent)": "Buy/Lease/Rent",
      "Ekarimarket Tags": "diesel,pump"
    }
  },
  {
    "type": "lease",
    "category": "Irrigation & Water",
    "subCategory": "Irrigation",
    "name": "Drip Irrigation Kit",
    "variety": "Surface/Subsurface",
    "form": "",
    "useCase": "Efficient drip watering",
    "typicalPackSize": "1\u2013100 ha",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Low pressure",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Jain; Netafim",
      "Availability (Buy/Lease/Rent)": "Buy",
      "Ekarimarket Tags": "drip,irrigation"
    }
  },
  {
    "type": "lease",
    "category": "Irrigation & Water",
    "subCategory": "Irrigation",
    "name": "Sprinkler System",
    "variety": "Portable/Fixed",
    "form": "",
    "useCase": "Overhead sprinkling",
    "typicalPackSize": "1\u2013100 ha",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Pump powered",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Rain Bird; NaanDanJain",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "sprinkler,irrigation"
    }
  },
  {
    "type": "lease",
    "category": "Irrigation & Water",
    "subCategory": "Irrigation",
    "name": "Center Pivot",
    "variety": "Pivot/Lateral move",
    "form": "",
    "useCase": "Large field irrigation",
    "typicalPackSize": "20\u2013200+ ha",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Electric/Diesel",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Valley; Reinke",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "pivot,irrigation"
    }
  },
  {
    "type": "lease",
    "category": "Irrigation & Water",
    "subCategory": "Water treatment",
    "name": "Filtration & Fertigation Unit",
    "variety": "Sand/disc; Venturi/injector",
    "form": "",
    "useCase": "Filtration & nutrient dosing",
    "typicalPackSize": "10\u2013200 m\u00b3/h",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Electric",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Amiad; Netafim",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "filtration,fertigation"
    }
  },
  {
    "type": "lease",
    "category": "Irrigation & Water",
    "subCategory": "Storage",
    "name": "Water Storage Tank",
    "variety": "PVC/Steel/Concrete",
    "form": "",
    "useCase": "On-farm water storage",
    "typicalPackSize": "2\u2013200 m\u00b3",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Roto; JoJo",
      "Availability (Buy/Lease/Rent)": "Buy",
      "Ekarimarket Tags": "tank,storage,water"
    }
  },
  {
    "type": "lease",
    "category": "Crop Protection",
    "subCategory": "Sprayer",
    "name": "Knapsack Sprayer",
    "variety": "Manual; Motorized",
    "form": "",
    "useCase": "Small-scale pesticide application",
    "typicalPackSize": "15\u201325 L",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Manual/Petrol",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Stihl; Solo; Jacto",
      "Availability (Buy/Lease/Rent)": "Buy/Rent",
      "Ekarimarket Tags": "sprayer,knapsack"
    }
  },
  {
    "type": "lease",
    "category": "Crop Protection",
    "subCategory": "Sprayer",
    "name": "Boom Sprayer",
    "variety": "Mounted; Trailed",
    "form": "",
    "useCase": "Field-scale pesticide application",
    "typicalPackSize": "200\u20133000 L",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "PTO",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Amazone; Hardi",
      "Availability (Buy/Lease/Rent)": "Buy/Lease/Rent",
      "Ekarimarket Tags": "sprayer,boom"
    }
  },
  {
    "type": "lease",
    "category": "Crop Protection",
    "subCategory": "Aerial",
    "name": "Drone Sprayer",
    "variety": "Multirotor",
    "form": "",
    "useCase": "Aerial spraying & spot application",
    "typicalPackSize": "10\u201340 L",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Battery",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "DJI Agras; XAG",
      "Availability (Buy/Lease/Rent)": "Buy/Lease/Rent",
      "Ekarimarket Tags": "drone,sprayer"
    }
  },
  {
    "type": "lease",
    "category": "Crop Protection",
    "subCategory": "Orchard/Greenhouse",
    "name": "Mist Blower/Fogger",
    "variety": "Thermal/ULV",
    "form": "",
    "useCase": "Fine mist application",
    "typicalPackSize": "5\u201350 L",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Petrol/Electric",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Swingfog; IGEBA",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "fogger,orchard"
    }
  },
  {
    "type": "lease",
    "category": "Crop Protection",
    "subCategory": "Dry application",
    "name": "Duster/Granule Applicator",
    "variety": "Manual/tractor",
    "form": "",
    "useCase": "Powder/granule pesticide",
    "typicalPackSize": "5\u2013100 kg",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Manual/PTO",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Gandy; Birchmeier",
      "Availability (Buy/Lease/Rent)": "Buy/Rent",
      "Ekarimarket Tags": "duster,granule"
    }
  },
  {
    "type": "lease",
    "category": "Harvesting",
    "subCategory": "Grain",
    "name": "Combine Harvester",
    "variety": "Self-propelled",
    "form": "",
    "useCase": "Harvesting cereals & legumes",
    "typicalPackSize": "1.5\u20136 m header",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Diesel 100\u2013350 HP",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Claas; Case IH; New Holland; Kubota",
      "Availability (Buy/Lease/Rent)": "Buy/Lease/Rent",
      "Ekarimarket Tags": "combine,harvester,grain"
    }
  },
  {
    "type": "lease",
    "category": "Harvesting",
    "subCategory": "Row crop",
    "name": "Maize Harvester",
    "variety": "Headers/standalone",
    "form": "",
    "useCase": "Corn picking/shelling",
    "typicalPackSize": "4\u201312 row",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Diesel",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "John Deere; Geringhoff",
      "Availability (Buy/Lease/Rent)": "Buy/Lease/Rent",
      "Ekarimarket Tags": "maize,harvester"
    }
  },
  {
    "type": "lease",
    "category": "Harvesting",
    "subCategory": "Paddy",
    "name": "Rice Harvester",
    "variety": "Mini combine",
    "form": "",
    "useCase": "Cutting & threshing",
    "typicalPackSize": "1\u20132 m header",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Diesel",
      "Region / Market Use": "Asia/Africa",
      "Brands / Manufacturers": "Kubota; Yanmar",
      "Availability (Buy/Lease/Rent)": "Buy/Lease/Rent",
      "Ekarimarket Tags": "rice,harvester"
    }
  },
  {
    "type": "lease",
    "category": "Harvesting",
    "subCategory": "Forage",
    "name": "Forage Harvester",
    "variety": "Self-propelled/trailed",
    "form": "",
    "useCase": "Silage chopping",
    "typicalPackSize": "100\u2013400 t/h",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Diesel",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Krone; Claas; John Deere",
      "Availability (Buy/Lease/Rent)": "Buy/Lease/Rent",
      "Ekarimarket Tags": "forage,harvester"
    }
  },
  {
    "type": "lease",
    "category": "Harvesting",
    "subCategory": "Roots/Tubers",
    "name": "Root/Tuber Harvester",
    "variety": "Potato; Cassava",
    "form": "",
    "useCase": "Digging & lifting",
    "typicalPackSize": "1\u20132 row",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "PTO/Diesel",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Grimme; Tomecanic",
      "Availability (Buy/Lease/Rent)": "Buy/Lease/Rent",
      "Ekarimarket Tags": "potato,cassava,harvester"
    }
  },
  {
    "type": "lease",
    "category": "Harvesting",
    "subCategory": "Vegetables",
    "name": "Vegetable Harvester",
    "variety": "Belt/brush",
    "form": "",
    "useCase": "Carrot, onion, tomato",
    "typicalPackSize": "Varies",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Diesel/PTO",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "ASA-Lift; Oxbo",
      "Availability (Buy/Lease/Rent)": "Buy/Lease/Rent",
      "Ekarimarket Tags": "vegetable,harvester"
    }
  },
  {
    "type": "lease",
    "category": "Harvesting",
    "subCategory": "Orchard",
    "name": "Fruit Picker",
    "variety": "Mechanical/manual",
    "form": "",
    "useCase": "Fruit picking",
    "typicalPackSize": "\u2014",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Manual/Electric",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Munckhof; Pellenc",
      "Availability (Buy/Lease/Rent)": "Buy/Rent",
      "Ekarimarket Tags": "fruit,picker"
    }
  },
  {
    "type": "lease",
    "category": "Harvesting",
    "subCategory": "Plantation",
    "name": "Tea Harvester",
    "variety": "Handheld/portable",
    "form": "",
    "useCase": "Selective tea plucking",
    "typicalPackSize": "\u2014",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Petrol/Electric",
      "Region / Market Use": "Asia/Africa",
      "Brands / Manufacturers": "STIHL; Kawasaki",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "tea,harvester"
    }
  },
  {
    "type": "lease",
    "category": "Harvesting",
    "subCategory": "Plantation",
    "name": "Coffee Harvester",
    "variety": "Self-propelled/portable",
    "form": "",
    "useCase": "Strip/selective harvesting",
    "typicalPackSize": "\u2014",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Diesel/Electric",
      "Region / Market Use": "LatAm/Africa",
      "Brands / Manufacturers": "Kahawa Tech; Oxbo",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "coffee,harvester"
    }
  },
  {
    "type": "lease",
    "category": "Post-Harvest",
    "subCategory": "Separation",
    "name": "Thresher",
    "variety": "Stationary/mobile",
    "form": "",
    "useCase": "Threshing grains",
    "typicalPackSize": "1\u20135 t/h",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Diesel/Electric/PTO",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Rajkumar; AgroAsia",
      "Availability (Buy/Lease/Rent)": "Buy/Lease/Rent",
      "Ekarimarket Tags": "thresher,postharvest"
    }
  },
  {
    "type": "lease",
    "category": "Post-Harvest",
    "subCategory": "Separation",
    "name": "Sheller/Dehuller",
    "variety": "Manual/electric",
    "form": "",
    "useCase": "Shelling maize/groundnut",
    "typicalPackSize": "0.5\u20132 t/h",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Manual/Electric",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Alvan Blanch; Meelko",
      "Availability (Buy/Lease/Rent)": "Buy/Rent",
      "Ekarimarket Tags": "sheller,dehuller"
    }
  },
  {
    "type": "lease",
    "category": "Post-Harvest",
    "subCategory": "Cleaning",
    "name": "Winnower/Cleaner",
    "variety": "Air screen; aspirator",
    "form": "",
    "useCase": "Chaff removal/screening",
    "typicalPackSize": "1\u201310 t/h",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Electric",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Cimbria; Alvan Blanch",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "winnower,cleaner"
    }
  },
  {
    "type": "lease",
    "category": "Post-Harvest",
    "subCategory": "Drying",
    "name": "Grain Dryer",
    "variety": "Batch/continuous",
    "form": "",
    "useCase": "Moisture reduction",
    "typicalPackSize": "1\u201330 t/batch",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Diesel/Electric",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Mekong; Shivvers",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "dryer,grain"
    }
  },
  {
    "type": "lease",
    "category": "Post-Harvest",
    "subCategory": "Grading",
    "name": "Grader/Sorter",
    "variety": "Optical/mechanical",
    "form": "",
    "useCase": "Size/color sorting",
    "typicalPackSize": "1\u201320 t/h",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Electric",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "B\u00fchler; Tomra",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "grader,sorter"
    }
  },
  {
    "type": "lease",
    "category": "Forage",
    "subCategory": "Baling",
    "name": "Baler",
    "variety": "Round/square",
    "form": "",
    "useCase": "Hay/straw baling",
    "typicalPackSize": "Small\u2013large",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Tractor 50\u2013120 HP",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "New Holland; Krone",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "baler,forage"
    }
  },
  {
    "type": "lease",
    "category": "Forage",
    "subCategory": "Raking/tedding",
    "name": "Forage Rake/Tedder",
    "variety": "Rotary; basket",
    "form": "",
    "useCase": "Drying & windrows",
    "typicalPackSize": "2\u201310 m",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Tractor 30\u201380 HP",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Claas; Kuhn",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "rake,tedder"
    }
  },
  {
    "type": "lease",
    "category": "Livestock & Dairy",
    "subCategory": "Milking",
    "name": "Milking Machine",
    "variety": "Bucket; Pipeline; Parlour",
    "form": "",
    "useCase": "Automatic milking",
    "typicalPackSize": "10\u201360 cows/hr",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Electric/Vacuum",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "DeLaval; Milkrite; Afimilk",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "milking,dairy"
    }
  },
  {
    "type": "lease",
    "category": "Livestock & Dairy",
    "subCategory": "Cooling",
    "name": "Milk Cooling Tank",
    "variety": "Fixed/Mobile",
    "form": "",
    "useCase": "Bulk milk chilling",
    "typicalPackSize": "200\u201310,000 L",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Electric/Solar",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Packo; Wedholms",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "milk,cooler"
    }
  },
  {
    "type": "lease",
    "category": "Livestock & Dairy",
    "subCategory": "Feeding",
    "name": "TMR Feed Mixer",
    "variety": "Vertical/Horizontal",
    "form": "",
    "useCase": "Total mixed ration",
    "typicalPackSize": "1\u201320 m\u00b3",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "PTO/Electric",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "JF-Stoll; Siloking",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "feed,mixer"
    }
  },
  {
    "type": "lease",
    "category": "Livestock & Dairy",
    "subCategory": "Forage",
    "name": "Fodder Chopper",
    "variety": "Stationary/Mobile",
    "form": "",
    "useCase": "Chop silage/forage",
    "typicalPackSize": "1\u201310 t/h",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Electric/PTO",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "JF; Kirloskar",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "fodder,chopper"
    }
  },
  {
    "type": "lease",
    "category": "Livestock & Dairy",
    "subCategory": "Fertilizer",
    "name": "Manure Spreader",
    "variety": "Mounted/trailed",
    "form": "",
    "useCase": "Spread manure/compost",
    "typicalPackSize": "2\u201312 t",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "PTO",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Joskin; Tebbe",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "manure,spreader"
    }
  },
  {
    "type": "lease",
    "category": "Livestock & Dairy",
    "subCategory": "Handling",
    "name": "Cattle Crush/Chute",
    "variety": "Fixed/portable",
    "form": "",
    "useCase": "Animal restraint & vet",
    "typicalPackSize": "\u2014",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "\u2014",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Q-Catch; Prattley",
      "Availability (Buy/Lease/Rent)": "Buy/Rent",
      "Ekarimarket Tags": "crush,chute"
    }
  },
  {
    "type": "lease",
    "category": "Poultry",
    "subCategory": "Hatchery",
    "name": "Poultry Incubator",
    "variety": "Automatic",
    "form": "",
    "useCase": "Egg incubation",
    "typicalPackSize": "100\u201350,000 eggs",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Electric",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Brinsea; Petersime",
      "Availability (Buy/Lease/Rent)": "Buy",
      "Ekarimarket Tags": "incubator,poultry"
    }
  },
  {
    "type": "lease",
    "category": "Poultry",
    "subCategory": "Grading",
    "name": "Egg Grader",
    "variety": "Weigh/size",
    "form": "",
    "useCase": "Egg sorting",
    "typicalPackSize": "3,000\u201330,000 eggs/hr",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Electric",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Moba; SANOVO",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "egg,grader"
    }
  },
  {
    "type": "lease",
    "category": "Aquaculture",
    "subCategory": "Feed",
    "name": "Fish Feed Extruder",
    "variety": "Single/twin-screw",
    "form": "",
    "useCase": "Floating/sinking feed",
    "typicalPackSize": "100\u20133000 kg/h",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Electric",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Meelko; Clextral",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "fish,feed,extruder"
    }
  },
  {
    "type": "lease",
    "category": "Processing",
    "subCategory": "Edible oil",
    "name": "Oil Press/Expeller",
    "variety": "50\u20132000 kg/h",
    "form": "",
    "useCase": "Cold/screw press",
    "typicalPackSize": "Electric/Diesel",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Global",
      "Region / Market Use": "Tinytech; Meelko",
      "Brands / Manufacturers": "Buy/Lease",
      "Availability (Buy/Lease/Rent)": "oil,press"
    }
  },
  {
    "type": "lease",
    "category": "Processing",
    "subCategory": "Milling",
    "name": "Flour Mill",
    "variety": "100\u20135000 kg/h",
    "form": "",
    "useCase": "Hammer/Roller",
    "typicalPackSize": "Electric/Diesel",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Global",
      "Region / Market Use": "B\u00fchler; Kirloskar",
      "Brands / Manufacturers": "Buy/Lease",
      "Availability (Buy/Lease/Rent)": "flour,mill"
    }
  },
  {
    "type": "lease",
    "category": "Processing",
    "subCategory": "Rice processing",
    "name": "Rice Mill",
    "variety": "0.5\u20135 t/h",
    "form": "",
    "useCase": "Dehusker; Polisher",
    "typicalPackSize": "Electric",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Global",
      "Region / Market Use": "Satake; Alvan Blanch",
      "Brands / Manufacturers": "Buy/Lease",
      "Availability (Buy/Lease/Rent)": "rice,mill"
    }
  },
  {
    "type": "lease",
    "category": "Processing",
    "subCategory": "Coffee",
    "name": "Coffee Pulper/Roaster",
    "variety": "0.5\u20132 t/h",
    "form": "",
    "useCase": "Pulper; Huller; Roaster",
    "typicalPackSize": "Electric/Gas",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Global",
      "Region / Market Use": "Pinhalense; Probat",
      "Brands / Manufacturers": "Buy/Lease",
      "Availability (Buy/Lease/Rent)": "coffee,processing"
    }
  },
  {
    "type": "lease",
    "category": "Processing",
    "subCategory": "Cocoa",
    "name": "Cocoa Fermenter/Roaster",
    "variety": "0.5\u20132 t/h",
    "form": "",
    "useCase": "Fermenter; Dryer; Roaster",
    "typicalPackSize": "Electric",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Global",
      "Region / Market Use": "B\u00fchler; Selmi",
      "Brands / Manufacturers": "Buy/Lease",
      "Availability (Buy/Lease/Rent)": "cocoa,processing"
    }
  },
  {
    "type": "lease",
    "category": "Processing",
    "subCategory": "Juice",
    "name": "Juice Extractor/Pasteurizer",
    "variety": "100\u20135000 L/h",
    "form": "",
    "useCase": "Screw; Belt press",
    "typicalPackSize": "Electric",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Global",
      "Region / Market Use": "GEA; Fenco",
      "Brands / Manufacturers": "Buy/Lease",
      "Availability (Buy/Lease/Rent)": "juice,pasteurizer"
    }
  },
  {
    "type": "lease",
    "category": "Processing",
    "subCategory": "Drying",
    "name": "Fruit & Veg Dehydrator",
    "variety": "100\u20135000 kg/day",
    "form": "",
    "useCase": "Tray; Tunnel; Solar-hybrid",
    "typicalPackSize": "Electric/Solar",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Global",
      "Region / Market Use": "Ecozen; AUCMA",
      "Brands / Manufacturers": "Buy/Lease",
      "Availability (Buy/Lease/Rent)": "dehydrator,dryer"
    }
  },
  {
    "type": "lease",
    "category": "Processing",
    "subCategory": "Apiculture",
    "name": "Honey Extractor/Filter",
    "variety": "4\u201360 frames",
    "form": "",
    "useCase": "Radial extractor",
    "typicalPackSize": "Manual/Electric",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Global",
      "Region / Market Use": "Lyson; Mann Lake",
      "Brands / Manufacturers": "Buy/Lease",
      "Availability (Buy/Lease/Rent)": "honey,extractor"
    }
  },
  {
    "type": "lease",
    "category": "Processing",
    "subCategory": "Feed",
    "name": "Feed Pellet Mill",
    "variety": "100\u20135000 kg/h",
    "form": "",
    "useCase": "Pelletizer; Conditioner",
    "typicalPackSize": "Electric/Diesel",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Global",
      "Region / Market Use": "CPM; Meelko",
      "Brands / Manufacturers": "Buy/Lease",
      "Availability (Buy/Lease/Rent)": "feed,pellet"
    }
  },
  {
    "type": "lease",
    "category": "Processing",
    "subCategory": "Meat",
    "name": "Slaughter/Meat Processing Set",
    "variety": "Small/medium units",
    "form": "",
    "useCase": "Stunners; Saws; Grinders",
    "typicalPackSize": "Electric",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Global",
      "Region / Market Use": "Hobart; Marel",
      "Brands / Manufacturers": "Buy/Lease",
      "Availability (Buy/Lease/Rent)": "meat,processing"
    }
  },
  {
    "type": "lease",
    "category": "Greenhouse",
    "subCategory": "Structure",
    "name": "Greenhouse Tunnel",
    "variety": "Single/Multispan",
    "form": "",
    "useCase": "Protected cultivation",
    "typicalPackSize": "200\u20135000 m\u00b2",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "\u2014",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Richel; Haygrove",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "greenhouse,tunnel"
    }
  },
  {
    "type": "lease",
    "category": "Greenhouse",
    "subCategory": "Soilless",
    "name": "Hydroponic System",
    "variety": "100\u201310,000 plants",
    "form": "",
    "useCase": "NFT/DWC/Drip hydroponics",
    "typicalPackSize": "Electric/Pumps",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Global",
      "Region / Market Use": "AmHydro; CropKing",
      "Brands / Manufacturers": "Buy/Lease",
      "Availability (Buy/Lease/Rent)": "hydroponic,soilless"
    }
  },
  {
    "type": "lease",
    "category": "Greenhouse",
    "subCategory": "Climate",
    "name": "Greenhouse Fans & Pads",
    "variety": "Evaporative pads",
    "form": "",
    "useCase": "Cooling and ventilation",
    "typicalPackSize": "\u2014",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Electric",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Munters; Termaks",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "cooling,ventilation"
    }
  },
  {
    "type": "lease",
    "category": "Greenhouse",
    "subCategory": "Automation",
    "name": "Irrigation Controller",
    "variety": "Programmable",
    "form": "",
    "useCase": "Scheduling fertigation",
    "typicalPackSize": "\u2014",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Electric/IoT",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Netafim; Hunter",
      "Availability (Buy/Lease/Rent)": "Buy",
      "Ekarimarket Tags": "controller,irrigation"
    }
  },
  {
    "type": "lease",
    "category": "Greenhouse",
    "subCategory": "Nursery",
    "name": "Seedling Trays & Benches",
    "variety": "50\u2013128 cell trays",
    "form": "",
    "useCase": "Propagation",
    "typicalPackSize": "\u2014",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "\u2014",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Desch; P\u00f6ppelmann",
      "Availability (Buy/Lease/Rent)": "Buy",
      "Ekarimarket Tags": "seedling,tray"
    }
  },
  {
    "type": "lease",
    "category": "Smart & Renewable",
    "subCategory": "UAV",
    "name": "Survey & Mapping Drone",
    "variety": "Fixed wing/Multirotor",
    "form": "",
    "useCase": "NDVI mapping; scouting",
    "typicalPackSize": "45\u2013120 min",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Battery",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "DJI; SenseFly",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "drone,mapping"
    }
  },
  {
    "type": "lease",
    "category": "Smart & Renewable",
    "subCategory": "Precision ag",
    "name": "GPS Auto-Guidance",
    "variety": "RTK/Non-RTK",
    "form": "",
    "useCase": "Autosteer & guidance",
    "typicalPackSize": "\u2014",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "12\u201324V",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Trimble; Topcon",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "GPS,autosteer"
    }
  },
  {
    "type": "lease",
    "category": "Smart & Renewable",
    "subCategory": "Sensors",
    "name": "IoT Soil Sensor Kit",
    "variety": "LoRaWAN/NB-IoT",
    "form": "",
    "useCase": "Moisture, EC, pH, temp",
    "typicalPackSize": "\u2014",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Battery/Solar",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Arable; Farm21",
      "Availability (Buy/Lease/Rent)": "Buy",
      "Ekarimarket Tags": "sensor,soil,IoT"
    }
  },
  {
    "type": "lease",
    "category": "Smart & Renewable",
    "subCategory": "Sensors",
    "name": "Weather Station",
    "variety": "GSM-enabled",
    "form": "",
    "useCase": "Local weather & alerts",
    "typicalPackSize": "\u2014",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Solar/Battery",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Pessl; Davis",
      "Availability (Buy/Lease/Rent)": "Buy",
      "Ekarimarket Tags": "weather,station"
    }
  },
  {
    "type": "lease",
    "category": "Smart & Renewable",
    "subCategory": "Cold chain",
    "name": "Solar Cold Room",
    "variety": "10\u2013100 m\u00b3",
    "form": "",
    "useCase": "Off-grid cooling",
    "typicalPackSize": "Solar",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Global",
      "Region / Market Use": "Ecozen; AUCMA",
      "Brands / Manufacturers": "Buy/Lease",
      "Availability (Buy/Lease/Rent)": "solar,coldroom"
    }
  },
  {
    "type": "lease",
    "category": "Transport & Storage",
    "subCategory": "Logistics",
    "name": "Farm Trailer",
    "variety": "Tipping/Flatbed",
    "form": "",
    "useCase": "Crop & input transport",
    "typicalPackSize": "2\u201310 t",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Tractor-towed",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Tata; Massey Ferguson",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "trailer,transport"
    }
  },
  {
    "type": "lease",
    "category": "Transport & Storage",
    "subCategory": "Handling",
    "name": "Forklift",
    "variety": "Diesel/Electric",
    "form": "",
    "useCase": "Warehouse handling",
    "typicalPackSize": "1.5\u20135 t",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Diesel/Electric",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Toyota; Hyster",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "forklift,warehouse"
    }
  },
  {
    "type": "lease",
    "category": "Transport & Storage",
    "subCategory": "Handling",
    "name": "Palletizer",
    "variety": "Robot/Conventional",
    "form": "",
    "useCase": "Stacking & packaging",
    "typicalPackSize": "10\u201360 cycles/min",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Electric",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Fanuc; KUKA",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "palletizer,packaging"
    }
  },
  {
    "type": "lease",
    "category": "Transport & Storage",
    "subCategory": "Storage",
    "name": "Grain Silo",
    "variety": "Steel/Concrete",
    "form": "",
    "useCase": "Bulk grain storage",
    "typicalPackSize": "10\u201310,000 t",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Static",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Sioux; Sukup",
      "Availability (Buy/Lease/Rent)": "Buy",
      "Ekarimarket Tags": "silo,grain"
    }
  },
  {
    "type": "lease",
    "category": "Transport & Storage",
    "subCategory": "Weighing",
    "name": "Weighbridge",
    "variety": "Digital",
    "form": "",
    "useCase": "Truck/load weighing",
    "typicalPackSize": "20\u2013120 t",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Electric",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Avery; Essae",
      "Availability (Buy/Lease/Rent)": "Buy",
      "Ekarimarket Tags": "weighbridge,logistics"
    }
  },
  {
    "type": "lease",
    "category": "Transport & Storage",
    "subCategory": "Power",
    "name": "Generator",
    "variety": "Diesel/Solar-hybrid",
    "form": "",
    "useCase": "Backup electricity",
    "typicalPackSize": "5\u2013200 kVA",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Diesel/Solar",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Cummins; Perkins",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "generator,power"
    }
  },
  {
    "type": "lease",
    "category": "Hand Tools",
    "subCategory": "Manual tillage",
    "name": "Hoe/Spade/Fork Set",
    "variety": "\u2014",
    "form": "",
    "useCase": "Garden & field",
    "typicalPackSize": "\u2014",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Manual",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "\u2014",
      "Availability (Buy/Lease/Rent)": "Buy",
      "Ekarimarket Tags": "hoe,spade"
    }
  },
  {
    "type": "lease",
    "category": "Hand Tools",
    "subCategory": "Pruning",
    "name": "Pruning Shears/Loppers",
    "variety": "\u2014",
    "form": "",
    "useCase": "Bypass/anvil",
    "typicalPackSize": "\u2014",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Manual",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Felco; Fiskars",
      "Availability (Buy/Lease/Rent)": "Buy",
      "Ekarimarket Tags": "pruner,orchard"
    }
  },
  {
    "type": "lease",
    "category": "Hand Tools",
    "subCategory": "Brush clearing",
    "name": "Brush Cutter",
    "variety": "\u2014",
    "form": "",
    "useCase": "2-stroke/4-stroke",
    "typicalPackSize": "\u2014",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Petrol/Electric",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Stihl; Husqvarna",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "brushcutter,weed"
    }
  },
  {
    "type": "lease",
    "category": "Hand Tools",
    "subCategory": "Transport",
    "name": "Wheelbarrow/Cart",
    "variety": "\u2014",
    "form": "",
    "useCase": "Single/double wheel",
    "typicalPackSize": "\u2014",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Manual",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "\u2014",
      "Availability (Buy/Lease/Rent)": "Buy",
      "Ekarimarket Tags": "wheelbarrow,cart"
    }
  },
  {
    "type": "lease",
    "category": "Hand Tools",
    "subCategory": "Pest control",
    "name": "Hand Sprayer",
    "variety": "5\u201310 L",
    "form": "",
    "useCase": "Compression type",
    "typicalPackSize": "Manual",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Global",
      "Region / Market Use": "Solo; Matabi",
      "Brands / Manufacturers": "Buy",
      "Availability (Buy/Lease/Rent)": "handsprayer,pest"
    }
  },
  {
    "type": "lease",
    "category": "Hand Tools",
    "subCategory": "Testing",
    "name": "Soil Test Kit",
    "variety": "\u2014",
    "form": "",
    "useCase": "pH/EC/NPK kits",
    "typicalPackSize": "\u2014",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Manual",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "LaMotte; Hanna",
      "Availability (Buy/Lease/Rent)": "Buy",
      "Ekarimarket Tags": "soil,test"
    }
  },
  {
    "type": "lease",
    "category": "Aquaculture",
    "subCategory": "Infrastructure",
    "name": "Pond Liner",
    "variety": "HDPE/EPDM",
    "form": "",
    "useCase": "Water retention",
    "typicalPackSize": "200\u20135000 m\u00b2",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "\u2014",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "GSE; Firestone",
      "Availability (Buy/Lease/Rent)": "Buy",
      "Ekarimarket Tags": "pond,liner"
    }
  },
  {
    "type": "lease",
    "category": "Aquaculture",
    "subCategory": "Aeration",
    "name": "Aerator",
    "variety": "1\u201320 hp",
    "form": "",
    "useCase": "Paddlewheel/Blower",
    "typicalPackSize": "Electric/Diesel",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Global",
      "Region / Market Use": "AquaTech; Pentair",
      "Brands / Manufacturers": "Buy/Lease",
      "Availability (Buy/Lease/Rent)": "aerator,fish"
    }
  },
  {
    "type": "lease",
    "category": "Aquaculture",
    "subCategory": "Grading",
    "name": "Fish Grader/Sorter",
    "variety": "Inline/portable",
    "form": "",
    "useCase": "Size sorting",
    "typicalPackSize": "\u2014",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Electric",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Pentair; FAIVRE",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "fish,grader"
    }
  },
  {
    "type": "lease",
    "category": "Aquaculture",
    "subCategory": "Enclosures",
    "name": "Nets & Cages",
    "variety": "\u2014",
    "form": "",
    "useCase": "Pond/cage culture",
    "typicalPackSize": "\u2014",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "\u2014",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "\u2014",
      "Availability (Buy/Lease/Rent)": "Buy",
      "Ekarimarket Tags": "nets,cage"
    }
  },
  {
    "type": "lease",
    "category": "Aquaculture",
    "subCategory": "Processing",
    "name": "Smoker/Dryer (Fish)",
    "variety": "Cabinet/tunnel",
    "form": "",
    "useCase": "Smoking/drying fish",
    "typicalPackSize": "100\u20132000 kg/day",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Electric/Biomass",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Alvan Blanch; AUCMA",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "fish,smoker"
    }
  },
  {
    "type": "lease",
    "category": "Aquaculture",
    "subCategory": "Feed",
    "name": "Feed Mill (Fish)",
    "variety": "100\u20132000 kg/h",
    "form": "",
    "useCase": "Grinding/mixing",
    "typicalPackSize": "Electric",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Global",
      "Region / Market Use": "Meelko; Andritz",
      "Brands / Manufacturers": "Buy/Lease",
      "Availability (Buy/Lease/Rent)": "fish,feed,mill"
    }
  },
  {
    "type": "lease",
    "category": "Forestry & Biomass",
    "subCategory": "Felling",
    "name": "Chainsaw",
    "variety": "\u2014",
    "form": "",
    "useCase": "Light/heavy duty",
    "typicalPackSize": "\u2014",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Petrol/Electric",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Stihl; Husqvarna",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "chainsaw,tree"
    }
  },
  {
    "type": "lease",
    "category": "Forestry & Biomass",
    "subCategory": "Clearing",
    "name": "Brush Cutter (Forestry)",
    "variety": "\u2014",
    "form": "",
    "useCase": "Blade/line trimmer",
    "typicalPackSize": "\u2014",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Petrol/Electric",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Stihl; Husqvarna",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "brushcutter,forestry"
    }
  },
  {
    "type": "lease",
    "category": "Forestry & Biomass",
    "subCategory": "Splitting",
    "name": "Log Splitter",
    "variety": "5\u201330 t",
    "form": "",
    "useCase": "Hydraulic/kinetic",
    "typicalPackSize": "Electric/Petrol",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Global",
      "Region / Market Use": "Forest Master; Oregon",
      "Brands / Manufacturers": "Buy/Lease",
      "Availability (Buy/Lease/Rent)": "logsplitter,firewood"
    }
  },
  {
    "type": "lease",
    "category": "Forestry & Biomass",
    "subCategory": "Chipping",
    "name": "Wood Chipper",
    "variety": "3\u201330 cm dia",
    "form": "",
    "useCase": "Drum/disc",
    "typicalPackSize": "PTO/Petrol",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Global",
      "Region / Market Use": "Bandit; Vermeer",
      "Brands / Manufacturers": "Buy/Lease",
      "Availability (Buy/Lease/Rent)": "chipper,wood"
    }
  },
  {
    "type": "lease",
    "category": "Forestry & Biomass",
    "subCategory": "Planting",
    "name": "Post Hole Digger/Auger",
    "variety": "4\u201318 inch",
    "form": "",
    "useCase": "Manual/powered",
    "typicalPackSize": "PTO/Petrol",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Global",
      "Region / Market Use": "Earthquake; Belltec",
      "Brands / Manufacturers": "Buy/Lease",
      "Availability (Buy/Lease/Rent)": "auger,posthole"
    }
  },
  {
    "type": "lease",
    "category": "Forestry & Biomass",
    "subCategory": "Planting",
    "name": "Tree Planter",
    "variety": "\u2014",
    "form": "",
    "useCase": "Single/double row",
    "typicalPackSize": "\u2014",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Tractor/Pulled",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Checchi & Magli",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "tree,planter"
    }
  },
  {
    "type": "lease",
    "category": "Forestry & Biomass",
    "subCategory": "Removal",
    "name": "Stump Grinder",
    "variety": "\u2014",
    "form": "",
    "useCase": "Tracked/wheeled",
    "typicalPackSize": "\u2014",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Diesel/Petrol",
      "Region / Market Use": "Global",
      "Brands / Manufacturers": "Vermeer; Rayco",
      "Availability (Buy/Lease/Rent)": "Buy/Lease",
      "Ekarimarket Tags": "stump,grinder"
    }
  },
  {
    "type": "lease",
    "category": "Forestry & Biomass",
    "subCategory": "Pellet fuel",
    "name": "Biomass Pelletizer",
    "variety": "200\u20135000 kg/h",
    "form": "",
    "useCase": "Flat die/ring die",
    "typicalPackSize": "Electric/Diesel",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Power Source (HP/kW/Type)": "Global",
      "Region / Market Use": "CPM; Meelko",
      "Brands / Manufacturers": "Buy/Lease",
      "Availability (Buy/Lease/Rent)": "pellet,biomass"
    }
  },
  {
    "type": "lease",
    "category": "",
    "subCategory": "",
    "name": "Tractor",
    "variety": "",
    "form": "",
    "useCase": "10",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "120",
    "billingUnit": "",
    "extras": {
      "Indicative CAPEX (USD) - Low": 12000,
      "Indicative CAPEX (USD) - High": 95000,
      "Indicative Lease Rate / Month (USD)": 1800
    }
  },
  {
    "type": "lease",
    "category": "",
    "subCategory": "",
    "name": "Combine Harvester",
    "variety": "",
    "form": "",
    "useCase": "10",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "900",
    "billingUnit": "",
    "extras": {
      "Indicative CAPEX (USD) - Low": 85000,
      "Indicative CAPEX (USD) - High": 350000,
      "Indicative Lease Rate / Month (USD)": 12000
    }
  },
  {
    "type": "lease",
    "category": "",
    "subCategory": "",
    "name": "Seed Drill",
    "variety": "",
    "form": "",
    "useCase": "8",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "35",
    "billingUnit": "",
    "extras": {
      "Indicative CAPEX (USD) - Low": 1500,
      "Indicative CAPEX (USD) - High": 18000,
      "Indicative Lease Rate / Month (USD)": 500
    }
  },
  {
    "type": "lease",
    "category": "",
    "subCategory": "",
    "name": "Precision Planter",
    "variety": "",
    "form": "",
    "useCase": "10",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "150",
    "billingUnit": "",
    "extras": {
      "Indicative CAPEX (USD) - Low": 10000,
      "Indicative CAPEX (USD) - High": 85000,
      "Indicative Lease Rate / Month (USD)": 2200
    }
  },
  {
    "type": "lease",
    "category": "",
    "subCategory": "",
    "name": "Solar Water Pump",
    "variety": "",
    "form": "",
    "useCase": "7",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "20",
    "billingUnit": "",
    "extras": {
      "Indicative CAPEX (USD) - Low": 800,
      "Indicative CAPEX (USD) - High": 15000,
      "Indicative Lease Rate / Month (USD)": 350
    }
  },
  {
    "type": "lease",
    "category": "",
    "subCategory": "",
    "name": "Center Pivot",
    "variety": "",
    "form": "",
    "useCase": "15",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "400",
    "billingUnit": "",
    "extras": {
      "Indicative CAPEX (USD) - Low": 65000,
      "Indicative CAPEX (USD) - High": 280000,
      "Indicative Lease Rate / Month (USD)": 6500
    }
  },
  {
    "type": "lease",
    "category": "",
    "subCategory": "",
    "name": "Boom Sprayer",
    "variety": "",
    "form": "",
    "useCase": "8",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "60",
    "billingUnit": "",
    "extras": {
      "Indicative CAPEX (USD) - Low": 2500,
      "Indicative CAPEX (USD) - High": 35000,
      "Indicative Lease Rate / Month (USD)": 900
    }
  },
  {
    "type": "lease",
    "category": "",
    "subCategory": "",
    "name": "Drone Sprayer",
    "variety": "",
    "form": "",
    "useCase": "5",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "80",
    "billingUnit": "",
    "extras": {
      "Indicative CAPEX (USD) - Low": 3000,
      "Indicative CAPEX (USD) - High": 25000,
      "Indicative Lease Rate / Month (USD)": 1200
    }
  },
  {
    "type": "lease",
    "category": "",
    "subCategory": "",
    "name": "Grain Dryer",
    "variety": "",
    "form": "",
    "useCase": "12",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "140",
    "billingUnit": "",
    "extras": {
      "Indicative CAPEX (USD) - Low": 9000,
      "Indicative CAPEX (USD) - High": 95000,
      "Indicative Lease Rate / Month (USD)": 2200
    }
  },
  {
    "type": "lease",
    "category": "",
    "subCategory": "",
    "name": "Oil Press/Expeller",
    "variety": "",
    "form": "",
    "useCase": "10",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "40",
    "billingUnit": "",
    "extras": {
      "Indicative CAPEX (USD) - Low": 1200,
      "Indicative CAPEX (USD) - High": 45000,
      "Indicative Lease Rate / Month (USD)": 700
    }
  },
  {
    "type": "lease",
    "category": "",
    "subCategory": "",
    "name": "Flour Mill",
    "variety": "",
    "form": "",
    "useCase": "15",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "120",
    "billingUnit": "",
    "extras": {
      "Indicative CAPEX (USD) - Low": 5000,
      "Indicative CAPEX (USD) - High": 120000,
      "Indicative Lease Rate / Month (USD)": 1800
    }
  },
  {
    "type": "lease",
    "category": "",
    "subCategory": "",
    "name": "Greenhouse Tunnel",
    "variety": "",
    "form": "",
    "useCase": "10",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "70",
    "billingUnit": "",
    "extras": {
      "Indicative CAPEX (USD) - Low": 3000,
      "Indicative CAPEX (USD) - High": 90000,
      "Indicative Lease Rate / Month (USD)": 1000
    }
  },
  {
    "type": "lease",
    "category": "",
    "subCategory": "",
    "name": "Hydroponic System",
    "variety": "",
    "form": "",
    "useCase": "8",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "60",
    "billingUnit": "",
    "extras": {
      "Indicative CAPEX (USD) - Low": 2500,
      "Indicative CAPEX (USD) - High": 75000,
      "Indicative Lease Rate / Month (USD)": 900
    }
  },
  {
    "type": "lease",
    "category": "",
    "subCategory": "",
    "name": "Farm Trailer",
    "variety": "",
    "form": "",
    "useCase": "12",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "40",
    "billingUnit": "",
    "extras": {
      "Indicative CAPEX (USD) - Low": 2000,
      "Indicative CAPEX (USD) - High": 18000,
      "Indicative Lease Rate / Month (USD)": 600
    }
  },
  {
    "type": "lease",
    "category": "",
    "subCategory": "",
    "name": "Forklift",
    "variety": "",
    "form": "",
    "useCase": "10",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "120",
    "billingUnit": "",
    "extras": {
      "Indicative CAPEX (USD) - Low": 12000,
      "Indicative CAPEX (USD) - High": 40000,
      "Indicative Lease Rate / Month (USD)": 1600
    }
  },
  {
    "type": "lease",
    "category": "",
    "subCategory": "",
    "name": "Generator",
    "variety": "",
    "form": "",
    "useCase": "10",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "35",
    "billingUnit": "",
    "extras": {
      "Indicative CAPEX (USD) - Low": 1500,
      "Indicative CAPEX (USD) - High": 35000,
      "Indicative Lease Rate / Month (USD)": 500
    }
  },
  {
    "type": "service",
    "category": "Primary Production Services",
    "subCategory": "",
    "name": "Land leasing, produce sales, crop advisory, agronomist access, farm mapping",
    "variety": "Commission / Subscription",
    "form": "",
    "useCase": "Farmers, Agronomists, Growers",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Verified Partner (Y/N)": "Yes"
    }
  },
  {
    "type": "service",
    "category": "Input & Equipment Provider Services",
    "subCategory": "",
    "name": "Seeds, fertilizers, agrochemicals, irrigation systems, machinery leasing, greenhouse supplies",
    "variety": "Listing Fees / Transaction Fees",
    "form": "",
    "useCase": "Suppliers, Dealers, Farmers",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Verified Partner (Y/N)": "Yes"
    }
  },
  {
    "type": "service",
    "category": "Animal & Plant Health Services",
    "subCategory": "",
    "name": "Agronomists, Veterinary consultations, AI breeding, vet drugs, disease diagnostics",
    "variety": "Service Fee / Subscription",
    "form": "",
    "useCase": "Veterinarians, Farmers, Para-vets",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Verified Partner (Y/N)": "Yes"
    }
  },
  {
    "type": "service",
    "category": "Processing & Value Addition",
    "subCategory": "",
    "name": "Food processing, packaging, cold storage, branding support",
    "variety": "Subscription / Pay-per-use",
    "form": "",
    "useCase": "Processors, SMEs, Exporters",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Verified Partner (Y/N)": "Yes"
    }
  },
  {
    "type": "service",
    "category": "Trade, Distribution & Logistics",
    "subCategory": "",
    "name": "Market linkage, export facilitation, transport booking, warehouse management",
    "variety": "Commission / Transaction Fee",
    "form": "",
    "useCase": "Traders, Exporters, Cooperatives",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Verified Partner (Y/N)": "Yes"
    }
  },
  {
    "type": "service",
    "category": "Financial & Business Support",
    "subCategory": "",
    "name": "Loans, insurance, leasing, consulting, crowdfunding",
    "variety": "Revenue Share / Lead Generation",
    "form": "",
    "useCase": "Banks, SACCOs, Farmers, SMEs",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Verified Partner (Y/N)": "Yes"
    }
  },
  {
    "type": "service",
    "category": "Knowledge, Research & Innovation",
    "subCategory": "",
    "name": "Training, R&D collaboration, AI advisory, tech marketplace",
    "variety": "Subscription / Licensing",
    "form": "",
    "useCase": "Researchers, Institutions, AgriTechs",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Verified Partner (Y/N)": "Yes"
    }
  },
  {
    "type": "service",
    "category": "Governance, Standards & Enablers",
    "subCategory": "",
    "name": "Certification, trade facilitation, policy updates, regulatory tools",
    "variety": "Free / Partnership-based",
    "form": "",
    "useCase": "Government, Regulators, Exporters",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Verified Partner (Y/N)": "Yes"
    }
  },
  {
    "type": "service",
    "category": "Consumer & End Market Services",
    "subCategory": "",
    "name": "Farm-fresh delivery, B2C sales, export buyers, retail procurement",
    "variety": "Commission / Subscription",
    "form": "",
    "useCase": "Consumers, Retailers, Exporters",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Verified Partner (Y/N)": "Yes"
    }
  },
  {
    "type": "service",
    "category": "Cross-Cutting Platform Features",
    "subCategory": "",
    "name": "Profiles, escrow payments, analytics, carbon credits, ad tools",
    "variety": "Freemium / Tiered Pricing",
    "form": "",
    "useCase": "All Platform Users",
    "typicalPackSize": "",
    "unit": "",
    "grade": "",
    "rate": "",
    "billingUnit": "",
    "extras": {
      "Verified Partner (Y/N)": "Yes"
    }
  },
  {
    "type": "animal",
    "category": "Bovines",
    "subCategory": "",
    "name": "Cattle",
    "variety": "Cattle",
    "form": "",
    "useCase": "Meat, Dairy",
    "typicalPackSize": "",
    "unit": "Head",
    "grade": "",
    "extras": {
      "Breed/Variety": "Angus, Friesian, Boran, Wagyu",
      "Primary Products": "Beef, Milk, Hides",
      "Secondary Products": "Leather, Manure",
      "Edible Byproducts": "Liver, Tongue, Heart, Kidney, Tripe, Bone marrow, Blood",
      "Region of Origin/Prevalence": "Global",
      "Production Type": "Farm/Feedlot",
      "Certifications/Standards": "GAP, Halal, Organic",
      "Tags": "beef,dairy,leather"
    }
  },
  {
    "type": "animal",
    "category": "Bovines",
    "subCategory": "",
    "name": "Buffalo",
    "variety": "Buffalo",
    "form": "",
    "useCase": "Dairy, Meat",
    "typicalPackSize": "",
    "unit": "Head",
    "grade": "",
    "extras": {
      "Breed/Variety": "Murrah, Nili Ravi",
      "Primary Products": "Milk, Meat",
      "Secondary Products": "Hides, Ghee",
      "Edible Byproducts": "Liver, Tongue, Blood, Fat",
      "Region of Origin/Prevalence": "India, Pakistan, Italy",
      "Production Type": "Farm",
      "Certifications/Standards": "Organic, GAP",
      "Tags": "buffalo,milk,meat"
    }
  },
  {
    "type": "animal",
    "category": "Small Ruminant",
    "subCategory": "",
    "name": "Goat",
    "variety": "Goat",
    "form": "",
    "useCase": "Meat, Dairy",
    "typicalPackSize": "",
    "unit": "Head",
    "grade": "",
    "extras": {
      "Breed/Variety": "Boer, Saanen, Galla",
      "Primary Products": "Meat, Milk",
      "Secondary Products": "Skins, Manure",
      "Edible Byproducts": "Liver, Intestines, Blood, Feet (trotters)",
      "Region of Origin/Prevalence": "Africa, Asia, Middle East",
      "Production Type": "Farm",
      "Certifications/Standards": "Halal, Organic",
      "Tags": "goat,meat,milk"
    }
  },
  {
    "type": "animal",
    "category": "Small Ruminant",
    "subCategory": "",
    "name": "Sheep",
    "variety": "Sheep",
    "form": "",
    "useCase": "Meat, Fiber, Dairy",
    "typicalPackSize": "",
    "unit": "Head",
    "grade": "",
    "extras": {
      "Breed/Variety": "Dorper, Merino, Awassi",
      "Primary Products": "Mutton, Wool, Milk",
      "Secondary Products": "Hides, Manure",
      "Edible Byproducts": "Liver, Tripe, Intestines, Kidney, Head, Tongue",
      "Region of Origin/Prevalence": "Global",
      "Production Type": "Pastoral",
      "Certifications/Standards": "Woolmark, Halal",
      "Tags": "sheep,wool,milk"
    }
  },
  {
    "type": "animal",
    "category": "Porcine",
    "subCategory": "",
    "name": "Pig",
    "variety": "Pig",
    "form": "",
    "useCase": "Meat",
    "typicalPackSize": "",
    "unit": "Head",
    "grade": "",
    "extras": {
      "Breed/Variety": "Large White, Landrace, Duroc",
      "Primary Products": "Pork, Bacon",
      "Secondary Products": "Lard, Manure",
      "Edible Byproducts": "Liver, Kidney, Blood, Intestines (sausages), Fatback, Ribs",
      "Region of Origin/Prevalence": "Global",
      "Production Type": "Intensive",
      "Certifications/Standards": "HACCP, GAP",
      "Tags": "pork,meat"
    }
  },
  {
    "type": "animal",
    "category": "Poultry",
    "subCategory": "",
    "name": "Chicken",
    "variety": "Chicken",
    "form": "",
    "useCase": "Meat, Eggs",
    "typicalPackSize": "",
    "unit": "Bird",
    "grade": "",
    "extras": {
      "Breed/Variety": "Broilers, Layers, Kienyeji",
      "Primary Products": "Meat, Eggs",
      "Secondary Products": "Feathers, Manure",
      "Edible Byproducts": "Liver, Gizzard, Heart, Feet, Head",
      "Region of Origin/Prevalence": "Global",
      "Production Type": "Farm",
      "Certifications/Standards": "GAP, Organic",
      "Tags": "chicken,egg,poultry"
    }
  },
  {
    "type": "animal",
    "category": "Poultry",
    "subCategory": "",
    "name": "Duck",
    "variety": "Duck",
    "form": "",
    "useCase": "Meat, Eggs",
    "typicalPackSize": "",
    "unit": "Bird",
    "grade": "",
    "extras": {
      "Breed/Variety": "Pekin, Muscovy, Khaki Campbell",
      "Primary Products": "Meat, Eggs",
      "Secondary Products": "Feathers",
      "Edible Byproducts": "Liver (foie gras), Heart, Feet",
      "Region of Origin/Prevalence": "Asia, EU",
      "Production Type": "Farm",
      "Certifications/Standards": "GAP",
      "Tags": "duck,egg"
    }
  },
  {
    "type": "animal",
    "category": "Camelid",
    "subCategory": "",
    "name": "Camel",
    "variety": "Camel",
    "form": "",
    "useCase": "Dairy, Meat",
    "typicalPackSize": "",
    "unit": "Head",
    "grade": "",
    "extras": {
      "Breed/Variety": "Dromedary, Bactrian",
      "Primary Products": "Milk, Meat",
      "Secondary Products": "Hides",
      "Edible Byproducts": "Liver, Hump fat, Intestines",
      "Region of Origin/Prevalence": "Africa, Asia",
      "Production Type": "Nomadic",
      "Certifications/Standards": "Halal",
      "Tags": "camel,milk,meat"
    }
  },
  {
    "type": "animal",
    "category": "Fish",
    "subCategory": "",
    "name": "Tilapia",
    "variety": "Tilapia",
    "form": "",
    "useCase": "Food",
    "typicalPackSize": "",
    "unit": "kg/ton",
    "grade": "",
    "extras": {
      "Breed/Variety": "Nile, Mozambique",
      "Primary Products": "Fresh Fish",
      "Secondary Products": "Smoked, Dried",
      "Edible Byproducts": "Fish Roe, Liver, Head Soup",
      "Region of Origin/Prevalence": "Africa, Asia",
      "Production Type": "Aquaculture",
      "Certifications/Standards": "ASC, GAP",
      "Tags": "fish,tilapia"
    }
  },
  {
    "type": "animal",
    "category": "Fish",
    "subCategory": "",
    "name": "Salmon",
    "variety": "Salmon",
    "form": "",
    "useCase": "Food",
    "typicalPackSize": "",
    "unit": "kg/ton",
    "grade": "",
    "extras": {
      "Breed/Variety": "Atlantic Salmon",
      "Primary Products": "Fillet, Fresh Fish",
      "Secondary Products": "Smoked, Canned",
      "Edible Byproducts": "Caviar, Roe, Belly oil, Head meat",
      "Region of Origin/Prevalence": "EU, Americas",
      "Production Type": "Aquaculture",
      "Certifications/Standards": "ASC",
      "Tags": "fish,salmon"
    }
  },
  {
    "type": "animal",
    "category": "Lagomorph",
    "subCategory": "",
    "name": "Rabbit",
    "variety": "Rabbit",
    "form": "",
    "useCase": "Meat, Fur",
    "typicalPackSize": "",
    "unit": "Head",
    "grade": "",
    "extras": {
      "Breed/Variety": "New Zealand White, Californian",
      "Primary Products": "Meat, Fur",
      "Secondary Products": "Manure",
      "Edible Byproducts": "Liver, Kidney, Heart",
      "Region of Origin/Prevalence": "Global",
      "Production Type": "Small-scale",
      "Certifications/Standards": "Organic",
      "Tags": "rabbit,meat"
    }
  },
  {
    "type": "animal",
    "category": "Apiculture",
    "subCategory": "",
    "name": "Honeybee",
    "variety": "Honeybee",
    "form": "",
    "useCase": "Honey Production",
    "typicalPackSize": "",
    "unit": "Colony",
    "grade": "",
    "extras": {
      "Breed/Variety": "Apis mellifera",
      "Primary Products": "Honey, Wax",
      "Secondary Products": "Propolis, Royal Jelly",
      "Edible Byproducts": "Honeycomb",
      "Region of Origin/Prevalence": "Global",
      "Production Type": "Apiary",
      "Certifications/Standards": "Organic, Fairtrade",
      "Tags": "bee,honey"
    }
  },
  {
    "type": "animal",
    "category": "Poultry",
    "subCategory": "",
    "name": "Goose",
    "variety": "Goose",
    "form": "",
    "useCase": "Meat",
    "typicalPackSize": "",
    "unit": "Bird",
    "grade": "",
    "extras": {
      "Breed/Variety": "Embden, Toulouse",
      "Primary Products": "Meat, Feathers",
      "Secondary Products": "Liver",
      "Edible Byproducts": "Foie gras, Heart, Fat",
      "Region of Origin/Prevalence": "Europe, Asia",
      "Production Type": "Farm",
      "Certifications/Standards": "GAP",
      "Tags": "goose,meat"
    }
  },
  {
    "type": "animal",
    "category": "Mollusk",
    "subCategory": "",
    "name": "Snail",
    "variety": "Snail",
    "form": "",
    "useCase": "Food",
    "typicalPackSize": "",
    "unit": "kg",
    "grade": "",
    "extras": {
      "Breed/Variety": "Achatina, Archachatina",
      "Primary Products": "Meat",
      "Secondary Products": "Shell, Slime",
      "Edible Byproducts": "Caviar (eggs), Foot muscle",
      "Region of Origin/Prevalence": "Africa, EU",
      "Production Type": "Farm",
      "Certifications/Standards": "Organic",
      "Tags": "snail,escargot"
    }
  },
  {
    "type": "animal",
    "category": "Avian (Exotic)",
    "subCategory": "",
    "name": "Ostrich",
    "variety": "Ostrich",
    "form": "",
    "useCase": "Meat, Leather",
    "typicalPackSize": "",
    "unit": "Bird",
    "grade": "",
    "extras": {
      "Breed/Variety": "African Black",
      "Primary Products": "Meat, Leather",
      "Secondary Products": "Feathers",
      "Edible Byproducts": "Liver, Heart, Gizzard",
      "Region of Origin/Prevalence": "Africa",
      "Production Type": "Ranch",
      "Certifications/Standards": "CITES",
      "Tags": "ostrich,meat,leather"
    }
  },
  {
    "type": "animal",
    "category": "Reptile",
    "subCategory": "",
    "name": "Crocodile",
    "variety": "Crocodile",
    "form": "",
    "useCase": "Meat, Leather",
    "typicalPackSize": "",
    "unit": "Piece",
    "grade": "",
    "extras": {
      "Breed/Variety": "Nile Crocodile",
      "Primary Products": "Leather, Meat",
      "Secondary Products": "Oil",
      "Edible Byproducts": "Tail meat, Ribs, Liver",
      "Region of Origin/Prevalence": "Africa, Asia",
      "Production Type": "Farm",
      "Certifications/Standards": "CITES",
      "Tags": "crocodile,meat"
    }
  },
  {
    "type": "animal",
    "category": "Processed Animal Product",
    "subCategory": "",
    "name": "Dairy Goat Products",
    "variety": "Dairy Goat Products",
    "form": "",
    "useCase": "Dairy",
    "typicalPackSize": "",
    "unit": "Litre",
    "grade": "",
    "extras": {
      "Breed/Variety": "Saanen, Alpine",
      "Primary Products": "Milk",
      "Secondary Products": "Cheese, Yogurt, Butter",
      "Edible Byproducts": "Whey",
      "Region of Origin/Prevalence": "Global",
      "Production Type": "Farm",
      "Certifications/Standards": "GAP",
      "Tags": "goatmilk,cheese"
    }
  },
  {
    "type": "animal",
    "category": "Insect",
    "subCategory": "",
    "name": "Black Soldier Fly",
    "variety": "Black Soldier Fly",
    "form": "",
    "useCase": "Feed ingredient",
    "typicalPackSize": "",
    "unit": "kg",
    "grade": "",
    "extras": {
      "Breed/Variety": "Hermetia illucens",
      "Primary Products": "Protein larvae",
      "Secondary Products": "Fertilizer",
      "Edible Byproducts": "None (non-human)",
      "Region of Origin/Prevalence": "Global",
      "Production Type": "Farm",
      "Certifications/Standards": "Feed certified",
      "Tags": "insect,protein"
    }
  }
];

export const TYPE_OPTIONS = [
  "animal",
  "lease",
  "product",
  "service",
  "tree"
] as const;

export const CATEGORY_OPTIONS_BY_TYPE: Record<MarketType, string[]> = {
  "animal": [
    "Apiculture",
    "Avian (Exotic)",
    "Bovines",
    "Camelid",
    "Fish",
    "Insect",
    "Lagomorph",
    "Mollusk",
    "Porcine",
    "Poultry",
    "Processed Animal Product",
    "Reptile",
    "Small Ruminant"
  ],
  "lease": [
    "Aquaculture",
    "Crop Protection",
    "Forage",
    "Forestry & Biomass",
    "Greenhouse",
    "Hand Tools",
    "Harvesting",
    "Irrigation & Water",
    "Livestock & Dairy",
    "Planting & Seeding",
    "Post-Harvest",
    "Poultry",
    "Power & Land Prep",
    "Processing",
    "Smart & Renewable",
    "Transport & Storage"
  ],
  "product": [
    "Aquatic plant",
    "Beverage crop",
    "Botanical",
    "Fiber",
    "Floriculture",
    "Fruit",
    "Grain & Cereal",
    "Herb",
    "Industrial",
    "Industrial/Beverage",
    "Industrial/Botanical",
    "Mushroom",
    "Nut",
    "Oilseed",
    "Pulse (dry)",
    "Spice",
    "Starch crop",
    "Sweetener",
    "Sweetener/Botanical",
    "Vegetable"
  ],
  "service": [
    "Animal & Plant Health Services",
    "Consumer & End Market Services",
    "Cross-Cutting Platform Features",
    "Financial & Business Support",
    "Governance, Standards & Enablers",
    "Input & Equipment Provider Services",
    "Knowledge, Research & Innovation",
    "Primary Production Services",
    "Processing & Value Addition",
    "Trade, Distribution & Logistics"
  ],
  "tree": [
    "Agroforestry",
    "Agroforestry & Carbon",
    "Agroforestry & Medicinal",
    "Aromatic",
    "Aromatic & Industrial",
    "Industrial",
    "Industrial & Medicinal",
    "Industrial & Oil",
    "Medicinal & Aromatic",
    "Specialty & Dye",
    "Specialty & Industrial",
    "Timber & Aromatic",
    "Timber & Forestry",
    "Timber & Gum",
    "Timber & Industrial"
  ]
} as any;

export const UNIT_OPTIONS = [
  "Bird",
  "Colony",
  "Cubic meter",
  "Head",
  "L jerrycan",
  "Litre",
  "Litre, ton",
  "Piece",
  "Ton",
  "heads/carton",
  "kg",
  "kg bag",
  "kg bag/carton",
  "kg bale",
  "kg box",
  "kg bundle",
  "kg can",
  "kg carton",
  "kg crate",
  "kg foil pack",
  "kg jute bag",
  "kg punnet/carton",
  "kg tin",
  "kg/litre",
  "kg/ton",
  "piece",
  "stems/bunch",
  "ton"
] as const;
export const GRADE_OPTIONS = [
  "AA/AB/FAQ",
  "AFLA-compliant",
  "AGD grades",
  "ASTA color",
  "ASTA grade",
  "Alpha acid %",
  "Artemisinin %",
  "BP/BPF/PD/Dust",
  "Class I",
  "Class I/Extra",
  "Curcumin %",
  "DRC %",
  "EVOO/VOO",
  "Export",
  "Export Class",
  "Extra",
  "Fancy",
  "Fibre %",
  "Food grade",
  "Gourmet/Extract grade",
  "Grade 1",
  "Grade 1-3",
  "Grades per market",
  "Hand-picked",
  "ISO 3632 cat.",
  "Kordofan/Hashab",
  "Light/Extra Light",
  "Malting grade",
  "Middling/Strict Middling",
  "Mill-grade",
  "Milling grade",
  "Nonpareil/Carmel",
  "RSS/SIR",
  "Reb A %",
  "Style 1-4",
  "True cinnamon",
  "UG/I/UG grades",
  "W320/W240"
] as const;

// Helpers
export const findByType = (t: MarketType) => MARKET_CATALOG.filter(r => r.type === t);
export const findByCategory = (t: MarketType, cat: string) =>
  MARKET_CATALOG.filter(r => r.type === t && r.category === cat);
const norm = (s: string) => (s ?? "").trim().toLowerCase();

export const productsFor = (t: MarketType, cat: string) =>
  Array.from(new Set(
    MARKET_CATALOG
      .filter(r => r.type === t && norm(r.category) === norm(cat))
      .map(r => r.name?.trim())
      .filter(Boolean) as string[]
  )).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
export const unitsFor = (name: string) => {
  const n = norm(name);
  return Array.from(new Set(
    MARKET_CATALOG.filter(r => norm(r.name) === n)
      .map(r => r.unit)
      .filter(Boolean)
  ));
};

export const defaultPackFor = (name: string) => {
  const n = norm(name);
  const row = MARKET_CATALOG.find(r => norm(r.name) === n && r.typicalPackSize);
  return row ? { size: row.typicalPackSize, unit: row.unit } : null;
};