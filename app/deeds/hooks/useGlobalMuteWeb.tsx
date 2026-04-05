"use client";

import React, {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";

type GlobalMuteContextValue = {
    muted: boolean;
    setMuted: (value: boolean) => void;
    toggleMute: () => void;
};

const GlobalMuteContext = createContext<GlobalMuteContextValue | null>(null);

export function GlobalMuteProviderWeb({
    children,
    initialMuted = true,
}: React.PropsWithChildren<{ initialMuted?: boolean }>) {
    const [muted, setMuted] = useState(initialMuted);

    const toggleMute = useCallback(() => {
        setMuted((prev) => !prev);
    }, []);

    const value = useMemo(
        () => ({
            muted,
            setMuted,
            toggleMute,
        }),
        [muted, toggleMute]
    );

    return (
        <GlobalMuteContext.Provider value={value}>
            {children}
        </GlobalMuteContext.Provider>
    );
}

export function useGlobalMuteWeb() {
    const ctx = useContext(GlobalMuteContext);
    if (!ctx) {
        throw new Error("useGlobalMuteWeb must be used inside GlobalMuteProviderWeb");
    }
    return ctx;
}