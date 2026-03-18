// app/robots.ts
import type { MetadataRoute } from "next";

const baseUrl = "https://ekarihub.com";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: [
                    "/api/",
                    "/admin/",
                    "/wallet/",
                    "/subscription/",
                    "/reset-password/",
                    "/(auth)/",
                    "/(protected)/",
                    "/providers/",
                    "/donations/",
                    "/deeds/",
                ],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
        host: baseUrl,
    };
}