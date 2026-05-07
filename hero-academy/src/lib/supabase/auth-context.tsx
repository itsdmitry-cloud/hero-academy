'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { useHeroStore } from '@/lib/store/heroStore';

/* ──────────── types ──────────── */
export interface UserProfile {
  id: string;
  email: string | null;
  display_name: string;
  role: 'student' | 'teacher' | 'parent' | 'admin';
  avatar_url: string | null;
  school_id: string | null;
  class_id: string | null;
  subjects?: string[];
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, meta: { display_name: string; role?: string }) => Promise<{ error: string | null }>;
  joinByCode: (inviteCode: string, displayName: string, password: string, gender: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/* ──────────── hook ──────────── */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

/* ──────────── provider ──────────── */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  /* Fetch public.users profile */
  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('users')
      .select('id, email, display_name, role, avatar_url, school_id, class_id, subjects')
      .eq('id', userId)
      .single();
    setProfile(data as UserProfile | null);
  }, [supabase]);

  /* Listen to auth state changes */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }: { data: { session: Session | null } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) fetchProfile(s.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, s: Session | null) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) fetchProfile(s.user.id);
        else setProfile(null);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile]);

  /* ── sign in ── */
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, [supabase]);

  /* ── sign up ── */
  const signUp = useCallback(async (
    email: string,
    password: string,
    meta: { display_name: string; role?: string }
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: meta.display_name,
          role: meta.role ?? 'student',
        },
      },
    });
    return { error: error?.message ?? null };
  }, [supabase]);

  const joinByCode = useCallback(async (
    inviteCode: string,
    displayName: string,
    password: string,
    gender: string
  ) => {
    // 1. Find class by invite code
    const { data: cls, error: classError } = await supabase
      .from('classes')
      .select('id, school_id, name')
      .eq('invite_code', inviteCode.trim().toLowerCase())
      .single();

    if (classError || !cls) {
      return { error: 'Код класса не найден. Проверь и попробуй снова.' };
    }

    // 2. Create auth user with metadata
    const fakeEmail = `${inviteCode.replace(/[^a-z0-9]/gi, '')}_${Date.now()}@hero.academy`;
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: fakeEmail,
      password,
      options: {
        data: {
          display_name: displayName,
          role: 'student',
          gender,
        },
      },
    });

    if (signUpError) return { error: signUpError.message };

    // 3. Update the user profile with class + school
    if (authData.user) {
      await supabase
        .from('users')
        .update({ class_id: cls.id, school_id: cls.school_id })
        .eq('id', authData.user.id);
    }

    return { error: null };
  }, [supabase]);

  /* ── sign out ── */
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // Reset hero store so the next signed-in user re-fetches via useSupabaseSync.
    useHeroStore.setState({ synced: false });
    setUser(null);
    setProfile(null);
    setSession(null);
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signIn, signUp, joinByCode, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
