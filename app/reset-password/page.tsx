// app/donations/paystack-callback/page.tsx
import PaystackCallbackClient from "@/app/components/PaystackCallbackClient";
import React, { Suspense } from "react";
import ResetPasswordPage from "./ResetPasswordPage";

export const dynamic = "force-dynamic"; // optional, but good for dynamic data

export default function ResetPassword() {
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
            Loading password reset…
          </p>
        </div>
      }
    >
      <ResetPasswordPage />
    </Suspense>
  );
}
