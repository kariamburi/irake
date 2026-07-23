import { Suspense } from "react";
import AppShell from "@/app/components/AppShell";
import EkariExpertsClient from "./EkariExpertsClient";

function EkariExpertsLoading() {
    return (
        <AppShell>
            <div className="min-h-screen w-full bg-slate-50 px-4 py-12">
                <div className="mx-auto max-w-7xl animate-pulse">
                    <div className="h-12 w-72 rounded bg-slate-200" />
                    <div className="mt-5 h-16 w-full max-w-3xl rounded-2xl bg-slate-200" />

                    <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div
                                key={index}
                                className="h-96 rounded-3xl bg-white"
                            />
                        ))}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}

export default function EkariExpertsPage() {
    return (
        <Suspense fallback={<EkariExpertsLoading />}>
            <EkariExpertsClient />
        </Suspense>
    );
}