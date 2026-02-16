"use client";

import { createClient } from "@/lib/supabase/client";
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js";
import * as AuthCoreLib from "@/lib/auth/core";
import { logger } from "@/lib/logging/logger";
import { useEffect, useMemo, useState, createContext, useContext, useRef } from "react";

interface AuthContextType {
    user: User | null;
    permissions: AuthCoreLib.UserPermissions | null;
    loading: boolean;
    error: string | null;
    signOut: () => Promise<{ success: boolean; error?: string }>;
    refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [permissions, setPermissions] = useState<AuthCoreLib.UserPermissions | null>(() => {
        // WYSHKIT 2026: Hydrate permissions from cache if available for instant load
        if (typeof window !== 'undefined') {
            const cached = sessionStorage.getItem('wyshkit_perms');
            if (cached) {
                try {
                    return JSON.parse(cached);
                } catch {
                    return null;
                }
            }
        }
        return null;
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const supabase = useMemo(() => createClient(), []);
    const fetchingRef = useRef<string | null>(null);
    const userIdRef = useRef<string | null>(user?.id);

    // Sync ref with state
    useEffect(() => {
        userIdRef.current = user?.id;
    }, [user?.id]);

    const updatePermissions = async (userId: string) => {
        if (fetchingRef.current === userId) return;
        fetchingRef.current = userId;

        try {
            const perms = await AuthCoreLib.resolveUserPermissions(supabase, userId);
            setPermissions(perms);
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('wyshkit_perms', JSON.stringify(perms));
            }
            setError(null);
        } catch (innerErr) {
            logger.error('[AuthProvider] resolveUserPermissions failed', innerErr as Error);
        } finally {
            fetchingRef.current = null;
        }
    };

    const refreshSession = async () => {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            let currentUser: User | null = null;

            if (sessionError || !session) {
                const { data: { user: fallbackUser }, error: userError } = await supabase.auth.getUser();
                if (userError || !fallbackUser) {
                    setUser(null);
                    setPermissions(null);
                    setLoading(false);
                    sessionStorage.removeItem('wyshkit_perms');
                    return;
                }
                currentUser = fallbackUser;
            } else {
                currentUser = session.user;
            }

            if (!currentUser) {
                setLoading(false);
                return;
            }

            setUser(currentUser);

            // Background fetch to ensure permissions are up to date
            updatePermissions(currentUser.id);

            setLoading(false);
        } catch (err) {
            console.error('Auth Init Error:', err);
            setError('Failed to initialize authentication');
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
            const currentUser = session?.user ?? null;

            if (currentUser?.id !== userIdRef.current) {
                setUser(currentUser);

                if (currentUser) {
                    updatePermissions(currentUser.id);
                } else {
                    setPermissions(null);
                    sessionStorage.removeItem('wyshkit_perms');
                }
            } else if (currentUser && !permissions && !fetchingRef.current) {
                updatePermissions(currentUser.id);
            }

            setError(null);
            setLoading(false);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [supabase, permissions]);

    const signOut = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            sessionStorage.removeItem('wyshkit_perms');
            return { success: true };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to sign out';
            return { success: false, error: errorMessage };
        }
    };

    const value = useMemo(() => ({
        user,
        permissions,
        loading,
        error,
        signOut,
        refreshSession
    }), [user, permissions, loading, error]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuthContext must be used within an AuthProvider");
    }
    return context;
}
