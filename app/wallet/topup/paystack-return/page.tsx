// app/donations/paystack-callback/page.tsx

import React, { Suspense } from "react";
import WalletTopupReturnPage from "./WalletTopupReturnPage";

export const dynamic = "force-dynamic"; // optional, but good for dynamic data

export default function PaystackCallbackPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#F3F4F6",
          }}
        >
          <p style={{ fontSize: 14, color: "#6B7280" }}>
            Loading wallet callback…
          </p>
        </div>
      }
    >
      <WalletTopupReturnPage />
    </Suspense>
  );
}
