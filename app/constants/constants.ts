export const EKARI = {
    forest: "#233F39",
    leaf: "#1F3A34",
    gold: "#C79257",
    sand: "#FFFFFF",
    card: "#FFFFFF",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
    subtext: "#5C6B66",
    danger: "#B42318",
};
export const INTERESTS = [
    // Crops / products
    "Maize", "Tomato", "Potato", "Coffee", "Vegetables", "Fruits",
    "Dairy", "Beef", "Poultry", "Fish", "Honey", "Forestry", "Flowers",
    "Cereals", "Plants",

    // Inputs & equipment
    "Seeds", "Fertilizers", "Agrochemicals", "Feeds", "Tools",
    "Machinery", "Irrigation", "Greenhouses",

    // Value addition & infrastructure
    "Processing", "Value Addition", "Packaging", "Cold Chain", "Quality Control",

    // Market & trade
    "Market Linkages", "Export", "Organic", "Traceability", "Compliance",

    // Services & knowledge
    "Training", "Extension", "Soil Testing", "Vet Services", "Breeding / AI",
    "Vaccines & Drugs", "Agronomist", "AgriTech", "Farm Apps", "Gardening",

    // Finance & biz services
    "Loans", "Insurance", "Microfinance", "Sacco", "Consultancy", "Leasing",

    // Org / logistics
    "Cooperatives", "Transport", "Logistics",

    // Climate & resilience
    "Climate Smart", "Resilience", "Water Management",

    // Pests / diseases / toxins (headline buckets + common specifics)
    "Pests", "Diseases", "Contamination",
    "Fall Armyworm", "Stem Borer", "Tomato Leafminer (Tuta absoluta)",
    "Maize Lethal Necrosis", "Late Blight", "Bacterial Wilt", "Coffee Rust",
    "Foot and Mouth", "Newcastle Disease", "East Coast Fever", "Mastitis",
    "Aflatoxin", "Mycotoxins"
];
// Roles mapped to Stakeholder categories (flat list for your existing UI)
export const ROLES = [
    // Primary Producer
    "Farmer", "Beekeeper", "Horticulturalist", "Livestock Keeper",
    "Aquaculture", "Forestry",

    // Input & Equipment Provider
    "Input Supplier", "Equipment / Machinery Dealer", "Irrigation / Greenhouse Vendor",

    // Animal & Plant Health Support
    "Veterinarian", "Para-vet", "Breeder / AI", "Agronomist", "Animal Health Distributor",

    // Processor & Value Adder
    "Processor", "Value Adder", "Packer / Packaging", "Cold Storage / Cold Chain",

    // Trader & Distributor
    "Aggregator", "Cooperative", "Trader", "Exporter", "Retailer",
    "Online Distributor", "Transporter / Logistics",

    // Financial & Business Service Provider
    "Bank", "Microfinance", "Sacco", "Insurance", "Consultant", "Leasing",

    // Knowledge, Research & Innovation
    "Researcher", "Trainer / Extension", "ICT / AgriTech Provider",

    // Governance & Standards
    "Government Agency", "Regulator", "Certifier", "NGO / Development Partner",

    // Consumer / Buyer
    "Consumer / Buyer (Household)", "Consumer / Buyer (Institution)", "Export Buyer"
];
export const INTEREST_GROUPS = [
    { title: "Crops & Products", items: ["Maize", "Tomato", "Potato", "Coffee", "Vegetables", "Fruits", "Dairy", "Beef", "Poultry", "Fish", "Honey", "Forestry", "Flowers", "Cereals"] },
    { title: "Inputs & Equipment", items: ["Seeds", "Fertilizers", "Agrochemicals", "Feeds", "Tools", "Machinery", "Irrigation", "Greenhouses"] },
    { title: "Value Addition & Infra", items: ["Processing", "Value Addition", "Packaging", "Cold Chain", "Quality Control"] },
    { title: "Market & Trade", items: ["Market Linkages", "Export", "Organic", "Traceability", "Compliance"] },
    { title: "Services & Knowledge", items: ["Training", "Extension", "Soil Testing", "Vet Services", "Breeding / AI", "Vaccines & Drugs", "Agronomist", "AgriTech", "Farm Apps"] },
    { title: "Finance & Biz", items: ["Loans", "Insurance", "Microfinance", "Sacco", "Consultancy", "Leasing"] },
    { title: "Org & Logistics", items: ["Cooperatives", "Transport", "Logistics"] },
    { title: "Climate & Resilience", items: ["Climate Smart", "Resilience", "Water Management"] },
    { title: "Pests • Diseases • Toxins", items: ["Pests", "Diseases", "Contamination", "Fall Armyworm", "Stem Borer", "Tomato Leafminer (Tuta absoluta)", "Maize Lethal Necrosis", "Late Blight", "Bacterial Wilt", "Coffee Rust", "Foot and Mouth", "Newcastle Disease", "East Coast Fever", "Mastitis", "Aflatoxin", "Mycotoxins"] },
];

export const ROLE_GROUPS = [
    { title: "Primary Producer", items: ["Farmer", "Beekeeper", "Horticulturalist", "Livestock Keeper", "Aquaculture", "Forestry"] },
    { title: "Input & Equipment", items: ["Input Supplier", "Equipment / Machinery Dealer", "Irrigation / Greenhouse Vendor"] },
    { title: "Animal & Plant Health", items: ["Veterinarian", "Para-vet", "Breeder / AI", "Agronomist", "Animal Health Distributor"] },
    { title: "Processor & Value Add", items: ["Processor", "Value Adder", "Packer / Packaging", "Cold Storage / Cold Chain"] },
    { title: "Trader & Distributor", items: ["Aggregator", "Cooperative", "Trader", "Exporter", "Retailer", "Online Distributor", "Transporter / Logistics"] },
    { title: "Finance & Biz Services", items: ["Bank", "Microfinance", "Sacco", "Insurance", "Consultant", "Leasing"] },
    { title: "Knowledge & Research", items: ["Researcher", "Trainer / Extension", "ICT / AgriTech Provider"] },
    { title: "Governance & Standards", items: ["Government Agency", "Regulator", "Certifier", "NGO / Development Partner"] },
    { title: "Consumer / Buyer", items: ["Consumer / Buyer (Household)", "Consumer / Buyer (Institution)", "Export Buyer"] },
];