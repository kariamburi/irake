"use client";

import { useTagSuggestions } from "@/app/hooks/useTagSuggestions";

export function useHashtagSuggestions(uid?: string | null) {
    const { loading, userTags, trending, all } = useTagSuggestions({
        uid,
        horizonDays: 30,
        maxTrending: 48,
    });

    // HashtagPicker expects strings WITHOUT the leading '#'.
    // We’ll still show them as #tag in UI, but store bare tokens.
    return {
        loading,
        trending,     // feed into HashtagPicker `trending`
        suggestions: all, // optional: feed into HashtagPicker `suggestions` if supported
        userTags,
    };
}
