// Central place for your executive data (update freely)
export type Exec = {
    slug: string;
    name: string;
    title: string;
    photo: string;
    short?: string;
    bio: string[];
    links?: { label: string; href: string }[];
};

export const EXECUTIVES: Exec[] = [
    {
        slug: "stephen-ndulah",
        name: "Stephen Ndulah Wafullah",
        title: "Founder & Chief Executive Officer, Ekarihub",
        photo: "/ceo.jpg",
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
            { label: "Website", href: "https://www.ekarihub.com" },
            { label: "Email", href: "mailto:ceo@ekarihub.com" }
        ]
    },
    {
        slug: "jane-doe",
        name: "Jane Doe",
        title: "Chief Operating Officer",
        photo: "/executives/jane.jpg",
        short:
            "Ops leader scaling marketplace logistics, quality, and safety for users nationwide.",
        bio: [
            "Jane leads operations across marketplace logistics, safety, and policy.",
            "She scales teams, builds resilient processes, and ensures trusted growth."
        ]
    },
    {
        slug: "john-kimani",
        name: "John Kimani",
        title: "Chief Product Officer",
        photo: "/executives/john.jpg",
        short:
            "Product strategist focused on farmer outcomes, liquidity, and delightful UX.",
        bio: [
            "John heads product strategy across ekarihub’s market, studio, and community.",
            "He is passionate about accessible, fast, and trustworthy farmer tools."
        ]
    },
    {
        slug: "amina-hassan",
        name: "Amina Hassan",
        title: "Chief Technology Officer",
        photo: "/executives/amina.jpg",
        short:
            "Engineering leader building reliable, secure, and scalable platforms for growth.",
        bio: [
            "Amina leads platform, AI, and infra — enabling high-reliability experiences.",
            "Her teams ship secure, scalable systems for payments, media, and data."
        ]
    },
    {
        slug: "peter-otiende",
        name: "Peter Otiende",
        title: "Chief Growth Officer",
        photo: "/executives/peter.jpg",
        short:
            "Growth leader expanding markets, partnerships, and ecosystem opportunities.",
        bio: [
            "Peter drives user growth, partnerships, and market development across regions.",
            "He focuses on durable economics and ecosystem health."
        ]
    },
    {
        slug: "lucy-wairimu",
        name: "Lucy Wairimu",
        title: "Head of Community & Safety",
        photo: "/executives/lucy.jpg",
        short:
            "Building safer, supportive communities that empower farmers and buyers.",
        bio: [
            "Lucy leads community health, trust & safety policies, and education programs.",
            "Her team partners with stakeholders to keep users safe and supported."
        ]
    }
];

export const getExecBySlug = (slug: string) =>
    EXECUTIVES.find((e) => e.slug === slug);
