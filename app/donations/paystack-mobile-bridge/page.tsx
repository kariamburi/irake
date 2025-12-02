// app/donations/paystack-mobile-bridge/page.tsx
import PaystackMobileBridgeClient from "@/app/components/PaystackMobileBridgeClient";
import React, { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function PaystackMobileBridgePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen w-full flex items-center justify-center bg-gray-100 px-4">
          <p className="text-sm text-gray-500">
            Preparing ekarihub mobile bridge…
          </p>
        </main>
      }
    >
      <PaystackMobileBridgeClient />
    </Suspense>
  );
}
