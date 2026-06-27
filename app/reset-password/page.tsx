import React, { Suspense } from "react";
import ResetPasswordPage from "./ResetPasswordPage";

export const dynamic = "force-dynamic";

export default function ResetPassword() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <p className="text-sm text-gray-500">Loading password reset…</p>
        </div>
      }
    >
      <ResetPasswordPage />
    </Suspense>
  );
}