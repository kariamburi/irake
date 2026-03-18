import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import ProductDetailsClient from "./ProductDetailsClient";

export const dynamic = "force-dynamic";

const baseUrl = "https://ekarihub.com";

type CurrencyCode = "KES" | "USD";

type ProductItem = {
  id: string;
  name: string;
  price?: number;
  currency?: CurrencyCode;
  category?: string;
  categoryLower?: string;
  description?: string | null;
  imageUrl?: string;
  imageUrls?: string[];
  type?: string;
  unit?: string;
  status?: string;
  sold?: boolean;
  seller?: {
    id?: string;
    verified?: boolean;
    handle?: string | null;
    photoURL?: string | null;
    name?: string | null;
  };
  sellerId?: string;
  updatedAt?: string | null;
  createdAt?: string | null;
};

function initAdmin() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin environment variables");
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

function getAdminDb() {
  return getFirestore(initAdmin());
}

async function getPublicMarketProductById(productId: string): Promise<ProductItem | null> {
  const db = getAdminDb();
  const snap = await db.collection("marketListings").doc(productId).get();

  if (!snap.exists) return null;

  const d = snap.data() as any;
  const name = String(d?.name || "").trim();
  const status = String(d?.status || "active").trim().toLowerCase();

  if (!name) return null;
  if (status === "hidden") return null;

  return {
    id: snap.id,
    name,
    price: typeof d?.price === "number" ? d.price : undefined,
    currency: d?.currency === "USD" ? "USD" : "KES",
    category: d?.category || "",
    categoryLower: d?.categoryLower || "",
    description: d?.description || "",
    imageUrl: d?.imageUrl || "",
    imageUrls: Array.isArray(d?.imageUrls) ? d.imageUrls.filter(Boolean) : [],
    type: d?.type || "",
    unit: d?.unit || "",
    status,
    sold: !!d?.sold,
    seller: d?.seller
      ? {
        id: d?.seller?.id || "",
        verified: !!d?.seller?.verified,
        handle: d?.seller?.handle || "",
        photoURL: d?.seller?.photoURL || "",
        name: d?.seller?.name || "",
      }
      : undefined,
    sellerId: d?.sellerId || "",
    updatedAt:
      d?.updatedAt?.toDate?.()?.toISOString?.() ||
      d?.publishedAt?.toDate?.()?.toISOString?.() ||
      d?.createdAt?.toDate?.()?.toISOString?.() ||
      null,
    createdAt:
      d?.createdAt?.toDate?.()?.toISOString?.() ||
      d?.publishedAt?.toDate?.()?.toISOString?.() ||
      null,
  };
}

function safeDescription(input?: string | null, fallback?: string) {
  const text = String(input || fallback || "").replace(/\s+/g, " ").trim();
  if (!text) return "Browse trusted listings on ekariMarket.";
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function formatMoney(value?: number, currency?: CurrencyCode) {
  if (typeof value !== "number") return "";
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value);
  }
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ productid: string }>;
}): Promise<Metadata> {
  const { productid } = await params;
  const product = await getPublicMarketProductById(productid);

  if (!product) {
    return {
      title: "Product not found | ekariMarket",
      robots: { index: false, follow: false },
    };
  }

  const canonical = `${baseUrl}/market/${encodeURIComponent(productid)}`;
  const priceText = formatMoney(product.price, product.currency);

  const description = safeDescription(
    product.description,
    `${product.name}${product.category ? ` • ${product.category}` : ""}${priceText ? ` • ${priceText}` : ""}`
  );

  const image = product.imageUrls?.[0] || product.imageUrl || "";

  return {
    title: `${product.name} | ekariMarket`,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: `${product.name} | ekariMarket`,
      description,
      url: canonical,
      siteName: "ekarihub",
      type: "website",
      images: image ? [{ url: image }] : [],
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: `${product.name} | ekariMarket`,
      description,
      images: image ? [image] : [],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

function buildProductJsonLd(product: ProductItem) {
  const url = `${baseUrl}/market/${encodeURIComponent(product.id)}`;
  const image = product.imageUrls?.length
    ? product.imageUrls
    : product.imageUrl
      ? [product.imageUrl]
      : [];

  const availability =
    product.status === "sold" || product.sold
      ? "https://schema.org/SoldOut"
      : product.status === "reserved"
        ? "https://schema.org/LimitedAvailability"
        : "https://schema.org/InStock";

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || undefined,
    image: image.length ? image : undefined,
    category: product.category || undefined,
    brand: {
      "@type": "Brand",
      name: "ekariMarket",
    },
    seller: product.seller?.name
      ? {
        "@type": "Organization",
        name: product.seller.name,
      }
      : undefined,
    offers:
      typeof product.price === "number"
        ? {
          "@type": "Offer",
          url,
          price: product.price,
          priceCurrency: product.currency || "KES",
          availability,
          itemCondition: "https://schema.org/UsedCondition",
        }
        : undefined,
  };
}

export default async function MarketProductPage({
  params,
}: {
  params: Promise<{ productid: string }>;
}) {
  const { productid } = await params;
  const product = await getPublicMarketProductById(productid);

  if (!product) notFound();

  const jsonLd = buildProductJsonLd(product);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailsClient params={{ productid }} />
    </>
  );
}