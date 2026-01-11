// Central place for your executive data (update freely) 
export type Exec = {
    slug: string;
    name: string;
    title: string;
    passport: string;
    photo: string;
    short?: string;
    bio: string[];
    links?: { label: string; href: string }[];
};

export const EXECUTIVES: Exec[] = [
    {
        slug: "stephen-ndulah",
        name: "Stephen Ndulah Wafullah",
        title: "Founder & Chief Executive Officer, ekarihub",
        passport: "/executives/ceo_passport.jpg",
        photo: "/executives/ceo.jpg",
        short:
            "Visionary founder driving ekarihub’s digital agribusiness ecosystem and community.",
        bio: [
            "Stephen Ndulah Wafullah is the visionary Founder and Chief Executive Officer of ekarihub, a pioneering digital agribusiness ecosystem redefining how global agribusiness and agricultural value chains connect, trade, and thrive.",
            "Guided by principles of innovation, sustainability, community empowerment, wildlife conservation, and green living, Stephen leads ekarihub’s mission to harness the power of social media, technology, and data to build a more inclusive, efficient, and sustainable agribusiness future for Africa and beyond.",
            "Stephen’s transformative journey began in 2022, when his firsthand experience in fruit and tree farming revealed deep inefficiencies in market access and information flow. This inspired him to design scalable, technology-driven solutions that empower farmers, agronomists, exporters, buyers, and other value-chain stakeholders to prosper in a digitally connected ecosystem.",
            "Stephen has built an impressive career spanning over a decade in customs, taxation, and international trade systems, where he played a pivotal role in strengthening Kenya’s revenue base—contributing over Kshs. 7 billion in additional revenue through post-clearance audits, risk management, and strategic policy implementation. His rare ability to merge technical expertise with visionary entrepreneurship has made him a key player in both public-sector innovation and private-sector transformation.",
            "A graduate of Kenyatta University with a Bachelor of Commerce (Finance) degree, Stephen later earned his Master of Science in Business Management from Hong Kong Baptist University, where his exposure to global trade networks and international business practices profoundly shaped his worldview. Living and working in Hong Kong—Asia’s vibrant hub of innovation and commerce—broadened his appreciation for cross-border trade systems, digital ecosystems, and sustainable economic models that now inform ekarihub’s global outlook.",
            "Today, Stephen stands at the intersection of technology, sustainability, and agribusiness, championing a bold vision to reimagine agribusiness as a connected, data-driven, and opportunity-rich frontier for Africa and the world."
        ],
        links: [
            // { label: "Website", href: "https://www.ekarihub.com" },
            { label: "Email", href: "mailto:info@ekarihub.com" },
            { label: "LinkedIn", href: "https://www.linkedin.com/in/stephen-wafullah-6a013961/" }
        ]
    },
    //{
    //    slug: "emily-auma-okech",
    //    name: "Emily Okech",
    //    title: "Head of Marketing, ekarihub",
    //    passport: "/executives/exec-emily_passport.jpeg",
    //   photo: "/executives/exec-emily.jpeg",
    //   short:
    //       "Creative, data-driven marketing leader shaping ekarihub’s brand, growth, and community presence.",
    //   bio: [
    //       "Emily Auma is the creative and strategic force behind ekarihub’s brand, growth, and community engagement, ensuring the platform’s story and impact are clearly felt across the agribusiness ecosystem.",
    //       "She brings deep experience from FMCG, mobile technology, and alcoholic beverages, where she has refined her ability to drive visibility, shopper engagement, and flawless in-store execution for some of Africa’s most trusted consumer brands.",
    //       "Before joining ekarihub, Emily led high-impact trade marketing, retail operations, and nationwide brand activation programs at organisations including Unga Limited, Weetabix, Githunguri Dairy, Kenchic, Mondelēz International, Godrej Group, Kevian Kenya and Nokia - consistently delivering strong performance and meeting or exceeding KPIs across markets and teams.",
    //       "At ekarihub, Emily oversees brand development, digital marketing, user acquisition, retention, and community strategy. She combines storytelling with analytics to grow a vibrant, loyal ecosystem of farmers, agripreneurs, partners, and collaborators on the platform.",
    //       "Energetic, insightful, and execution-focused, Emily is committed to ensuring that ekarihub’s voice, identity, and impact remain distinctive and influential across Africa’s agribusiness landscape."
    //    ],
    //   links: [
    //       { label: "Email", href: "mailto:info@ekarihub.com" },
    //        { label: "LinkedIn", href: "https://www.linkedin.com/in/emily-oketch-541441142/" }
    //   ]
    // }
];

export const getExecBySlug = (slug: string) =>
    EXECUTIVES.find((e) => e.slug === slug);
