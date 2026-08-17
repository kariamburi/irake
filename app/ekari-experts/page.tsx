import { Suspense } from "react";
import { connection } from "next/server";

import EkariExpertsClient from "./EkariExpertsClient";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";

function EkariExpertsLoading() {
    return (
        <div className="grid min-h-screen w-full place-items-center bg-slate-50">
            <BouncingBallLoader />
        </div>
    );
}

export default async function EkariExpertsPage() {
    await connection();

    return (
        <Suspense fallback={<EkariExpertsLoading />}>
            <EkariExpertsClient />
        </Suspense>
    );
}