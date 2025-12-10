// app/hooks/useInitEkariTags.ts
"use client";

import { useEffect } from "react";
import { db } from "@/lib/firebase";
import { initEkariTagsFromFirestore } from "@/utils/ekariTags";

export function useInitEkariTags() {
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                await initEkariTagsFromFirestore(db);
            } catch (err) {
                console.error("Failed to init Ekari tags from Firestore", err);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);
}
