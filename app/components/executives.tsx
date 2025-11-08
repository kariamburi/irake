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
            "Stephen Ndulah Wafullah is the visionary Founder and CEO of ekarihub, a pioneering digital agribusiness ecosystem redefining how global agribusiness and agricultural value chains connect and thrive. Rooted in principles of innovation, community, wildlife conservation, green living, and environmental stewardship, ekarihub leverages social media, technology, and data to build a more sustainable and inclusive future for agribusiness.",
            "Stephen’s transformative journey began in 2022 when his hands-on experience in fruit and tree farming exposed deep market inefficiencies. This encounter ignited his mission to design scalable, technology-driven solutions that empower farmers, agronomists, traders, buyers, and other key stakeholders to prosper in an increasingly interconnected world of agribusiness.",
            "With over a decade of strategic leadership in customs, taxation, and trade systems, Stephen has played a pivotal role in strengthening Kenya’s revenue base—contributing more than Kshs. 7 billion in additional revenue through post-clearance audits and risk management. His unique ability to merge technical expertise with entrepreneurial vision positions him at the forefront of agribusiness transformation.",
            "A graduate of Hong Kong Baptist University (MSc in Business Management), Stephen brings a rare blend of global insight, strategic foresight, and practical experience, driving a bold vision to reimagine agribusiness for a sustainable, prosperous, and connected world."
        ],
        links: [
            { label: "Website", href: "https://www.ekarihub.com" },
            { label: "Email", href: "mailto:ceo@ekarihub.com" }
        ]
    }
    ,
    {
        slug: "jane-doe",
        name: "Jane Doe",
        title: "Chief Operating Officer",
        photo: "/executives/jane.jpg",
        short:
            "Ops leader scaling marketplace logistics, quality, and safety for users nationwide.",
        bio: [
            "Jane leads operations across marketplace logistics, safety, and policy.",
            "She scales teams, builds resilient processes, and ensures trusted growth.",
        ],
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
            "He is passionate about accessible, fast, and trustworthy farmer tools.",
        ],
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
            "Her teams ship secure, scalable systems for payments, media, and data.",
        ],
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
            "He focuses on durable economics and ecosystem health.",
        ],
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
            "Her team partners with stakeholders to keep users safe and supported.",
        ],
    },
];

export const getExecBySlug = (slug: string) =>
    EXECUTIVES.find((e) => e.slug === slug);
