import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Profile } from '../types';

interface AuthContextValue {
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (...roles: Profile['role'][]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('id, full_name, role, team, avatar_url')
      .eq('id', userId)
      .single();

    const { data: groups } = await supabase
      .from('profile_access_groups')
      .select('access_group_id')
      .eq('profile_id', userId);

    if (profileRow) {
      setProfile({
        id: profileRow.id,
        fullName: profileRow.full_name,
        role: profileRow.role,
        team: profileRow.team,
        avatarUrl: profileRow.avatar_url,
        accessGroupIds: (groups ?? []).map((g) => g.access_group_id),
      });
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadProfile(session.user.id);
      else setProfile(null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  function hasRole(...roles: Profile['role'][]) {
    return !!profile && roles.includes(profile.role);
  }

  return (
    <AuthContext.Provider value={{ profile, loading, signIn, signOut, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
