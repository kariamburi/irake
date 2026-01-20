import StoreClient from "@/app/components/StoreClient";

export default async function StorePage({
  params,
}: {
  params: Promise<{ sellerId: string }>;
}) {
  const { sellerId } = await params;
  return <StoreClient sellerId={decodeURIComponent(sellerId)} />;
}
