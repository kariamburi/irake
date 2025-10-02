"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { getAuthSafe } from "@/lib/firebase";

type AuthContextType = {
    user: User | null;
    loading: boolean;
    signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [authInstance, setAuthInstance] = useState<any>(null);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        (async () => {
            const authData = await getAuthSafe();
            if (!authData) {
                setLoading(false); // no auth on server
                return;
            }

            const { auth } = authData;
            setAuthInstance(auth);

            unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
                setUser(firebaseUser);
                setLoading(false);
            });
        })();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    const signOutUser = async () => {
        if (authInstance) {
            await signOut(authInstance);
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, signOutUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
