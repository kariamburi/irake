// app/[handle]/deed/[deedid]/page.tsx

import { Metadata } from "next";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import PlayerClient from "./PlayerClient";


type Props = {
    params: { handle: string; deedid: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { deedid, handle } = params;

    try {
        const snap = await getDoc(doc(db, "deeds", deedid));

        if (!snap.exists()) {
            return {
                title: "Deed not found | ekarihub",
                robots: { index: false, follow: false },
            };
        }

        const data = snap.data() as any;

        const title = data?.text?.slice(0, 80) || "ekarihub deed";
        const description = data?.text?.slice(0, 160) || "Discover agribusiness content on ekarihub";

        const image =
            data?.posterUrl ||
            data?.thumbUrl ||
            data?.media?.[0]?.url ||
            null;

        const url = `https://ekarihub.com/${handle}/deed/${deedid}`;

        return {
            title,
            description,
            alternates: {
                canonical: url,
            },
            openGraph: {
                title,
                description,
                url,
                siteName: "ekarihub",
                images: image ? [{ url: image }] : [],
                type: "article",
            },
            twitter: {
                card: "summary_large_image",
                title,
                description,
                images: image ? [image] : [],
            },
        };
    } catch {
        return {
            title: "ekarihub",
        };
    }
}

export default async function Page({ params }: Props) {
    const { deedid } = params;

    let data: any = null;

    try {
        const snap = await getDoc(doc(db, "deeds", deedid));
        if (snap.exists()) data = snap.data();
    } catch { }

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "VideoObject",
                        name: data?.text,
                        description: data?.text,
                        thumbnailUrl: data?.posterUrl,
                        uploadDate: data?.createdAt,
                        contentUrl: `https://ekarihub.com/${params.handle}/deed/${params.deedid}`,
                    }),
                }}
            />
            {/* SEO CONTENT (for Google) */}
            <div className="hidden">
                <h1>{data?.text || "ekarihub deed"}</h1>
                <p>{data?.text}</p>
            </div>

            {/* CLIENT PLAYER */}
            <PlayerClient />
        </>
    );
}